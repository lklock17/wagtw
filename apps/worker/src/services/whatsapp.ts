import * as wppconnect from '@wppconnect-team/wppconnect';
import { prisma } from '@wagtw/database';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { aiService } from './ai';
import { telegramNotifier } from './telegram';

const TOKENS_BASE_DIR = process.env.TOKENS_PATH || path.resolve(process.cwd(), 'tokens');
if (!fs.existsSync(TOKENS_BASE_DIR)) {
  try {
    fs.mkdirSync(TOKENS_BASE_DIR, { recursive: true });
  } catch {}
}

class WhatsAppManager {
  private sessions: Map<string, wppconnect.Whatsapp> = new Map();
  private cooldowns: Map<string, number> = new Map(); // key: deviceId:remoteNumber -> timestamp
  private reconnectingDevices: Set<string> = new Set();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private inProgressSessions: Set<string> = new Set();
  private loggedOutNotified: Set<string> = new Set();
  private lastAttemptTime: Map<string, number> = new Map();
  private isWatcherRunning: boolean = false;
  private disconnectAlertTimers: Map<string, NodeJS.Timeout> = new Map();
  private disconnectedAlertSent: Set<string> = new Set();
  private loggedOutDevices: Set<string> = new Set();
  private closingDevices: Set<string> = new Set();

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

