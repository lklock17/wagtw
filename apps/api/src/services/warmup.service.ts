import axios from 'axios';
import { prisma } from '@wagtw/database';
import { PERSONA_TEMPLATES, getRandomPersona, getPersonaById } from '../constants/personas';

const DEFAULT_BASE_URL = 'http://103.89.2.102:20128/v1';
const DEFAULT_API_KEY = 'sk-abf54a1d39290d81-l74lwh-ac3e8eda';
const DEFAULT_MODEL = 'mistral/mistral-large-latest';
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:4011';

export class WarmupService {
  private static instance: WarmupService;
  private isProcessing = false;
  private nextRunTimestamp = 0;
  private welcomedDevices: Map<string, number> = new Map(); // deviceId -> timestamp

  public static getInstance(): WarmupService {
    if (!WarmupService.instance) {
      WarmupService.instance = new WarmupService();
    }
    return WarmupService.instance;
  }

  async getConfig() {
    let config = await prisma.warmupConfig.findFirst({
      where: { id: 'default' }
    });

    if (!config) {
      config = await prisma.warmupConfig.create({
        data: {
          id: 'default',
          isEnabled: false,
          dailyTarget: 10,
          minDelayMinutes: 2,
          minDelaySeconds: 5,
          maxDelaySeconds: 15,
          chatTurns: 3,
          personaMode: 'random',
          autoChatNewDevice: true,
          aiBaseUrl: DEFAULT_BASE_URL,
          aiApiKey: DEFAULT_API_KEY,
          aiModel: DEFAULT_MODEL,
          topicPrompt: PERSONA_TEMPLATES[0].prompt,
          deviceIds: []
        }
      });
    } else if (config.deviceIds && config.deviceIds.length > 0) {
      // Auto-clean any stale device IDs that no longer exist in DB
      const existingDevices = await prisma.device.findMany({
        where: { id: { in: config.deviceIds } },
        select: { id: true }
      });
      const validIds = existingDevices.map((d) => d.id);
      if (validIds.length !== config.deviceIds.length) {
        config = await prisma.warmupConfig.update({
          where: { id: 'default' },
          data: { deviceIds: validIds }
        });
      }
    }

    return config;
  }

  async updateConfig(data: {
    isEnabled?: boolean;
    dailyTarget?: number;
    minDelayMinutes?: number;
    minDelaySeconds?: number;
    maxDelaySeconds?: number;
    chatTurns?: number;
    personaMode?: string;
    autoChatNewDevice?: boolean;
    aiBaseUrl?: string;
    aiApiKey?: string;
    aiModel?: string;
    topicPrompt?: string;
    deviceIds?: string[];
  }) {
    return await prisma.warmupConfig.upsert({
      where: { id: 'default' },
      update: {
        isEnabled: data.isEnabled,
        dailyTarget: data.dailyTarget ? Number(data.dailyTarget) : undefined,
        minDelayMinutes: data.minDelayMinutes ? Number(data.minDelayMinutes) : undefined,
        minDelaySeconds: data.minDelaySeconds ? Number(data.minDelaySeconds) : undefined,
        maxDelaySeconds: data.maxDelaySeconds ? Number(data.maxDelaySeconds) : undefined,
        chatTurns: data.chatTurns ? Number(data.chatTurns) : undefined,
        personaMode: data.personaMode,
        autoChatNewDevice: data.autoChatNewDevice,
        aiBaseUrl: data.aiBaseUrl,
        aiApiKey: data.aiApiKey,
        aiModel: data.aiModel,
        topicPrompt: data.topicPrompt,
        deviceIds: data.deviceIds
      },
      create: {
        id: 'default',
        isEnabled: data.isEnabled ?? false,
        dailyTarget: data.dailyTarget ?? 10,
        minDelayMinutes: data.minDelayMinutes ?? 2,
        minDelaySeconds: data.minDelaySeconds ?? 5,
        maxDelaySeconds: data.maxDelaySeconds ?? 15,
        chatTurns: data.chatTurns ?? 3,
        personaMode: data.personaMode ?? 'random',
        autoChatNewDevice: data.autoChatNewDevice ?? true,
        aiBaseUrl: data.aiBaseUrl || DEFAULT_BASE_URL,
        aiApiKey: data.aiApiKey || DEFAULT_API_KEY,
        aiModel: data.aiModel || DEFAULT_MODEL,
        topicPrompt: data.topicPrompt || PERSONA_TEMPLATES[0].prompt,
        deviceIds: data.deviceIds || []
      }
    });
  }

