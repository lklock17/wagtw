import axios from 'axios';
import { prisma } from '@wagtw/database';

const DEFAULT_BASE_URL = 'http://103.89.2.102:20128/v1';
const DEFAULT_API_KEY = 'sk-abf54a1d39290d81-l74lwh-ac3e8eda';
const DEFAULT_MODEL = 'mistral/mistral-large-latest';
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:4011';

export class WarmupService {
  private static instance: WarmupService;
  private isProcessing = false;
  private nextRunTimestamp = 0;

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
          aiBaseUrl: DEFAULT_BASE_URL,
          aiApiKey: DEFAULT_API_KEY,
          aiModel: DEFAULT_MODEL,
          topicPrompt: 'Kamu adalah pengguna WhatsApp di Indonesia. Ngobrol santai, natural, seperti teman akrab (gunakan bahasa gaul/santai Indonesia sehari-hari, singkat, tidak kaku, tidak seperti bot AI, gunakan singkatan umum seperti lg, udh, gmn, wkwk, dll). Nyambung dengan pesan lawan bicaramu.',
          deviceIds: []
        }
      });
    }

    return config;
  }

  async updateConfig(data: {
    isEnabled?: boolean;
    dailyTarget?: number;
    minDelayMinutes?: number;
    aiBaseUrl?: string;
    aiApiKey?: string;
    aiModel?: string;
    topicPrompt?: string;
    deviceIds?: string[];
  }) {
    return await prisma.warmupConfig.upsert({
      where: { id: 'default' },
      update: data,
      create: {
        id: 'default',
        isEnabled: data.isEnabled ?? false,
        dailyTarget: data.dailyTarget ?? 10,
        minDelayMinutes: data.minDelayMinutes ?? 2,
        aiBaseUrl: data.aiBaseUrl || DEFAULT_BASE_URL,
        aiApiKey: data.aiApiKey || DEFAULT_API_KEY,
        aiModel: data.aiModel || DEFAULT_MODEL,
        topicPrompt: data.topicPrompt || 'Ngobrol santai natural bahasa Indonesia',
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
        timeout: 10000
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
          timeout: 15000,
          responseType: 'text' // 9routes might append 'data: [DONE]', handle gracefully
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
      // Fallback natural messages if AI endpoint has temporary hiccup
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

  async runWarmupPair(isManual = false) {
    if (this.isProcessing) return { success: false, message: 'Warmup already in progress' };
    this.isProcessing = true;

    try {
      const config = await this.getConfig();
      if (!isManual && !config.isEnabled) {
        return { success: false, message: 'Warmup is disabled' };
      }

      // Find eligible connected devices
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

      // Pick two random different devices
      const shuffled = [...connectedDevices].sort(() => 0.5 - Math.random());
      const deviceA = shuffled[0];
      const deviceB = shuffled[1];

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

      const systemPrompt =
        config.topicPrompt ||
        'Kamu adalah pengguna WhatsApp di Indonesia. Ngobrol santai, natural, seperti teman akrab (bahasa gaul santai, 1-2 kalimat pendek, gunakan singkatan umum seperti lg, udh, gmn, wkwk, dll). Nyambung dengan topik pembicaraan.';

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt }
      ];

      if (recentLogs.length === 0) {
        messages.push({
          role: 'user',
          content: 'Mulai obrolan WhatsApp baru yang santai menyapa kawan.'
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
          content: 'Balas pesan terakhir secara natural dan santai.'
        });
      }

      // 1. Generate message for Device A
      const msgTextA = await this.generateAIChat(messages, config);

      // Send from Device A to Device B
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
        console.error(`Failed to send warmup from ${deviceA.name} to ${deviceB.name}:`, errorMsgA);
      }

      // Log Device A's message
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

      // 2. Schedule natural reply from Device B to Device A after delay
      const delayMinutes = Math.max(1, config.minDelayMinutes || 2);
      // add random jitter of ±15 seconds
      const delayMs = (delayMinutes * 60 + (Math.floor(Math.random() * 30) - 15)) * 1000;

      setTimeout(async () => {
        try {
          const replyMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: msgTextA }
          ];

          const replyText = await this.generateAIChat(replyMessages, config);

          let replySuccess = false;
          let replyError: string | undefined;

          try {
            await axios.post(`${WORKER_URL}/messages/send`, {
              deviceId: deviceB.id,
              to: deviceA.phoneNumber,
              text: replyText
            });
            replySuccess = true;
          } catch (err: any) {
            replyError = err.response?.data?.error || err.message;
          }

          await prisma.warmupLog.create({
            data: {
              fromDeviceId: deviceB.id,
              toDeviceId: deviceA.id,
              fromNumber: deviceB.phoneNumber,
              toNumber: deviceA.phoneNumber,
              message: replyText,
              status: replySuccess ? 'SENT' : 'FAILED',
              error: replyError
            }
          });

          console.log(`💬 Warmup reply sent from ${deviceB.name} to ${deviceA.name}: "${replyText}"`);
        } catch (e: any) {
          console.error('Error during scheduled warmup reply:', e.message);
        }
      }, delayMs);

      return {
        success: sendSuccessA,
        message: sendSuccessA
          ? `Pesan pemanasan terkirim dari ${deviceA.name} (${deviceA.phoneNumber}) ke ${deviceB.name} (${deviceB.phoneNumber}). Balasan otomatis dijadwalkan dalam ~${delayMinutes} menit.`
          : `Gagal mengirim pesan: ${errorMsgA}`,
        log: logA
      };
    } finally {
      this.isProcessing = false;
    }
  }

  // Cron tick called every 2 minutes
  async cronTick() {
    try {
      const config = await this.getConfig();
      if (!config.isEnabled) return;

      const now = Date.now();
      if (now < this.nextRunTimestamp) return;

      // Count warmup messages sent today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todaySentCount = await prisma.warmupLog.count({
        where: {
          createdAt: { gte: startOfDay },
          status: 'SENT'
        }
      });

      const dailyTarget = config.dailyTarget || 10;
      // Note: Each pair exchange produces 2 messages (A to B, then B to A).
      // So dailyTarget represents total sessions or messages
      if (todaySentCount >= dailyTarget * 2) {
        return; // Daily target reached
      }

      // Schedule next run: 24h / dailyTarget with ±30% randomness
      const avgIntervalMinutes = (24 * 60) / Math.max(1, dailyTarget);
      const randomFactor = 0.7 + Math.random() * 0.6; // between 0.7 and 1.3
      const intervalMs = avgIntervalMinutes * randomFactor * 60 * 1000;
      this.nextRunTimestamp = now + intervalMs;

      console.log(`🔥 Executing scheduled warmup... (Today: ${todaySentCount}/${dailyTarget * 2})`);
      await this.runWarmupPair(false);
    } catch (error: any) {
      console.error('Error in warmup cron tick:', error.message);
    }
  }
}

export const warmupService = WarmupService.getInstance();