    // Run health check and auto-recovery every 50 seconds (lightweight in-memory check)
    setInterval(async () => {
      try {
        await this.checkAndRecoverDevices();
      } catch (err: any) {
        console.warn('[AutoRecoveryWatcher] Error during check:', err.message);
      }
    }, 50000);
  }

  private async checkAndRecoverDevices() {
    // If a session is currently starting up, wait for it to finish before starting another
    if (this.inProgressSessions.size > 0) return;

    const devices = await prisma.device.findMany();

    // Auto-clean any zombie sessions in memory that were deleted from DB
    for (const [activeDeviceId] of this.sessions.entries()) {
      if (!devices.some((d) => d.id === activeDeviceId)) {
        console.log(`[AutoRecoveryWatcher] Found orphaned session ${activeDeviceId} not in DB. Purging...`);
        this.logout(activeDeviceId).catch(() => {});
      }
    }

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

        // Only auto-recover paired devices that are NOT logged out, NOT closing, and NOT in QR_READY
        if (
          device.phoneNumber && 
          device.status !== 'QR_READY' && 
          !this.loggedOutDevices.has(device.id) &&
          !this.closingDevices.has(device.id)
        ) {
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

    // Verify device exists in database before launching Chrome
    const dev = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!dev) {
      console.log(`[createSession] Device ${deviceId} no longer exists in database. Aborting.`);
      return;
    }

    // If user clicked manually from dashboard, reset logged-out and alert flags
    if (!isAutoRecovery) {
      this.loggedOutDevices.delete(deviceId);
      this.loggedOutNotified.delete(deviceId);
      this.disconnectedAlertSent.delete(deviceId);
      this.closingDevices.delete(deviceId);
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
        await this.handleConnectionSuccess(deviceId, sessionName, dev.phoneNumber);
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
    const tokenDir = path.resolve(TOKENS_BASE_DIR, safeSession);

    // Clean up any stale singleton locks from previous abruptly terminated browser processes
    try {
      if (fs.existsSync(tokenDir)) {
        for (const lockFile of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
          const p = path.join(tokenDir, lockFile);
          if (fs.existsSync(p)) {
            fs.unlinkSync(p);
            console.log(`[createSession] Removed stale lock ${lockFile} for ${deviceId}`);
          }
        }
      }
    } catch (e) {
      // ignore
    }

    try {
      const client = await wppconnect.create({
        session: safeSession,
        folderNameToken: TOKENS_BASE_DIR,
        catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
          console.log(`[catchQR] Device ${deviceId} (${sessionName}) QR ready (attempt ${attempts})`);
          this.updateDeviceStatus(deviceId, 'QR_READY', base64Qr);
        },
        statusFind: (statusSession: any, session: string) => {
          console.log(`[StatusFind] Device ${deviceId} (${sessionName}): ${statusSession} [${session}]`);
          if (
            statusSession === 'isLogged' || 
            statusSession === 'qrReadSuccess' ||
            statusSession === 'inChat'
          ) {
            this.handleConnectionSuccess(deviceId, sessionName);
          } else if (
            statusSession === 'desconnectedMobile' || 
            statusSession === 'browserClose' || 
            statusSession === 'serverClose'
          ) {
            // Disconnect SEMENTARA / Socket Glitch
            this.handleTemporaryDisconnect(deviceId, sessionName, statusSession);
          } else if (statusSession === 'autocloseCalled') {
            // QR scan timeout (nobody scanned QR within 3 minutes) - no alert needed, avoid infinite loop!
            console.log(`[StatusFind] Device ${deviceId} (${sessionName}) QR scan expired (autocloseCalled).`);
            this.closingDevices.add(deviceId);
            this.updateDeviceStatus(deviceId, 'DISCONNECTED', null);
            this.inProgressSessions.delete(deviceId);
            this.reconnectingDevices.delete(deviceId);
            const activeClient = this.sessions.get(deviceId);
            if (activeClient) {
              try { activeClient.close(); } catch {}
              this.sessions.delete(deviceId);
            }
            setTimeout(() => this.closingDevices.delete(deviceId), 5000);
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
          userDataDir: tokenDir,
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
          '--no-zygote'
        ],
      });

      // Verify device was not deleted from DB while browser was launching
      const stillExists = await prisma.device.findUnique({ where: { id: deviceId } });
      if (!stillExists) {
        console.log(`[createSession] Device ${deviceId} was deleted during browser initialization. Terminating session.`);
        try { await client.close(); } catch {}
        try { exec(`pkill -9 -f ${safeSession}`, () => {}); } catch {}
        return;
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
        const isNewPairing = Boolean(!stillExists.phoneNumber && phoneNumber);
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

        await this.handleConnectionSuccess(deviceId, sessionName, phoneNumber, isNewPairing);
      } catch (e: any) {
        console.warn(`Could not save CONNECTED status in DB:`, e.message);
      }

    } catch (error: any) {
      console.error(`Error creating session ${sessionName}:`, error?.message || error);
      this.updateDeviceStatus(deviceId, 'DISCONNECTED');
    } finally {
      this.inProgressSessions.delete(deviceId);
    }
  }

  private async handleConnectionSuccess(
    deviceId: string, 
    sessionName: string, 
    phoneNumber?: string | null,
    isNewPairing = false
  ) {
    this.loggedOutNotified.delete(deviceId);
    this.reconnectingDevices.delete(deviceId);

    // Cancel pending disconnect alert timer if connection recovered naturally within grace period!
    const pendingTimer = this.disconnectAlertTimers.get(deviceId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.disconnectAlertTimers.delete(deviceId);
      console.log(`[Auto-Reconnect] Device ${deviceId} recovered within grace period. Disconnect alert canceled.`);
    }

    await this.updateDeviceStatus(deviceId, 'CONNECTED', null);

    // Auto-warmup welcome greeting for newly connected device
    try {
      const apiUrl = process.env.API_URL || 'http://localhost:4010';
      axios.post(`${apiUrl}/api/warmup/welcome-device`, { deviceId }).catch((err) => {
        if (err.response?.status !== 404) {
          console.log(`[Auto-Greet] Info on welcome-device for ${deviceId}:`, err.response?.data?.message || err.message);
        }
      });
    } catch {}

    // Only send Telegram notification if:
    // 1) It is a brand-new pairing
    // 2) A DISCONNECTED alert was actually sent earlier to Telegram
    if (isNewPairing) {
      await this.sendAlert(deviceId, sessionName, 'CONNECTED', phoneNumber);
    } else if (this.disconnectedAlertSent.has(deviceId)) {
      this.disconnectedAlertSent.delete(deviceId);
      await this.sendAlert(deviceId, sessionName, 'RECONNECTED', phoneNumber);
    }
  }

  private async handleTrueLogout(deviceId: string, sessionName: string) {
    const dev = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!dev || !dev.phoneNumber) return; // Unpaired device, no logout alert needed

    // Mark as closing and permanently logged-out so it will NEVER auto-recover or loop
    this.closingDevices.add(deviceId);
    this.loggedOutDevices.add(deviceId);
    this.reconnectingDevices.delete(deviceId);

    // Cancel any pending temporary disconnect alert
    const pendingTimer = this.disconnectAlertTimers.get(deviceId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.disconnectAlertTimers.delete(deviceId);
    }
    this.disconnectedAlertSent.delete(deviceId);

    const reconTimer = this.reconnectTimers.get(deviceId);
    if (reconTimer) {
      clearTimeout(reconTimer);
      this.reconnectTimers.delete(deviceId);
    }

    // STRICTLY 1X NOTIFICATION FOR LOGOUT:
    if (!this.loggedOutNotified.has(deviceId)) {
      this.loggedOutNotified.add(deviceId);
      await this.updateDeviceStatus(deviceId, 'DISCONNECTED', null);
      await this.sendAlert(deviceId, sessionName, 'LOGOUT', dev.phoneNumber);
    }

    // Clean up browser immediately so it won't linger or consume memory
    const client = this.sessions.get(deviceId);
    if (client) {
      try { await client.close(); } catch {}
      this.sessions.delete(deviceId);
    }
    this.inProgressSessions.delete(deviceId);

    const safeSession = `dev_${deviceId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    try {
      exec(`pkill -9 -f ${safeSession}`, () => {});
    } catch {}

    setTimeout(() => {
      this.closingDevices.delete(deviceId);
    }, 8000);
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
    if (this.closingDevices.has(deviceId) || this.loggedOutDevices.has(deviceId)) {
      return; // Deliberate close or already logged out: DO NOT reconnect or alert!
    }

    const dev = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!dev) {
      this.logout(deviceId).catch(() => {});
      return;
    }

    // Only alert and auto-recover paired devices (devices that were actually connected with a phone number)
    if (!dev.phoneNumber) {
      console.log(`[Auto-Reconnect] Device ${deviceId} is not paired (${reason}). Skipping alert.`);
      await this.updateDeviceStatus(deviceId, 'DISCONNECTED');
      return;
    }

    if (this.reconnectingDevices.has(deviceId)) {
      return; // Already handling reconnect
    }
    this.reconnectingDevices.add(deviceId);

    console.log(`[Auto-Reconnect] Device ${deviceId} (${sessionName}) temporary glitch (${reason}).`);
    await this.updateDeviceStatus(deviceId, 'DISCONNECTED');

    // STRICTLY 1X NOTIFICATION PER DISCONNECT EPISODE:
    // If a disconnect alert was already sent, or is already pending, DO NOT schedule another alert!
    if (!this.disconnectedAlertSent.has(deviceId) && !this.disconnectAlertTimers.has(deviceId)) {
      const alertTimer = setTimeout(async () => {
        this.disconnectAlertTimers.delete(deviceId);
        if (this.loggedOutDevices.has(deviceId)) return;

        const current = await prisma.device.findUnique({ where: { id: deviceId } });
        if (!current || current.status === 'CONNECTED' || !current.phoneNumber) return;

        if (!this.disconnectedAlertSent.has(deviceId)) {
          this.disconnectedAlertSent.add(deviceId);
          await this.sendAlert(
            deviceId,
            sessionName,
            'DISCONNECTED',
            current.phoneNumber,
            `Koneksi WhatsApp terputus (${reason}). Sistem sedang mencoba Auto-Reconnect otomatis...`
          );
        }
      }, 25000);

      this.disconnectAlertTimers.set(deviceId, alertTimer);
    }

    // Auto-reconnect worker logic: check after 12 seconds
    const existingTimer = this.reconnectTimers.get(deviceId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      try {
        if (this.loggedOutDevices.has(deviceId)) {
          this.reconnectingDevices.delete(deviceId);
          return;
        }

        const checkDev = await prisma.device.findUnique({ where: { id: deviceId } });
        if (!checkDev || !checkDev.phoneNumber) {
          this.reconnectingDevices.delete(deviceId);
          return;
        }

        const client = this.sessions.get(deviceId);
        if (client) {
          let isConn = false;
          try {
            isConn = await client.isConnected();
          } catch {
            isConn = false;
          }

          if (isConn) {
            console.log(`[Auto-Reconnect] Device ${deviceId} recovered naturally!`);
            await this.handleConnectionSuccess(deviceId, sessionName, checkDev.phoneNumber);
            return;
          }

          console.log(`[Auto-Reconnect] Recreating clean session for ${deviceId} from stored tokens...`);
          this.closingDevices.add(deviceId);
          try {
            await client.close();
          } catch {}
          this.sessions.delete(deviceId);
          setTimeout(() => this.closingDevices.delete(deviceId), 5000);
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
        await this.handleConnectionSuccess(deviceId, sessionName);
      } else if (state === 'UNPAIRED') {
        await this.handleTrueLogout(deviceId, sessionName);
      } else if (state === 'DISCONNECTED' || state === 'TIMEOUT' || state === 'UNLAUNCHED') {
        await this.handleTemporaryDisconnect(deviceId, sessionName, state);
      }
    });

    // 2. Listen to incoming messages
    client.onMessage(async (message) => {
      if (message.isGroupMsg) return; // Optional: handle group

      // 1. Ignore status broadcasts & empty messages
      if (
        !message.from || 
        !message.body || 
        message.from === 'status@broadcast' || 
        (message as any).isStatus || 
        message.from.startsWith('status@')
      ) {
        return;
      }

      // Extract sender contact name & formatted phone number if available
      const senderMeta = (message as any).sender || {};
      const contactName = 
        senderMeta.name || 
        senderMeta.pushname || 
        (message as any).notifyName || 
        (senderMeta.formattedName && !senderMeta.formattedName.includes('@') ? senderMeta.formattedName : null) || 
        null;

      let formattedNumber: string | null = null;
      if (senderMeta.formattedName && /^\+?[0-9\s-]+$/.test(senderMeta.formattedName)) {
        formattedNumber = senderMeta.formattedName;
      } else if (message.from.endsWith('@c.us')) {
        formattedNumber = `+${message.from.replace('@c.us', '')}`;
      }

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
          contactName: contactName || undefined,
          formattedNumber: formattedNumber || undefined,
          lastMessage: snippet,
          unreadCount: { increment: 1 }
        },
        create: {
          deviceId,
          remoteNumber: message.from,
          contactName: contactName || undefined,
          formattedNumber: formattedNumber || undefined,
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
    this.disconnectedAlertSent.delete(deviceId);

    const alertTimer = this.disconnectAlertTimers.get(deviceId);
    if (alertTimer) {
      clearTimeout(alertTimer);
      this.disconnectAlertTimers.delete(deviceId);
    }

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
    }
    await this.updateDeviceStatus(deviceId, 'DISCONNECTED');

    // Force-kill any lingering Chrome processes for this device
    const safeSession = `dev_${deviceId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    try {
      exec(`pkill -9 -f ${safeSession}`, () => {});
    } catch {}

    // Clean up session token directory on disk
    try {
      const tokenDir = path.resolve(TOKENS_BASE_DIR, safeSession);
      if (fs.existsSync(tokenDir)) {
        fs.rmSync(tokenDir, { recursive: true, force: true });
        console.log(`[Logout] Token directory deleted for ${deviceId}: ${tokenDir}`);
      }
    } catch (cleanErr: any) {
      console.warn(`[Logout] Failed to delete token directory for ${deviceId}:`, cleanErr.message);
    }
  }

  async shutdown() {
    console.log('[Worker Shutdown] Gracefully closing all active WhatsApp browser sessions...');
    const closePromises: Promise<any>[] = [];
    for (const [deviceId, client] of this.sessions.entries()) {
      closePromises.push(
        client.close().catch((err: any) => {
          console.warn(`[Shutdown] Error closing client ${deviceId}:`, err.message);
        })
      );
    }
    await Promise.allSettled(closePromises);
    this.sessions.clear();
    console.log('[Worker Shutdown] All browser sessions closed cleanly.');
  }
}

export const waManager = new WhatsAppManager();
