import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';

// In-memory queue for pending outbound messages to be dispatched to Android Agent
const pendingAgentMessages = new Map<string, Array<{ id: string; to: string; text: string }>>();

export const enqueueAgentMessage = (deviceId: string, id: string, to: string, text: string) => {
  const list = pendingAgentMessages.get(deviceId) || [];
  list.push({ id, to, text });
  pendingAgentMessages.set(deviceId, list);
};

// 1. Register Android Agent device(s) - Supports Dual Numbers (Business & Personal)
export const registerAgent = async (req: Request, res: Response) => {
  const { 
    name, 
    phone, 
    model,
    businessPhone,
    personalPhone,
    enableBusiness = true,
    enablePersonal = false
  } = req.body;

  try {
    const cleanNumber = (num?: string) => {
      if (!num) return null;
      let c = num.replace(/[^0-9]/g, '');
      if (c.startsWith('0')) c = '62' + c.substring(1);
      return c;
    };

    const bPhone = cleanNumber(businessPhone) || (enableBusiness ? cleanNumber(phone) : null);
    const pPhone = cleanNumber(personalPhone);

    const registeredDevices: any[] = [];
    let businessDeviceId: string | null = null;
    let personalDeviceId: string | null = null;

    // Register / Update Business Device (Card 1)
    if (bPhone && enableBusiness) {
      let bDevice = await prisma.device.findFirst({ where: { phoneNumber: bPhone } });
      const devName = `${name || 'HP Agen'} (Business)`;
      const sessionData = JSON.stringify({ 
        type: 'ANDROID_AGENT', 
        targetPackage: 'com.whatsapp.w4b', 
        model: model || 'Android Phone' 
      });

      if (bDevice) {
        bDevice = await prisma.device.update({
          where: { id: bDevice.id },
          data: {
            name: devName,
            status: 'CONNECTED',
            lastConnected: new Date(),
            sessionData
          }
        });
      } else {
        bDevice = await prisma.device.create({
          data: {
            name: devName,
            phoneNumber: bPhone,
            status: 'CONNECTED',
            lastConnected: new Date(),
            sessionData
          }
        });
      }
      businessDeviceId = bDevice.id;
      registeredDevices.push(bDevice);
    }

    // Register / Update Personal Device (Card 2)
    if (pPhone && enablePersonal) {
      let pDevice = await prisma.device.findFirst({ where: { phoneNumber: pPhone } });
      const devName = `${name || 'HP Agen'} (Personal)`;
      const sessionData = JSON.stringify({ 
        type: 'ANDROID_AGENT', 
        targetPackage: 'com.whatsapp', 
        model: model || 'Android Phone' 
      });

      if (pDevice) {
        pDevice = await prisma.device.update({
          where: { id: pDevice.id },
          data: {
            name: devName,
            status: 'CONNECTED',
            lastConnected: new Date(),
            sessionData
          }
        });
      } else {
        pDevice = await prisma.device.create({
          data: {
            name: devName,
            phoneNumber: pPhone,
            status: 'CONNECTED',
            lastConnected: new Date(),
            sessionData
          }
        });
      }
      personalDeviceId = pDevice.id;
      registeredDevices.push(pDevice);
    }

    res.json({
      success: true,
      deviceId: businessDeviceId || personalDeviceId || (registeredDevices[0]?.id),
      businessDeviceId,
      personalDeviceId,
      devices: registeredDevices.map(d => ({
        id: d.id,
        name: d.name,
        phone: d.phoneNumber
      })),
      message: `Berhasil mendaftarkan ${registeredDevices.length} perangkat WhatsApp!`
    });
  } catch (error: any) {
    console.error('Failed to register agent device:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. Receive incoming message from Android Agent
export const receiveIncomingMessage = async (req: Request, res: Response) => {
  let { deviceId, sender, text, timestamp, packageName } = req.body;

  if (!sender || !text) {
    return res.status(400).json({ error: 'sender and text are required' });
  }

  try {
    // If deviceId is not specific or multiple, resolve by packageName
    if (packageName && (!deviceId || deviceId.includes(','))) {
      const matchingDevice = await prisma.device.findFirst({
        where: {
          sessionData: { contains: packageName },
          status: 'CONNECTED'
        },
        orderBy: { lastConnected: 'desc' }
      });
      if (matchingDevice) {
        deviceId = matchingDevice.id;
      }
    }

    if (!deviceId) {
      const fallback = await prisma.device.findFirst({
        where: { status: 'CONNECTED' },
        orderBy: { lastConnected: 'desc' }
      });
      deviceId = fallback?.id;
    }

    if (!deviceId) {
      return res.status(400).json({ error: 'No active device found for incoming message' });
    }

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

    console.log(`[Android Agent] Inbound message for device ${deviceId} from ${sender}: ${text}`);
    res.json({ success: true, messageId: savedMsg.id, deviceId });
  } catch (error: any) {
    console.error('Failed to record incoming message from agent:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 3. Poll pending messages for Android Agent to send (supports comma-separated deviceIds)
export const getPendingMessages = async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const ids = deviceId.split(',').map(s => s.trim()).filter(Boolean);

  const allMessages: any[] = [];
  for (const id of ids) {
    const queue = pendingAgentMessages.get(id) || [];
    if (queue.length > 0) {
      allMessages.push(...queue.map(m => ({ ...m, deviceId: id })));
      pendingAgentMessages.set(id, []);
    }
  }

  res.json({ success: true, messages: allMessages });
};

// 4. Update message status
export const updateMessageStatus = async (req: Request, res: Response) => {
  const { messageId, status, error } = req.body;
  console.log(`[Android Agent] Message ${messageId} status: ${status} ${error ? `(${error})` : ''}`);
  res.json({ success: true });
};
