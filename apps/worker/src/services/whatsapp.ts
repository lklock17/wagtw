import * as wppconnect from '@wppconnect-team/wppconnect';
import { prisma } from '@wagtw/database';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { aiService } from './ai';
import { telegramNotifier } from './telegram';

class WhatsAppManager {
  private sessions: Map<string, wppconnect.Whatsapp> = new Map();
  private cooldowns: Map<string, number> = new Map(); // key: deviceId:remoteNumber -> timestamp
  private reconnectingDevices: Set<string> = new Set();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private inProgressSessions: Set<string> = new Set();
  private loggedOutNotified: Set<string> = new Set();
  private lastAttemptTime: Map<string, number> = new Map();
  private isWatcherRunning: boolean = false;

  async init() {
    // 1. Start continuous auto-recovery background watcher
    this.startAutoRecoveryWatcher();

    // 2. Restore sessions on worker boot for all paired devices with existing tokens sequentially
    const devices = await prisma.device.findMany();
    for (const device of devices) {
      if (device.phoneNumber) {
        console.log(`[Worker Init] Auto-restoring session for paired device: ${device.name} (${device.id})`);
        this.createSession(device.id, device.name, true);
        // Wait 8 seconds between launches so browsers don't compete for memory and CPU
        await new Promise((r) => setTimeout(r, 8000));
      }
    }
  }

  startAutoRecoveryWatcher() {
    if (this.isWatcherRunning) return;
    this.isWatcherRunning = true;

    // Run health check and auto-recovery every 35 seconds
    setInterval(async () => {
      try {
        await this.checkAndRecoverDevices();
      } catch (err: any) {
        console.warn('[AutoRecoveryWatcher] Error during check:', err.message);
      }
    }, 35000);
  }

  private async checkAndRecoverDevices() {
    // If a session is currently starting up, wait for it to finish before starting another
    if (this.inProgressSessions.size > 0) return;

    const devices = await prisma.device.findMany();

    for (const device of devices) {
      if (this.inProgressSessions.has(device.id)) continue;

      const client = this.sessions.get(device.id);
      if (client) {
        let isConn = false;
        try {
          isConn = await client.isConnected();
        } catch {
          isConn = false;
        }

        if (isConn) {
          if (device.status !== 'CONNECTED') {
            await this.updateDeviceStatus(device.id, 'CONNECTED', null);
          }
        }
      } else {
        // No client instance currently active in memory
        const lastAttempt = this.lastAttemptTime.get(device.id) || 0;
        if (Date.now() - lastAttempt < 90000) {
          // At least 90s cooldown before retrying this device to keep server responsive
          continue;
        }

        // Only auto-recover paired devices (device.phoneNumber exists) that are not currently in QR_READY
        if (device.phoneNumber && device.status !== 'QR_READY') {
          console.log(`[AutoRecoveryWatcher] Found disconnected paired device: ${device.name} (${device.id}). Initiating auto-connect...`);
          this.lastAttemptTime.set(device.id, Date.now());
          this.reconnectingDevices.add(device.id);
          this.createSession(device.id, device.name, true);
          // Only start 1 browser session per cycle to keep server smooth
          break;
        }
      }
    }
  }

