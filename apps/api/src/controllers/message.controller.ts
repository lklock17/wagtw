import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';
import axios from 'axios';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:4001';

export const sendMessage = async (req: Request, res: Response) => {
  const { deviceId, to, text, type = 'TEXT', url, caption } = req.body;

  if (!deviceId || !to) return res.status(400).json({ error: 'deviceId and to are required' });

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (device?.status !== 'CONNECTED') {
    return res.status(400).json({ error: 'Device is not connected' });
  }

  try {
    // Forward message request to worker
    const response = await axios.post(`${WORKER_URL}/messages/send`, {
      deviceId,
      to,
      text,
      type,
      url,
      caption
    });

    // Log the message
    await prisma.messageLog.create({
      data: {
        deviceId,
        to,
        body: text || caption || 'Media Message',
        type: type as any,
        status: 'SENT'
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message via worker' });
  }
};
