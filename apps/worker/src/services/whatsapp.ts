import * as wppconnect from '@wppconnect-team/wppconnect';
import { prisma } from '@wagtw/database';
import { aiService } from './ai';

class WhatsAppManager {
  private sessions: Map<string, wppconnect.Whatsapp> = new Map();

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
    try {
      const client = await wppconnect.create({
        session: sessionName,
        catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
          this.updateDeviceStatus(deviceId, 'QR_READY', base64Qr);
        },
        statusFind: (statusSession, session) => {
          console.log(`Status Session: ${statusSession} [${session}]`);
          if (statusSession === 'isLogged' || statusSession === 'qrReadSuccess') {
            this.updateDeviceStatus(deviceId, 'CONNECTED');
          }
        },
        headless: true,
        devtools: false,
        useChrome: true,
        debug: false,
        logQR: false,
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      });

      this.sessions.set(deviceId, client);
      this.setupEventListeners(deviceId, client);
      
      const info = await client.getHostDevice();
      await prisma.device.update({
        where: { id: deviceId },
        data: { 
          status: 'CONNECTED',
          phoneNumber: info.wid.user,
          qrCode: null
        }
      });

    } catch (error) {
      console.error(`Error creating session ${sessionName}:`, error);
      this.updateDeviceStatus(deviceId, 'DISCONNECTED');
    }
  }

  private async updateDeviceStatus(deviceId: string, status: any, qrCode?: string) {
    await prisma.device.update({
      where: { id: deviceId },
      data: { status, qrCode: qrCode || null }
    });
  }

  private setupEventListeners(deviceId: string, client: wppconnect.Whatsapp) {
    client.onMessage(async (message) => {
      if (message.isGroupMsg) return; // Optional: handle group

      // 1. Save to Inbox
      const thread = await prisma.inboxThread.upsert({
        where: {
          deviceId_remoteNumber: {
            deviceId,
            remoteNumber: message.from
          }
        },
        update: {
          lastMessage: message.body,
          unreadCount: { increment: 1 }
        },
        create: {
          deviceId,
          remoteNumber: message.from,
          lastMessage: message.body,
          unreadCount: 1
        }
      });

      await prisma.inboxMessage.create({
        data: {
          threadId: thread.id,
          deviceId,
          fromMe: message.fromMe,
          body: message.body,
          type: 'TEXT', // Expand based on message.type
          metadata: message as any
        }
      });

      // 2. AI Auto Reply
      if (!message.fromMe) {
        const device = await prisma.device.findUnique({ where: { id: deviceId } });
        if (device?.autoReply) {
          const response = await aiService.generateResponse(message.body);
          if (response) {
            await client.sendText(message.from, response);
            // Log the reply
            await prisma.inboxMessage.create({
              data: {
                threadId: thread.id,
                deviceId,
                fromMe: true,
                body: response,
                type: 'TEXT'
              }
            });
          }
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