  async createSession(deviceId: string, sessionName: string, isAutoRecovery = false) {
    if (this.inProgressSessions.has(deviceId)) {
      console.log(`[createSession] Session creation already in progress for ${deviceId}, skipping duplicate.`);
      return;
    }

    // Clean up any old or dead client for this device first
    const existingClient = this.sessions.get(deviceId);
    if (existingClient) {
      let isConn = false;
      try {
        isConn = await existingClient.isConnected();
      } catch {
        isConn = false;
      }
      if (isConn) {
        console.log(`[createSession] Client for ${deviceId} is already connected.`);
        await this.updateDeviceStatus(deviceId, 'CONNECTED', null);
        return;
      }
      try {
        await existingClient.close();
      } catch {}
      this.sessions.delete(deviceId);
    }

    this.inProgressSessions.add(deviceId);
    this.lastAttemptTime.set(deviceId, Date.now());

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

          // If device was previously paired or auto-recovering, generating a QR means TRUE LOGOUT!
          if (!this.loggedOutNotified.has(deviceId)) {
            prisma.device.findUnique({ where: { id: deviceId } }).then((dev) => {
              if (dev?.phoneNumber || isAutoRecovery) {
                this.loggedOutNotified.add(deviceId);
                this.reconnectingDevices.delete(deviceId);
                console.warn(`[Auto-Recovery] Device ${deviceId} (${sessionName}) requires QR scan: TRUE LOGOUT detected!`);
                this.sendAlert(deviceId, sessionName, 'LOGOUT', dev?.phoneNumber, 'Sesi telah dicabut dari WhatsApp ponsel.').catch(() => {});
              }
            }).catch(() => {});
          }
        },
        statusFind: (statusSession: any, session: string) => {
          console.log(`[StatusFind] Device ${deviceId} (${sessionName}): ${statusSession} [${session}]`);
          if (
            statusSession === 'isLogged' || 
            statusSession === 'qrReadSuccess' ||
            statusSession === 'inChat'
          ) {
            this.loggedOutNotified.delete(deviceId);
            const isRecon = this.reconnectingDevices.has(deviceId);
            this.reconnectingDevices.delete(deviceId);
            this.updateDeviceStatus(deviceId, 'CONNECTED', null);
            if (isRecon) {
              this.sendAlert(deviceId, sessionName, 'RECONNECTED').catch(() => {});
            }
          } else if (statusSession === 'notLogged') {
            // Sesi BENAR-BENAR LOGOUT dari HP!
            console.warn(`[StatusFind] Device ${deviceId} (${sessionName}) notLogged: Logout detected!`);
            if (!this.loggedOutNotified.has(deviceId)) {
              this.loggedOutNotified.add(deviceId);
              this.reconnectingDevices.delete(deviceId);
              this.updateDeviceStatus(deviceId, 'DISCONNECTED', null);
              this.sendAlert(deviceId, sessionName, 'LOGOUT').catch(() => {});
            }
          } else if (
            statusSession === 'desconnectedMobile' || 
            statusSession === 'browserClose' || 
            statusSession === 'serverClose' ||
            statusSession === 'autocloseCalled'
          ) {
            // Disconnect SEMENTARA / Socket Glitch
            this.handleTemporaryDisconnect(deviceId, sessionName, statusSession);
          }
        },
        autoClose: 180000,
        deviceSyncTimeout: 120000,
        headless: true,
        devtools: false,
        useChrome: false,
        debug: false,
        logQR: false,
        puppeteerOptions: {
          defaultViewport: {
            width: 1024,
            height: 768,
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
            isLandscape: true
          }
        },
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--window-size=1024,768',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-sync',
          '--lang=id-ID,id,en-US,en',
          '--disable-blink-features=AutomationControlled'
        ],
      });

      // Apply Human-Like Fingerprint & Stealth Hardware Masking
      try {
        const page = (client as any).page;
        if (page && typeof page.evaluateOnNewDocument === 'function') {
          await page.evaluateOnNewDocument(() => {
            // 1. Hide Webdriver automation flag
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            // 2. Realistic Desktop Hardware: 8 Core CPU, 8GB RAM
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
            // 3. Languages: Indonesian + English
            Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US', 'en'] });
            // 4. Chrome Runtime Object
            (window as any).chrome = {
              runtime: {},
              loadTimes: function() {},
              csi: function() {},
              app: {}
            };
            // 5. Plugins spoofing
            Object.defineProperty(navigator, 'plugins', {
              get: () => [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
              ]
            });
            // 6. WebGL Vendor & Renderer spoofing (Intel Iris Xe Graphics)
            const getParameterProto = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(param: number) {
              if (param === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
              if (param === 37446) return 'Intel(R) Iris(R) Xe Graphics'; // UNMASKED_RENDERER_WEBGL
              return getParameterProto.apply(this, [param]);
            };
          });
        }
      } catch (fpErr: any) {
        console.warn(`[Stealth Fingerprint Warning] Could not apply evaluateOnNewDocument for ${deviceId}:`, fpErr.message);
      }

      this.sessions.set(deviceId, client);
      this.setupEventListeners(deviceId, sessionName, client);

      // Give Puppeteer a brief 2-second synchronization grace period before inspecting device phone number
      await new Promise((resolve) => setTimeout(resolve, 2000));

      let phoneNumber: string | null = null;
      try {
        const rawWid = await client.getWid();
        if (rawWid) {
          phoneNumber = rawWid.replace(/[^0-9]/g, '');
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

        this.loggedOutNotified.delete(deviceId);
        const isRecon = this.reconnectingDevices.has(deviceId);
        this.reconnectingDevices.delete(deviceId);
        await this.sendAlert(deviceId, sessionName, isRecon ? 'RECONNECTED' : 'CONNECTED', phoneNumber);
      } catch (e: any) {
        console.warn(`Could not save CONNECTED status in DB:`, e.message);
      }

    } catch (error: any) {
      console.error(`Error creating session ${sessionName}:`, error?.message || error);
      const errMsg = error?.message || String(error);
      if (errMsg.includes('TimeoutError') || errMsg.includes('Waiting failed') || errMsg.includes('waitForFunction failed')) {
        console.warn(`[createSession] Corrupted session token detected for ${deviceId} (${sessionName}). Removing damaged token folder so QR can generate immediately...`);
        try {
          const tokenDir = path.resolve(process.cwd(), 'tokens', safeSession);
          if (fs.existsSync(tokenDir)) {
            fs.rmSync(tokenDir, { recursive: true, force: true });
          }
        } catch {}
      }
      this.updateDeviceStatus(deviceId, 'DISCONNECTED');
    } finally {
      this.inProgressSessions.delete(deviceId);
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

  private async sendAlert(
    deviceId: string, 
    sessionName: string, 
    type: 'CONNECTED' | 'DISCONNECTED' | 'LOGOUT' | 'RECONNECTED', 
    phoneOverride?: string | null, 
    reason?: string
  ) {
    try {
      let phoneNumber = phoneOverride;
      if (!phoneNumber) {
        const dev = await prisma.device.findUnique({ where: { id: deviceId } });
        phoneNumber = dev?.phoneNumber;
      }
      await telegramNotifier.sendAlert(type, {
        deviceName: sessionName,
        phoneNumber,
        reason
      });
    } catch (e: any) {
      console.warn(`[Telegram Alert Error]:`, e.message);
    }
  }

  private async handleTemporaryDisconnect(deviceId: string, sessionName: string, reason: string) {
    if (this.reconnectingDevices.has(deviceId)) {
      return; // Already attempting auto-reconnect
    }

    this.reconnectingDevices.add(deviceId);
    console.log(`[Auto-Reconnect] Device ${deviceId} (${sessionName}) disconnected (${reason}). Attempting auto-recovery in background...`);

    await this.updateDeviceStatus(deviceId, 'DISCONNECTED');

    await this.sendAlert(
      deviceId, 
      sessionName, 
      'DISCONNECTED', 
      null, 
      `Koneksi socket terputus (${reason}). Sistem sedang mencoba Auto-Reconnect otomatis...`
    );

    const existingTimer = this.reconnectTimers.get(deviceId);
    if (existingTimer) clearTimeout(existingTimer);

    // Wait 12 seconds, check connection, if not recovered naturally, cleanly restart session from tokens
    const timer = setTimeout(async () => {
      try {
        const client = this.sessions.get(deviceId);
        if (client) {
          let isConn = false;
          try {
            isConn = await client.isConnected();
          } catch {
            isConn = false;
          }

          if (isConn) {
            console.log(`[Auto-Reconnect] Device ${deviceId} recovered automatically!`);
            this.reconnectingDevices.delete(deviceId);
            await this.updateDeviceStatus(deviceId, 'CONNECTED', null);
            await this.sendAlert(deviceId, sessionName, 'RECONNECTED');
            return;
          }

          console.log(`[Auto-Reconnect] Recreating clean session for ${deviceId} from stored tokens...`);
          try {
            await client.close();
          } catch {}
          this.sessions.delete(deviceId);
        }

        this.inProgressSessions.delete(deviceId);
        this.createSession(deviceId, sessionName, true);
      } catch (err: any) {
        console.warn(`[Auto-Reconnect] Recovery attempt error for ${deviceId}:`, err.message);
        this.inProgressSessions.delete(deviceId);
      }
    }, 12000);

    this.reconnectTimers.set(deviceId, timer);
  }

  private setupEventListeners(deviceId: string, sessionName: string, client: wppconnect.Whatsapp) {
    // 1. Listen to connection state changes
    client.onStateChange(async (state: any) => {
      console.log(`[onStateChange] Device ${deviceId} (${sessionName}) -> State: ${state}`);

      if (state === 'CONNECTED') {
        this.loggedOutNotified.delete(deviceId);
        const isRecon = this.reconnectingDevices.has(deviceId);
        this.reconnectingDevices.delete(deviceId);
        await this.updateDeviceStatus(deviceId, 'CONNECTED', null);
        if (isRecon) {
          await this.sendAlert(deviceId, sessionName, 'RECONNECTED');
        }
      } else if (state === 'UNPAIRED') {
        // True logout from mobile!
        if (!this.loggedOutNotified.has(deviceId)) {
          this.loggedOutNotified.add(deviceId);
          this.reconnectingDevices.delete(deviceId);
          await this.updateDeviceStatus(deviceId, 'DISCONNECTED', null);
          await this.sendAlert(deviceId, sessionName, 'LOGOUT');
        }
      } else if (state === 'DISCONNECTED' || state === 'TIMEOUT' || state === 'UNLAUNCHED') {
        // Temporary network drop / socket glitch
        await this.handleTemporaryDisconnect(deviceId, sessionName, state);
      }
    });

    // 2. Listen to incoming messages
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
          fromMe: false,
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
          ruleCooldown = matchedRule.cooldown;
          if (matchedRule.isAi) {
            responseText = await aiService.generateResponse(message.body);
          } else {
            responseText = matchedRule.response;
          }
        } else {
          // 2. Fallback to 9routes AI if configured
          const aiRule = rules.find((r: any) => !r.keyword && r.isAi);
          if (aiRule) {
            ruleCooldown = aiRule.cooldown;
            responseText = await aiService.generateResponse(message.body);
          }
        }

        // Check cooldown
        const cooldownKey = `${deviceId}:${message.from}`;
        const now = Date.now();
        const lastSent = this.cooldowns.get(cooldownKey) || 0;

        if (responseText && message.from && (now - lastSent >= ruleCooldown * 1000)) {
          this.cooldowns.set(cooldownKey, now);

          // Human-like typing simulation before auto-reply (1.2s - 2.0s)
          try {
            if (typeof (client as any).startTyping === 'function') {
              const typingTime = Math.floor(Math.random() * 800) + 1200;
              await (client as any).startTyping(message.from, typingTime);
              await new Promise((r) => setTimeout(r, typingTime));
            }
          } catch (tErr) {
            // Non-blocking
          }

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

  async requestPairingCode(deviceId: string, phoneNumber: string): Promise<string> {
    const client = this.sessions.get(deviceId);
    if (!client) throw new Error('Device session is not initializing or not found. Pastikan device dalam proses inisialisasi.');

    const page = (client as any).page;
    if (!page) throw new Error('Browser page not available');

    // Clean phone number to digits only (e.g. 62817101337)
    let cleaned = phoneNumber.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
    else if (cleaned.startsWith('8')) cleaned = '62' + cleaned;

    const code = await page.evaluate(async (phone: string) => {
      // 1. Look for the "Link with phone number" button
      const allSpans = Array.from(document.querySelectorAll('span, div[role="button"]'));
      const linkButton = allSpans.find((el: any) => {
        const txt = (el.textContent || '').toLowerCase();
        return txt.includes('link with phone number') || 
               txt.includes('tautkan dengan nomor telepon') ||
               txt.includes('link with phone') ||
               txt.includes('tautkan dengan nomor');
      });

      if (linkButton) {
        (linkButton as HTMLElement).click();
      }

      await new Promise((r) => setTimeout(r, 1200));

      // 2. Find phone input
      const inputs = Array.from(document.querySelectorAll('input'));
      const phoneInput = inputs.find((i: any) => i.type === 'text' || i.getAttribute('aria-label')?.includes('phone') || i.inputMode === 'numeric') || inputs[inputs.length - 1];

      if (phoneInput) {
        phoneInput.focus();
        phoneInput.value = '';
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(phoneInput, phone);
        } else {
          phoneInput.value = phone;
        }
        phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
        phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      await new Promise((r) => setTimeout(r, 800));

      // 3. Click Next button
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
      const nextBtn = buttons.find((b: any) => {
        const txt = (b.textContent || '').toLowerCase();
        return txt === 'next' || txt === 'lanjut' || txt === 'lanjutkan';
      });

      if (nextBtn) {
        (nextBtn as HTMLElement).click();
      }

      // 4. Wait for 8-char code display
      await new Promise((r) => setTimeout(r, 2500));

      // Check elements with 8-character pairing code format (e.g. ABCD-1234 or 8 digits)
      for (const el of Array.from(document.querySelectorAll('*'))) {
        const text = (el.textContent || '').trim();
        if (/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(text)) {
          return text;
        }
      }

      const codeChars = Array.from(document.querySelectorAll('div[data-testid*="code"], div[aria-label*="code"], span'))
        .filter((el: any) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$|^[A-Z0-9]{8}$/.test((el.textContent || '').trim()));

      if (codeChars.length > 0) {
        return codeChars[0].textContent?.trim();
      }

      return null;
    }, cleaned);

    if (!code) {
      throw new Error('Gagal mendapatkan Pairing Code dari WhatsApp Web. Pastikan nomor benar atau gunakan Scan QR.');
    }
    return code;
  }

  async logout(deviceId: string) {
    this.inProgressSessions.delete(deviceId);
    this.reconnectingDevices.delete(deviceId);
    this.loggedOutNotified.delete(deviceId);
    const timer = this.reconnectTimers.get(deviceId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(deviceId);
    }

    const client = this.sessions.get(deviceId);
    if (client) {
      try {
        await client.logout();
      } catch (err: any) {
        console.warn(`[Logout] client.logout error for ${deviceId}:`, err.message);
      }
      try {
        await client.close();
      } catch (err: any) {
        console.warn(`[Logout] client.close error for ${deviceId}:`, err.message);
      }
      this.sessions.delete(deviceId);
      await this.updateDeviceStatus(deviceId, 'DISCONNECTED');
    }

    // Clean up session token directory on disk
    try {
      const safeSession = `dev_${deviceId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const tokenDir = path.resolve(process.cwd(), 'tokens', safeSession);
      if (fs.existsSync(tokenDir)) {
        fs.rmSync(tokenDir, { recursive: true, force: true });
        console.log(`[Logout] Token directory deleted for ${deviceId}: ${tokenDir}`);
      }
    } catch (cleanErr: any) {
      console.warn(`[Logout] Failed to delete token directory for ${deviceId}:`, cleanErr.message);
    }
  }
}

export const waManager = new WhatsAppManager();
