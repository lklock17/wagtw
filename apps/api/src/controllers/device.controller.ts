import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';
import axios from 'axios';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:4011';

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
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    
    await axios.post(`${WORKER_URL}/sessions/${id}`, { name: device.name, deviceId: id });
    res.json({ message: 'Connection started' });
  } catch (error: any) {
    console.error(`Failed to connect device ${id}:`, error.message);
    res.status(500).json({ error: error.response?.data?.error || 'Failed to connect to worker' });
  }
};

export const deleteDevice = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    try {
      await axios.delete(`${WORKER_URL}/sessions/${id}`, { timeout: 5000 });
    } catch (workerErr) {
      // Worker session may not exist or worker offline, proceed with db cleanup
    }

    await prisma.inboxMessage.deleteMany({ where: { deviceId: id } });
    await prisma.inboxThread.deleteMany({ where: { deviceId: id } });
    await prisma.messageLog.deleteMany({ where: { deviceId: id } });
    await prisma.scheduledMessage.deleteMany({ where: { deviceId: id } });
    await prisma.bulkMessage.deleteMany({ where: { job: { deviceId: id } } });
    await prisma.bulkJob.deleteMany({ where: { deviceId: id } });
    await prisma.device.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
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

export const checkNumber = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, error: 'Nomor telepon ("phone") wajib diisi' });
  }

  try {
    const response = await axios.post(`${WORKER_URL}/devices/${id}/check-number`, { phone }, { timeout: 10000 });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message
    });
  }
};

export const getPairingCode = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, error: 'Nomor telepon ("phone") wajib diisi' });
  }

  try {
    const response = await axios.post(`${WORKER_URL}/devices/${id}/pairing-code`, { phone }, { timeout: 15000 });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message
    });
  }
};
