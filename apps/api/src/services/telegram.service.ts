import axios from 'axios';
import { prisma } from '@wagtw/database';

export class TelegramService {
  private static instance: TelegramService;

  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  async getConfig() {
    let config = await prisma.telegramConfig.findFirst();
    if (!config) {
      config = await prisma.telegramConfig.create({
        data: {
          id: 'default',
          isEnabled: false,
          botToken: null,
          chatId: null,
          notifyDisconnect: true,
          notifyConnect: true,
          notifyLogout: true
        }
      });
    }
    return config;
  }

  async updateConfig(data: {
    isEnabled?: boolean;
    botToken?: string | null;
    chatId?: string | null;
    notifyDisconnect?: boolean;
    notifyConnect?: boolean;
    notifyLogout?: boolean;
  }) {
    const current = await this.getConfig();
    return await prisma.telegramConfig.update({
      where: { id: current.id },
      data: {
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : current.isEnabled,
        botToken: data.botToken !== undefined ? data.botToken : current.botToken,
        chatId: data.chatId !== undefined ? data.chatId : current.chatId,
        notifyDisconnect: data.notifyDisconnect !== undefined ? data.notifyDisconnect : current.notifyDisconnect,
        notifyConnect: data.notifyConnect !== undefined ? data.notifyConnect : current.notifyConnect,
        notifyLogout: data.notifyLogout !== undefined ? data.notifyLogout : current.notifyLogout
      }
    });
  }

  async sendRawMessage(botToken: string, chatId: string, text: string) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await axios.post(url, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    }, { timeout: 10000 });
    return res.data;
  }

  async notify(type: 'CONNECTED' | 'DISCONNECTED' | 'LOGOUT' | 'RECONNECTED', payload: {
    deviceName: string;
    phoneNumber?: string | null;
    reason?: string;
  }) {
    try {
      const config = await this.getConfig();
      if (!config.isEnabled || !config.botToken || !config.chatId) {
        return { success: false, message: 'Telegram notification is disabled or not configured' };
      }

      if (type === 'CONNECTED' && !config.notifyConnect) return;
      if (type === 'RECONNECTED' && !config.notifyConnect) return;
      if (type === 'DISCONNECTED' && !config.notifyDisconnect) return;
      if (type === 'LOGOUT' && !config.notifyLogout) return;

      const dateStr = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' WIB';

      const phone = payload.phoneNumber ? `+${payload.phoneNumber}` : '(Belum terdata)';
      let text = '';

      if (type === 'CONNECTED') {
        text = `🟢 <b>[WAGTW] WhatsApp Online (Connected)</b>\n\n` +
               `📱 <b>Device:</b> ${payload.deviceName}\n` +
               `📞 <b>Nomor:</b> <code>${phone}</code>\n` +
               `⚡ <b>Status:</b> Sesi aktif dan siap kirim/terima pesan.\n` +
               `🕒 <b>Waktu:</b> ${dateStr}`;
      } else if (type === 'RECONNECTED') {
        text = `🔄 <b>[WAGTW] WhatsApp Pulih Kembali (Auto-Reconnected)</b>\n\n` +
               `📱 <b>Device:</b> ${payload.deviceName}\n` +
               `📞 <b>Nomor:</b> <code>${phone}</code>\n` +
               `⚡ <b>Keterangan:</b> Koneksi sempat terputus sesaat, namun sistem berhasil menyambung ulang otomatis tanpa perlu scan ulang.\n` +
               `🕒 <b>Waktu:</b> ${dateStr}`;
      } else if (type === 'DISCONNECTED') {
        text = `⚠️ <b>[WAGTW] Peringatan: WhatsApp Terputus Sesaat</b>\n\n` +
               `📱 <b>Device:</b> ${payload.deviceName}\n` +
               `📞 <b>Nomor:</b> <code>${phone}</code>\n` +
               `ℹ️ <b>Keterangan:</b> ${payload.reason || 'Koneksi socket terputus sesaat. Sistem sedang mencoba Auto-Reconnect...'}\n` +
               `🕒 <b>Waktu:</b> ${dateStr}`;
      } else if (type === 'LOGOUT') {
        text = `🔴 <b>[WAGTW] Peringatan: WhatsApp Keluar (Logged Out)</b>\n\n` +
               `📱 <b>Device:</b> ${payload.deviceName}\n` +
               `📞 <b>Nomor:</b> <code>${phone}</code>\n` +
               `⚠️ <b>Keterangan:</b> Sesi telah dicabut/dikeluarkan dari WhatsApp ponsel.\n` +
               `👉 <b>Tindakan:</b> Silakan buka dashboard untuk Scan QR ulang atau gunakan Kode Pairing 8-digit.\n` +
               `🕒 <b>Waktu:</b> ${dateStr}`;
      }

      await this.sendRawMessage(config.botToken, config.chatId, text);
      return { success: true };
    } catch (err: any) {
      console.error('[Telegram Notification Error]:', err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }
}

export const telegramService = TelegramService.getInstance();
