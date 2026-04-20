import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';
import axios from 'axios';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:4001';

export const getDevices = async (req: Request, res: Response) => {
  const devices = await prisma.device.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(devices);
};

export const createDevice = async (req: Request, res: Response) => {
  const { name } = req.body;
  const device = await prisma.device.create({
    data: { name }
  });
  res.json(device);
};

export const connectDevice = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await axios.post(`${WORKER_URL}/sessions/init`, { deviceId: id });
    res.json({ message: 'Connection started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to connect to worker' });
  }
};

export const deleteDevice = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.device.delete({ where: { id } });
  res.json({ success: true });
};

// Webhook Logic
export const updateWebhook = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { webhookUrl } = req.body;
  const device = await prisma.device.update({
    where: { id },
    data: { webhookUrl }
  });
  res.json(device);
};

export const testWebhook = async (req: Request, res: Response) => {
  const { url } = req.body;
  try {
    const start = Date.now();
    await axios.post(url, {
      event: 'ping',
      timestamp: new Date().toISOString(),
      message: 'Webhook Test from WAGTW'
    });
    const latency = Date.now() - start;
    res.json({ success: true, latency });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};
