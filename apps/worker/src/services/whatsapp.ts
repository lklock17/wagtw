import * as wppconnect from '@wppconnect-team/wppconnect';
import { prisma } from '@wagtw/database';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { aiService } from './ai';

class WhatsAppManager {
  private sessions: Map<string, wppconnect.Whatsapp> = new Map();
  private cooldowns: Map<string, number> = new Map(); // key: deviceId:remoteNumber -> timestamp

  async init() {
    // Restore sessions for all devices that should be connected
    const devices = await prisma.device.findMany({
      where: { status: { not: 'DISCONNECTED' } }
    });

    for (const device of devices) {
      this.createSession(device.id, device.name);
    }
  }

  async createSession(deviceId: string, sessionName: string) {
    const safeSession = `dev_${deviceId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    // Clean up any stale singleton locks from previous abruptly terminated browser processes
    try {
      const tokenDir = path.resolve(process.cwd(), 'tokens', safeSession);
      for (const lockFile of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
        const p = path.join(tokenDir, lockFile);
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
        }
      }
    } catch (e) {
      // ignore
    }

    try {
      const client = await wppconnect.create({
        session: safeSession,
        catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
          this.updateDeviceStatus(deviceId, 'QR_READY', base64Qr);
        },
        statusFind: (statusSession: any, session: string) => {
          console.log(`Status Session: ${statusSession} [${session}]`);
          if (
            statusSession === 'isLogged' || 
            statusSession === 'qrReadSuccess'
          ) {
            this.updateDeviceStatus(deviceId, 'CONNECTED', null);
          } else if (
            statusSession === 'browserClose' || 
            statusSession === 'serverClose' ||
            statusSession === 'autocloseCalled'
          ) {
            this.updateDeviceStatus(deviceId, 'DISCONNECTED', null);
          }
        },
        autoClose: 0,
        deviceSyncTimeout: 0,
        whatsappVersion: '',
        headless: true,
        devtools: false,
        useChrome: false,
        debug: false,
        logQR: false,
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote'
        ],
      });

      this.sessions.set(deviceId, client);
      this.setupEventListeners(deviceId, client);
      
      // Allow WhatsApp Web 2 seconds to finalize DOM and state
      await new Promise((r) => setTimeout(r, 2000));

      let phoneNumber: string | null = null;
      try {
        const wid = await client.getWid();
        if (typeof wid === 'string') {
          phoneNumber = wid.replace(/@.*$/, '');
        } else if (wid && (wid as any).user) {
          phoneNumber = (wid as any).user;
        }
      } catch (e) {
        console.warn('Could not get wid directly:', e);
      }

      if (!phoneNumber) {
        try {
          const info = await client.getHostDevice();
          phoneNumber = info?.wid?.user || (info as any)?.id?.user || (info as any)?.phoneNumber || null;
        } catch (e) {
          console.warn('Could not get host device info:', e);
        }
      }

      try {
        await prisma.device.update({
          where: { id: deviceId },
          data: { 
            status: 'CONNECTED',
            phoneNumber: phoneNumber || undefined,
            qrCode: null,
            lastConnected: new Date()
          }
        });
        console.log(`✅ Device ${deviceId} [${sessionName}] CONNECTED! Phone: ${phoneNumber || 'detected'}`);
      } catch (e: any) {
        console.warn(`Could not save CONNECTED status in DB:`, e.message);
      }

    } catch (error) {
      console.error(`Error creating session ${sessionName}:`, error);
      this.updateDeviceStatus(deviceId, 'DISCONNECTED');
    }
  }

  private async updateDeviceStatus(deviceId: string, status: any, qrCode?: string | null) {
    try {
      await prisma.device.update({
        where: { id: deviceId },
        data: { 
          status, 
          ...(qrCode !== undefined ? { qrCode: qrCode } : {}) 
        }
      });
    } catch (e: any) {
      console.warn(`Could not update device status for ${deviceId}:`, e.message);
    }
  }

  private setupEventListeners(deviceId: string, client: wppconnect.Whatsapp) {
    client.onMessage(async (message) => {
      if (message.isGroupMsg) return; // Optional: handle group

      // 1. Save to Inbox
      if (!message.from || !message.body) return;

      const isImage = message.body.startsWith('/9j/') || message.body.startsWith('data:image/') || message.type === 'image';
      const snippet = isImage ? '📷 [Foto / Gambar]' : message.body;
      const msgType = isImage ? 'IMAGE' : (message.type === 'video' ? 'VIDEO' : 'TEXT');

      const thread = await prisma.inboxThread.upsert({
        where: {
          deviceId_remoteNumber: {
            deviceId,
            remoteNumber: message.from
          }
        },
        update: {
          lastMessage: snippet,
          unreadCount: { increment: 1 }
        },
        create: {
          deviceId,
          remoteNumber: message.from,
          lastMessage: snippet,
          unreadCount: 1
        }
      });

      await prisma.inboxMessage.create({
        data: {
          threadId: thread.id,
          deviceId,
          fromMe: message.fromMe,
          body: message.body,
          type: msgType as any,
          metadata: message as any
        }
      });

      // 2. Webhook Dispatch (Trigger external webhook if configured)
      const device = await prisma.device.findUnique({ where: { id: deviceId } });
      if (device?.webhookUrl && !message.fromMe) {
        axios.post(device.webhookUrl, {
          event: 'message.received',
          deviceId,
          from: message.from,
          body: message.body,
          type: message.type || 'TEXT',
          timestamp: new Date().toISOString(),
          metadata: message
        }, { timeout: 8000 }).catch((webhookError: any) => {
          console.warn(`[Webhook Warning] Delivery to ${device.webhookUrl} failed:`, webhookError.message);
        });
      }

      // 3. AI Auto Reply with Cooldown
      if (!message.fromMe && message.body && device?.autoReply) {
        // Fetch rules
        const rules = await prisma.autoReplyRule.findMany({ where: { isActive: true } });
        
        let responseText = null;
        let ruleCooldown = 30; // default 30s
        const bodyLower = message.body.toLowerCase();
        
        // 1. Try keyword match
        const matchedRule = rules.find((r: any) => r.keyword && bodyLower.includes(r.keyword.toLowerCase()));
        
        if (matchedRule) {
          ruleCooldown = matchedRule.cooldown || 30;
          responseText = matchedRule.isAi ? await aiService.generateResponse(message.body) : matchedRule.response;
        } else {
          // 2. Fallback to AI if enabled
          const aiFallback = rules.find((r: any) => r.isAi && !r.keyword);
          if (aiFallback) {
            ruleCooldown = aiFallback.cooldown || 30;
            responseText = await aiService.generateResponse(message.body);
          }
        }

        // Check cooldown
        const cooldownKey = `${deviceId}:${message.from}`;
        const now = Date.now();
        const lastSent = this.cooldowns.get(cooldownKey) || 0;

        if (responseText && message.from && (now - lastSent >= ruleCooldown * 1000)) {
          this.cooldowns.set(cooldownKey, now);
          await client.sendText(message.from, responseText);
          // Log the reply
          await prisma.inboxMessage.create({
            data: {
              threadId: thread.id,
              deviceId,
              fromMe: true,
              body: responseText,
              type: 'TEXT'
            }
          });
        }
      }
    });
  }

  async getClient(deviceId: string) {
    return this.sessions.get(deviceId);
  }

  async logout(deviceId: string) {
    const client = this.sessions.get(deviceId);
    if (client) {
      await client.logout();
      this.sessions.delete(deviceId);
      await this.updateDeviceStatus(deviceId, 'DISCONNECTED');
    }
  }
}

export const waManager = new WhatsAppManager();