  async fetchModels(baseUrl?: string, apiKey?: string): Promise<string[]> {
    const config = await this.getConfig();
    const url = (baseUrl || config.aiBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const key = apiKey || config.aiApiKey || DEFAULT_API_KEY;

    try {
      const response = await axios.get(`${url}/models`, {
        headers: {
          Authorization: `Bearer ${key}`
        },
        timeout: 30000
      });

      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data
          .map((m: any) => m.id)
          .filter((id: any) => typeof id === 'string')
          .sort();
      }
      return [DEFAULT_MODEL];
    } catch (error: any) {
      console.error('Error fetching models from 9routes:', error.message);
      throw new Error(error.response?.data?.error?.message || error.message || 'Failed to fetch models from 9routes');
    }
  }

  async getLogs(limit = 50) {
    return await prisma.warmupLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        fromDevice: { select: { id: true, name: true, phoneNumber: true } },
        toDevice: { select: { id: true, name: true, phoneNumber: true } }
      }
    });
  }

  resolveActivePersona(config: any): { id: string; name: string; prompt: string } {
    if (!config.personaMode || config.personaMode === 'random') {
      const rand = getRandomPersona();
      return { id: 'random', name: `🎲 Acak: ${rand.name}`, prompt: rand.prompt };
    }

    const template = PERSONA_TEMPLATES.find((p) => p.id === config.personaMode);
    if (template) {
      return { id: template.id, name: template.name, prompt: template.prompt };
    }

    // Custom or fallback
    return {
      id: 'custom',
      name: 'Kustom Prompt',
      prompt: config.topicPrompt || PERSONA_TEMPLATES[0].prompt
    };
  }

  private async generateAIChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    config: any
  ): Promise<string> {
    const url = (config.aiBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const key = config.aiApiKey || DEFAULT_API_KEY;
    const model = config.aiModel || DEFAULT_MODEL;

    try {
      const response = await axios.post(
        `${url}/chat/completions`,
        {
          model,
          messages,
          max_tokens: 150,
          temperature: 0.8
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`
          },
          timeout: 30000,
          responseType: 'text'
        }
      );

      let rawData = response.data;
      if (typeof rawData === 'string') {
        const cleaned = rawData.split('data: [DONE]')[0].trim();
        try {
          const parsed = JSON.parse(cleaned);
          return parsed.choices?.[0]?.message?.content?.trim() || '';
        } catch {
          const match = rawData.match(/"content"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
          if (match && match[1]) {
            return JSON.parse(`"${match[1]}"`).trim();
          }
        }
      } else if (rawData?.choices?.[0]?.message?.content) {
        return rawData.choices[0].message.content.trim();
      }

      return 'Halo bro, lagi santai nih. Gimana kabarmu hari ini?';
    } catch (error: any) {
      console.error('Error in AI completion:', error?.message);
      const fallbacks = [
        'Halo bro, lg santai gak?',
        'Woi gmn kabarnya? Sehat kan?',
        'Udah makan siang blm bro?',
        'Lagi sibuk apa nih hari ini?',
        'Siap bro, nanti kabarin ya.',
        'Wkwk iya bener juga tuh.',
        'Oke mantap, gas lanjut nanti ya.'
      ];
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
  }

  async runWarmupPair(
    isManual = false,
    options?: { fromDeviceId?: string; toDeviceId?: string; isWelcomeChat?: boolean }
  ) {
    if (this.isProcessing) return { success: false, message: 'Warmup already in progress' };
    this.isProcessing = true;

    try {
      const config = await this.getConfig();
      if (!isManual && !config.isEnabled) {
        return { success: false, message: 'Warmup is disabled' };
      }

      let deviceA: any = null;
      let deviceB: any = null;

      if (options?.fromDeviceId && options?.toDeviceId) {
        // Specific pair (e.g. welcoming new device)
        deviceA = await prisma.device.findUnique({ where: { id: options.fromDeviceId } });
        deviceB = await prisma.device.findUnique({ where: { id: options.toDeviceId } });

        if (!deviceA || !deviceB || deviceA.status !== 'CONNECTED' || deviceB.status !== 'CONNECTED') {
          return {
            success: false,
            message: 'Salah satu perangkat yang ditargetkan tidak dalam status CONNECTED.'
          };
        }
      } else {
        // Automatic random selection
        let connectedDevices = await prisma.device.findMany({
          where: {
            status: 'CONNECTED',
            phoneNumber: { not: null }
          }
        });

        // Filter by selected deviceIds if specified
        if (config.deviceIds && config.deviceIds.length > 0) {
          connectedDevices = connectedDevices.filter((d) => config.deviceIds.includes(d.id));
        }

        if (connectedDevices.length < 2) {
          return {
            success: false,
            message: `Minimal harus ada 2 device yang terhubung (CONNECTED). Saat ini terdeteksi: ${connectedDevices.length} device.`
          };
        }

        const shuffled = [...connectedDevices].sort(() => 0.5 - Math.random());
        deviceA = shuffled[0];
        deviceB = shuffled[1];
      }

      // Determine active persona
      const persona = this.resolveActivePersona(config);
      let systemPrompt = persona.prompt;

      if (options?.isWelcomeChat) {
        systemPrompt = `PERAN PENTING: Kamu adalah nomor WhatsApp lama / kawan yang sudah aktif sebelumnya (${deviceA.name}). Kamu sedang mengirim pesan menyapa kawanmu yang nomor barunya (+${deviceB.phoneNumber || 'baru'}) baru saja aktif di WhatsApp. Tugasmu adalah menyapa nomor barunya dengan ramah dan santai (contoh: "Halo bro! Akhirnya nomormu yang baru ini aktif juga ya, udah ku-save nih kontak barumu! Lagi santai gak?"). DILARANG KERAS berkata seolah-olah kamu yang ganti nomor. Kamu adalah nomor lama yang menyapa. Gunakan bahasa gaul santai Indonesia sehari-hari, 1-2 kalimat pendek, singkatan wajar (lg, udh, gmn, wkwk).`;
      }

      // Calculate turns and delays
      const totalTurns = Math.max(2, Math.min(8, config.chatTurns || 3));
      const minDelaySec = Math.max(3, config.minDelaySeconds || 5);
      const maxDelaySec = Math.max(minDelaySec, config.maxDelaySeconds || 15);

      const getRandomDelayMs = () => {
        const sec = Math.floor(Math.random() * (maxDelaySec - minDelaySec + 1)) + minDelaySec;
        return sec * 1000;
      };

      // Retrieve recent conversation history between A and B
      const recentLogs = await prisma.warmupLog.findMany({
        where: {
          OR: [
            { fromDeviceId: deviceA.id, toDeviceId: deviceB.id },
            { fromDeviceId: deviceB.id, toDeviceId: deviceA.id }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 6
      });
      recentLogs.reverse();

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt }
      ];

      if (recentLogs.length === 0 || options?.isWelcomeChat) {
        messages.push({
          role: 'user',
          content: options?.isWelcomeChat
            ? `Kirimkan chat pembuka dari nomor lama ke kawanmu yang baru mengaktifkan nomor baru ini (+${deviceB.phoneNumber}). Sapa nomor barunya dan beri tahu bahwa kamu sudah menyimpan kontaknya.`
            : 'Mulai obrolan WhatsApp baru yang santai menyapa kawan sesuai tema percakapan.'
        });
      } else {
        recentLogs.forEach((log) => {
          messages.push({
            role: log.fromDeviceId === deviceA.id ? 'assistant' : 'user',
            content: log.message
          });
        });
        messages.push({
          role: 'user',
          content: 'Lanjutkan obrolan secara natural, santai, dan relevan dengan percakapan sebelumnya.'
        });
      }

      // --- Turn 1: Device A sends opening chat to Device B ---
      const msgTextA = await this.generateAIChat(messages, config);
      let sendSuccessA = false;
      let errorMsgA: string | undefined;

      try {
        await axios.post(`${WORKER_URL}/messages/send`, {
          deviceId: deviceA.id,
          to: deviceB.phoneNumber,
          text: msgTextA
        });
        sendSuccessA = true;
      } catch (err: any) {
        errorMsgA = err.response?.data?.error || err.message;
        console.error(`Failed to send warmup turn 1 from ${deviceA.name} to ${deviceB.name}:`, errorMsgA);
      }

      const logA = await prisma.warmupLog.create({
        data: {
          fromDeviceId: deviceA.id,
          toDeviceId: deviceB.id,
          fromNumber: deviceA.phoneNumber,
          toNumber: deviceB.phoneNumber,
          message: msgTextA,
          status: sendSuccessA ? 'SENT' : 'FAILED',
          error: errorMsgA
        }
      });

      console.log(`🔥 [Warmup Turn 1/${totalTurns}] [${persona.name}] ${deviceA.name} -> ${deviceB.name}: "${msgTextA}"`);

      // If opening message failed, stop session early
      if (!sendSuccessA) {
        return {
          success: false,
          message: `Gagal mengirim pesan pembuka: ${errorMsgA}`,
          log: logA
        };
      }

      // --- Subsequent Turns: Alternating replies with random second delays ---
      let conversationTranscript: Array<{ fromId: string; toId: string; text: string }> = [
        { fromId: deviceA.id, toId: deviceB.id, text: msgTextA }
      ];

      const scheduleTurn = (turnIndex: number, sender: any, receiver: any) => {
        if (turnIndex > totalTurns) return;

        const delayMs = getRandomDelayMs();
        const delaySec = Math.round(delayMs / 1000);

        setTimeout(async () => {
          try {
            // Check if both devices are still connected
            const currentSender = await prisma.device.findUnique({ where: { id: sender.id } });
            const currentReceiver = await prisma.device.findUnique({ where: { id: receiver.id } });
            if (currentSender?.status !== 'CONNECTED' || currentReceiver?.status !== 'CONNECTED') {
              console.log(`[Warmup] Turn ${turnIndex} aborted: one of the devices disconnected.`);
              return;
            }

            const turnMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
              { role: 'system', content: systemPrompt }
            ];

            // Append last 4 messages in transcript for rich context
            conversationTranscript.slice(-4).forEach((m) => {
              turnMessages.push({
                role: m.fromId === sender.id ? 'assistant' : 'user',
                content: m.text
              });
            });

            if (options?.isWelcomeChat && turnIndex === 2) {
              turnMessages.push({
                role: 'user',
                content: `PERAN: Kamu adalah pemilik nomor baru ini (${sender.name}). Kawan lamamu baru saja menyapa nomor barumu. Balas sapaannya dengan santai dan senang (contoh: "Halo bro! Wkwk iya bener ini nomorku yang baru, makasih banyak udah di-save ya! Lagi santai nih, gimana kabarmu?").`
              });
            } else {
              turnMessages.push({
                role: 'user',
                content: 'Balas pesan di atas dengan santai dan wajar seperti chatting di WhatsApp.'
              });
            }

            const replyText = await this.generateAIChat(turnMessages, config);
            let replySuccess = false;
            let replyErr: string | undefined;

            try {
              await axios.post(`${WORKER_URL}/messages/send`, {
                deviceId: sender.id,
                to: receiver.phoneNumber,
                text: replyText
              });
              replySuccess = true;
            } catch (err: any) {
              replyErr = err.response?.data?.error || err.message;
            }

            await prisma.warmupLog.create({
              data: {
                fromDeviceId: sender.id,
                toDeviceId: receiver.id,
                fromNumber: sender.phoneNumber,
                toNumber: receiver.phoneNumber,
                message: replyText,
                status: replySuccess ? 'SENT' : 'FAILED',
                error: replyErr
              }
            });

            console.log(
              `💬 [Warmup Turn ${turnIndex}/${totalTurns}] (Delay: ${delaySec}s) ${sender.name} -> ${receiver.name}: "${replyText}"`
            );

            if (replySuccess && turnIndex < totalTurns) {
              conversationTranscript.push({ fromId: sender.id, toId: receiver.id, text: replyText });
              // Next turn alternates: receiver becomes sender
              scheduleTurn(turnIndex + 1, receiver, sender);
            }
          } catch (e: any) {
            console.error(`Error in warmup turn ${turnIndex}:`, e.message);
          }
        }, delayMs);
      };

      // Kick off Turn 2 (Device B responds to Device A)
      scheduleTurn(2, deviceB, deviceA);

      return {
        success: true,
        message: `Sesi pemanasan [${persona.name}] dimulai! Pesan pertama terkirim dari ${deviceA.name} ke ${deviceB.name}. Sesi ini dijadwalkan sebanyak ${totalTurns} balasan dengan jeda acak ${minDelaySec}-${maxDelaySec} detik.`,
        log: logA
      };
    } finally {
      this.isProcessing = false;
    }
  }

  // Welcoming chat when a new device connects
  async welcomeNewDevice(newDeviceId: string) {
    try {
      const config = await this.getConfig();
      if (!config.isEnabled || !config.autoChatNewDevice) {
        return { success: false, message: 'Warmup or auto-chat new device is disabled' };
      }

      // Avoid spamming if connection re-triggered within 30 minutes
      const lastTime = this.welcomedDevices.get(newDeviceId) || 0;
      if (Date.now() - lastTime < 30 * 60 * 1000) {
        return { success: false, message: 'Device was recently greeted, skipping' };
      }

      const newDevice = await prisma.device.findUnique({ where: { id: newDeviceId } });
      if (!newDevice || newDevice.status !== 'CONNECTED' || !newDevice.phoneNumber) {
        return { success: false, message: 'New device not ready or not connected' };
      }

      // Find an established senior device that is CONNECTED and has phone number
      const otherDevices = await prisma.device.findMany({
        where: {
          id: { not: newDeviceId },
          status: 'CONNECTED',
          phoneNumber: { not: null }
        }
      });

      if (otherDevices.length === 0) {
        console.log(`[Auto-Greet] No senior device available to greet newly connected device ${newDevice.name}`);
        return { success: false, message: 'No other connected device available to greet' };
      }

      // Pick one senior device
      const seniorDevice = otherDevices[Math.floor(Math.random() * otherDevices.length)];
      this.welcomedDevices.set(newDeviceId, Date.now());

      console.log(`🎉 [Auto-Greet] Welcoming newly connected device ${newDevice.name} (${newDevice.phoneNumber}) from ${seniorDevice.name}!`);

      // Run welcoming warmup session after a 4-second initial breathing room
      setTimeout(() => {
        this.runWarmupPair(true, {
          fromDeviceId: seniorDevice.id,
          toDeviceId: newDevice.id,
          isWelcomeChat: true
        }).catch((err) => console.error('[Auto-Greet Error]:', err.message));
      }, 4000);

      return {
        success: true,
        message: `Penyambutan device baru dijadwalkan dari ${seniorDevice.name} ke ${newDevice.name}`
      };
    } catch (error: any) {
      console.error('[welcomeNewDevice Error]:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Cron tick called every 1 minute
  async cronTick() {
    try {
      const config = await this.getConfig();
      if (!config.isEnabled) return;

      const now = Date.now();
      if (now < this.nextRunTimestamp) return;

      // Count warmup sessions sent today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todaySentCount = await prisma.warmupLog.count({
        where: {
          createdAt: { gte: startOfDay },
          status: 'SENT'
        }
      });

      const dailyTarget = config.dailyTarget || 10;
      const turns = config.chatTurns || 3;
      const expectedMessagesToday = dailyTarget * turns;

      if (todaySentCount >= expectedMessagesToday) {
        return; // Daily target reached
      }

      // Schedule next run: 24h / dailyTarget with ±25% randomness
      const avgIntervalMinutes = (24 * 60) / Math.max(1, dailyTarget);
      const randomFactor = 0.75 + Math.random() * 0.5; // between 0.75 and 1.25
      const intervalMs = avgIntervalMinutes * randomFactor * 60 * 1000;
      this.nextRunTimestamp = now + intervalMs;

      console.log(`🔥 Executing scheduled warmup... (Today: ${todaySentCount}/${expectedMessagesToday} messages)`);
      await this.runWarmupPair(false);
    } catch (error: any) {
      console.error('Error in warmup cron tick:', error.message);
    }
  }
}

export const warmupService = WarmupService.getInstance();
