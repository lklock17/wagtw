import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';

// In-memory queue for pending outbound messages to be dispatched to Android Agent
const pendingAgentMessages = new Map<string, Array<{ id: string; to: string; text: string }>>();

export const enqueueAgentMessage = (deviceId: string, id: string, to: string, text: string) => {
  const list = pendingAgentMessages.get(deviceId) || [];
  list.push({ id, to, text });
  pendingAgentMessages.set(deviceId, list);
};

// 1. Register Android Agent device
export const registerAgent = async (req: Request, res: Response) => {
  const { name, phone, model } = req.body;

  try {
    let cleanedPhone = phone ? phone.replace(/[^0-9]/g, '') : null;
    if (cleanedPhone && cleanedPhone.startsWith('0')) {
      cleanedPhone = '62' + cleanedPhone.substring(1);
    }

    let device;
    if (cleanedPhone) {
      device = await prisma.device.findFirst({
        where: { phoneNumber: cleanedPhone }
      });
    }

    if (device) {
      device = await prisma.device.update({
        where: { id: device.id },
        data: {
          name: name || device.name,
          status: 'CONNECTED',
          lastConnected: new Date(),
          sessionData: JSON.stringify({ type: 'ANDROID_AGENT', model: model || 'Android Phone' })
        }
      });
    } else {
      device = await prisma.device.create({
        data: {
          name: name || 'HP Agen Android',
          phoneNumber: cleanedPhone,
          status: 'CONNECTED',
          lastConnected: new Date(),
          sessionData: JSON.stringify({ type: 'ANDROID_AGENT', model: model || 'Android Phone' })
        }
      });
    }

    res.json({
      success: true,
      deviceId: device.id,
      name: device.name,
      phone: device.phoneNumber,
      message: 'Perangkat Android Agent berhasil terdaftar!'
    });
  } catch (error: any) {
    console.error('Failed to register agent device:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. Receive incoming message from Android Agent
export const receiveIncomingMessage = async (req: Request, res: Response) => {
  const { deviceId, sender, text, timestamp } = req.body;

  if (!deviceId || !sender || !text) {
    return res.status(400).json({ error: 'deviceId, sender, and text are required' });
  }

  try {
    let cleanSender = sender.replace(/[^0-9]/g, '');
    if (cleanSender.startsWith('0')) cleanSender = '62' + cleanSender.substring(1);
    const remoteNumber = cleanSender || sender;

    // Find or create InboxThread
    let thread = await prisma.inboxThread.findUnique({
      where: {
        deviceId_remoteNumber: {
          deviceId,
          remoteNumber
        }
      }
    });

    if (!thread) {
      thread = await prisma.inboxThread.create({
        data: {
          deviceId,
          remoteNumber,
          contactName: sender,
          lastMessage: text,
          unreadCount: 1
        }
      });
    } else {
      await prisma.inboxThread.update({
        where: { id: thread.id },
        data: {
          contactName: sender,
          lastMessage: text,
          unreadCount: { increment: 1 }
        }
      });
    }

    // Save message into InboxMessage
    const savedMsg = await prisma.inboxMessage.create({
      data: {
        threadId: thread.id,
        deviceId,
        fromMe: false,
        body: text,
        type: 'TEXT',
        timestamp: new Date(timestamp || Date.now())
      }
    });

    console.log(`[Android Agent] Inbound message from ${sender}: ${text}`);
    res.json({ success: true, messageId: savedMsg.id });
  } catch (error: any) {
    console.error('Failed to record incoming message from agent:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 3. Poll pending messages for Android Agent to send
export const getPendingMessages = async (req: Request, res: Response) => {
  const { deviceId } = req.params;

  const queue = pendingAgentMessages.get(deviceId) || [];
  if (queue.length > 0) {
    // Clear queue as we return them
    pendingAgentMessages.set(deviceId, []);
    return res.json({ success: true, messages: queue });
  }

  res.json({ success: true, messages: [] });
};

// 4. Update message status
export const updateMessageStatus = async (req: Request, res: Response) => {
  const { messageId, status, error } = req.body;
  console.log(`[Android Agent] Message ${messageId} status: ${status} ${error ? `(${error})` : ''}`);
  res.json({ success: true });
};
