import axios from 'axios';
import { prisma } from '@wagtw/database';

export class TelegramNotifier {
  private static instance: TelegramNotifier;

  public static getInstance(): TelegramNotifier {
    if (!TelegramNotifier.instance) {
      TelegramNotifier.instance = new TelegramNotifier();
    }
    return TelegramNotifier.instance;
  }

  async sendAlert(type: 'CONNECTED' | 'DISCONNECTED' | 'LOGOUT' | 'RECONNECTED', payload: {
    deviceName: string;
    phoneNumber?: string | null;
    reason?: string;
  }) {
    try {
      const config = await prisma.telegramConfig.findFirst();
      if (!config || !config.isEnabled || !config.botToken || !config.chatId) {
        return;
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

      await axios.post(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        chat_id: config.chatId,
        text,
        parse_mode: 'HTML'
      }, { timeout: 8000 });

      console.log(`[Telegram Alert Sent] Type: ${type} for ${payload.deviceName}`);
    } catch (err: any) {
      console.warn(`[Telegram Alert Failed]:`, err.response?.data?.description || err.message);
    }
  }
}

export const telegramNotifier = TelegramNotifier.getInstance();
