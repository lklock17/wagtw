import { Request, Response } from 'express';
import { telegramService } from '../services/telegram.service';

export const getTelegramConfig = async (req: Request, res: Response) => {
  try {
    const config = await telegramService.getConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTelegramConfig = async (req: Request, res: Response) => {
  try {
    const updated = await telegramService.updateConfig(req.body);
    res.json({ success: true, config: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const testTelegram = async (req: Request, res: Response) => {
  const { botToken, chatId } = req.body;
  if (!botToken || !chatId) {
    return res.status(400).json({ error: 'Bot Token dan Chat ID wajib diisi untuk pengujian.' });
  }

  try {
    const dateStr = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ' WIB';

    const testMessage = `🔔 <b>[WAGTW Gateway] Uji Coba Notifikasi Berhasil!</b>\n\n` +
      `Sistem gateway WhatsApp Anda telah terhubung dengan sukses ke bot Telegram ini.\n\n` +
      `⚡ <b>Server Node:</b> Online\n` +
      `🕒 <b>Waktu Uji:</b> ${dateStr}\n\n` +
      `<i>Anda akan menerima notifikasi otomatis jika ada nomor WhatsApp yang disconnect atau pulih kembali.</i>`;

    const result = await telegramService.sendRawMessage(botToken.trim(), chatId.trim(), testMessage);
    res.json({ success: true, result });
  } catch (error: any) {
    const errorDetails = error.response?.data?.description || error.message;
    res.status(400).json({
      success: false,
      error: `Gagal mengirim ke Telegram: ${errorDetails}. Pastikan Bot Token valid dan Anda sudah mengirim /start ke bot tersebut di Telegram.`
    });
  }
};
