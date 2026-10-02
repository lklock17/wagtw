import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';
import axios from 'axios';
import { sendInstantMessageToAgent, setAgentWsStatusHandler } from '../services/agent-ws.service';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:4011';

// In-memory queue for pending outbound messages / tasks to be dispatched to Android Agent
export interface AgentQueueItem {
  id: string;
  type?: 'MESSAGE' | 'JOIN_GROUP';
  to?: string;
  text?: string;
  inviteUrl?: string;
  dualAppTarget?: string;
  targetPackage?: string;
}

export interface GroupJoinTask {
  id: string;
  deviceId: string;
  deviceName?: string;
  inviteUrl: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pendingAgentMessages = new Map<string, Array<AgentQueueItem>>();
const groupJoinTasks: GroupJoinTask[] = [];

export interface AgentMessageResult {
  status: 'SENT' | 'FAILED';
  error?: string;
}

const agentMessageResolvers = new Map<string, {
  resolve: (result: AgentMessageResult) => void;
  timer: NodeJS.Timeout;
}>();

export const waitForAgentMessage = (messageId: string, timeoutMs = 12000): Promise<AgentMessageResult> => {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      agentMessageResolvers.delete(messageId);
      resolve({
        status: 'FAILED',
        error: 'Timeout: HP Android Agent tidak merespons dalam batas waktu'
      });
    }, timeoutMs);

    agentMessageResolvers.set(messageId, { resolve, timer });
  });
};

export const getGroupJoinTasks = () => groupJoinTasks;

export const enqueueAgentMessage = async (deviceId: string, id: string, to: string, text: string) => {
  let targetPackage: string | undefined;
  let dualAppTarget: string | undefined;

  try {
    const dev = await prisma.device.findUnique({ where: { id: deviceId } });
    if (dev?.sessionData) {
      const data = JSON.parse(dev.sessionData);
      targetPackage = data.targetPackage;
      dualAppTarget = data.dualAppTarget;
    }
  } catch (e) {}

  const payload: AgentQueueItem = {
    id,
    type: 'MESSAGE',
    to,
    text,
    targetPackage,
    dualAppTarget
  };

  const list = pendingAgentMessages.get(deviceId) || [];
  list.push(payload);
  pendingAgentMessages.set(deviceId, list);

  // Instantly send over real-time WebSocket if phone is connected!
  sendInstantMessageToAgent(deviceId, payload);
};

export const enqueueAgentGroupJoin = (deviceId: string, id: string, inviteUrl: string, deviceName?: string) => {
  const task: GroupJoinTask = {
    id,
    deviceId,
    deviceName,
    inviteUrl,
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  groupJoinTasks.unshift(task);
  if (groupJoinTasks.length > 200) groupJoinTasks.pop();

  const list = pendingAgentMessages.get(deviceId) || [];
  list.push({ id, type: 'JOIN_GROUP', inviteUrl });
  pendingAgentMessages.set(deviceId, list);
};

export const executeWorkerGroupJoin = (deviceId: string, id: string, inviteUrl: string, deviceName?: string, delayMs = 0) => {
  const task: GroupJoinTask = {
    id,
    deviceId,
    deviceName,
    inviteUrl,
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  groupJoinTasks.unshift(task);
  if (groupJoinTasks.length > 200) groupJoinTasks.pop();

  setTimeout(async () => {
    try {
      console.log(`[Worker Group Join] Triggering join for device ${deviceName || deviceId} on ${inviteUrl}...`);
      const response = await axios.post(`${WORKER_URL}/groups/join`, {
        deviceId,
        inviteUrl
      }, { timeout: 30000 });

      if (response.data?.success) {
        task.status = 'SUCCESS';
        task.updatedAt = new Date();
        console.log(`[Worker Group Join] Task ${id} SUCCEEDED for device ${deviceName || deviceId}`);
      } else {
        task.status = 'FAILED';
        task.error = response.data?.error || 'Gagal bergabung ke grup';
        task.updatedAt = new Date();
      }
    } catch (err: any) {
      task.status = 'FAILED';
      task.error = err.response?.data?.error || err.message || 'Gagal terhubung ke worker WhatsApp';
      task.updatedAt = new Date();
      console.error(`[Worker Group Join] Task ${id} FAILED:`, task.error);
    }
  }, delayMs);
};

// 1. Register Android Agent device(s) - Supports Physical Phone Grouping & 4 Account Slots (Business 1 & 2 Dual, Personal 1 & 2 Dual)
export const registerAgent = async (req: Request, res: Response) => {
  const { 
    phoneId: clientPhoneId,
    name, 
    phone, 
    model,
    businessPhone,
    businessPhone2,
    personalPhone,
    personalPhone2,
    enableBusiness = true,
    enableBusiness2 = false,
    enablePersonal = false,
    enablePersonal2 = false
  } = req.body;

  try {
    const cleanNumber = (num?: string) => {
      if (!num) return null;
      let c = num.replace(/[^0-9]/g, '');
      if (c.startsWith('0')) c = '62' + c.substring(1);
      return c;
    };

    const phoneName = name || 'HP Agen';
    const phoneModel = model || 'Android Phone';
    const phoneId = clientPhoneId || `phone_${phoneName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const bPhone1 = cleanNumber(businessPhone) || (enableBusiness ? cleanNumber(phone) : null);
    const bPhone2 = cleanNumber(businessPhone2);
    const pPhone1 = cleanNumber(personalPhone);
    const pPhone2 = cleanNumber(personalPhone2);

    const registeredDevices: any[] = [];

    // Helper to register / upsert a slot device
    const upsertSlot = async (
      num: string | null, 
      enabled: boolean, 
      slot: 'BUSINESS_1' | 'BUSINESS_2' | 'PERSONAL_1' | 'PERSONAL_2',
      label: string,
      pkg: string,
      dualApp: 'ACCOUNT_1' | 'ACCOUNT_2'
    ) => {
      if (!num || !enabled) return null;
      
      let dev = await prisma.device.findFirst({ where: { phoneNumber: num } });
      const devName = `${phoneName} - ${label}`;
      const sessionData = JSON.stringify({
        type: 'ANDROID_AGENT',
        phoneId,
        phoneName,
        model: phoneModel,
        slot,
        slotLabel: label,
        accountType: slot.startsWith('BUSINESS') ? 'BUSINESS' : 'PERSONAL',
        targetPackage: pkg,
        dualAppTarget: dualApp
      });

      if (dev) {
        dev = await prisma.device.update({
          where: { id: dev.id },
          data: {
            name: devName,
            status: 'CONNECTED',
            lastConnected: new Date(),
            sessionData
          }
        });
      } else {
        dev = await prisma.device.create({
          data: {
            name: devName,
            phoneNumber: num,
            status: 'CONNECTED',
            lastConnected: new Date(),
            sessionData
          }
        });
      }
      registeredDevices.push(dev);
      return dev;
    };

    const bDev1 = await upsertSlot(bPhone1, enableBusiness, 'BUSINESS_1', 'Bisnis (Slot 1)', 'com.whatsapp.w4b', 'ACCOUNT_1');
    const bDev2 = await upsertSlot(bPhone2, enableBusiness2, 'BUSINESS_2', 'Bisnis Dual (Slot 2)', 'com.whatsapp.w4b', 'ACCOUNT_2');
    const pDev1 = await upsertSlot(pPhone1, enablePersonal, 'PERSONAL_1', 'Personal (Slot 1)', 'com.whatsapp', 'ACCOUNT_1');
    const pDev2 = await upsertSlot(pPhone2, enablePersonal2, 'PERSONAL_2', 'Personal Dual (Slot 2)', 'com.whatsapp', 'ACCOUNT_2');

    res.json({
      success: true,
      phoneId,
      businessDeviceId: bDev1?.id || null,
      businessDeviceId2: bDev2?.id || null,
      personalDeviceId: pDev1?.id || null,
      personalDeviceId2: pDev2?.id || null,
      deviceId: bDev1?.id || pDev1?.id || bDev2?.id || pDev2?.id || (registeredDevices[0]?.id) || null,
      devices: registeredDevices.map(d => ({
        id: d.id,
        name: d.name,
        phone: d.phoneNumber
      })),
      message: `Berhasil mendaftarkan grup ${phoneName} dengan ${registeredDevices.length} akun WhatsApp aktif!`
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

  const devMap = new Map<string, any>();
  if (ids.length > 0) {
    try {
      await prisma.device.updateMany({
        where: { 
          id: { in: ids },
          sessionData: { contains: 'ANDROID_AGENT' }
        },
        data: { status: 'CONNECTED', lastConnected: new Date() }
      });

      const devices = await prisma.device.findMany({
        where: { id: { in: ids } },
        select: { id: true, sessionData: true }
      });
      devices.forEach(d => {
        try {
          if (d.sessionData) devMap.set(d.id, JSON.parse(d.sessionData));
        } catch (e) {}
      });
    } catch (e) {}
  }

  const allMessages: any[] = [];
  for (const id of ids) {
    const queue = pendingAgentMessages.get(id) || [];
    if (queue.length > 0) {
      const devInfo = devMap.get(id);
      allMessages.push(...queue.map(m => ({ 
        ...m, 
        deviceId: id,
        dualAppTarget: m.dualAppTarget || devInfo?.dualAppTarget,
        targetPackage: m.targetPackage || devInfo?.targetPackage
      })));
      pendingAgentMessages.set(id, []);
    }
  }

  res.json({ success: true, messages: allMessages });
};

// 4. Update message status logic (shared by HTTP and WebSocket)
export const processMessageStatus = async (messageId: string, status: string, error?: string, deviceStatus?: string) => {
  console.log(`[Android Agent] Message/Task ${messageId} status: ${status} ${error ? `(${error})` : ''} ${deviceStatus ? `[Device: ${deviceStatus}]` : ''}`);

  // Check group join tasks
  const gTask = groupJoinTasks.find(t => t.id === messageId);
  if (gTask) {
    gTask.status = (status === 'SENT' || status === 'JOINED' || status === 'SUCCESS') ? 'SUCCESS' : 'FAILED';
    gTask.error = error || undefined;
    gTask.updatedAt = new Date();
  }

  // Resolve any synchronous HTTP request waiting for this message
  if (messageId && agentMessageResolvers.has(messageId)) {
    const waiter = agentMessageResolvers.get(messageId)!;
    clearTimeout(waiter.timer);
    agentMessageResolvers.delete(messageId);
    waiter.resolve({
      status: (status === 'SENT' || status === 'JOINED' || status === 'SUCCESS') ? 'SENT' : 'FAILED',
      error: error || undefined
    });
  }

  if (messageId) {
    try {
      const finalStatus = (status === 'SENT' || status === 'JOINED' || status === 'SUCCESS') ? 'SENT' : 'FAILED';

      const existingLog = await prisma.messageLog.findUnique({
        where: { id: messageId }
      });

      await prisma.messageLog.updateMany({
        where: { id: messageId },
        data: {
          status: finalStatus,
          error: error || null
        }
      });

      // Sync with Bulk Campaign message if applicable
      const bulkMsg = await prisma.bulkMessage.findUnique({
        where: { id: messageId }
      });
      if (bulkMsg) {
        await prisma.bulkMessage.update({
          where: { id: messageId },
          data: {
            status: finalStatus,
            sentAt: finalStatus === 'SENT' ? new Date() : null,
            error: error || null
          }
        });
        if (finalStatus === 'SENT') {
          await prisma.bulkJob.update({
            where: { id: bulkMsg.jobId },
            data: { sent: { increment: 1 } }
          });
        } else {
          await prisma.bulkJob.update({
            where: { id: bulkMsg.jobId },
            data: { failed: { increment: 1 } }
          });
        }
      }

      // Handle Device Suspended & Circuit Breaker (Auto-Stop for Bulk Jobs)
      if (finalStatus === 'FAILED' && existingLog) {
        const isSuspended = deviceStatus === 'SUSPENDED' || 
          error?.includes('banned') || 
          error?.includes('ditangguhkan') || 
          error?.includes('dibatasi');

        if (isSuspended) {
          console.warn(`[Android Agent] Device ${existingLog.deviceId} suspended/banned by WhatsApp! Marking paused & disconnected.`);
          await prisma.device.updateMany({
            where: { id: existingLog.deviceId },
            data: { isPaused: true, status: 'DISCONNECTED' }
          });

          // If it was part of a bulk campaign, pause the broadcast so it doesn't keep failing
          if (bulkMsg) {
            console.error(`[Circuit Breaker] Bulk broadcast device suspended. Pausing job ${bulkMsg.jobId}.`);
            await prisma.bulkJob.update({
              where: { id: bulkMsg.jobId },
              data: { status: 'PAUSED' }
            });
          }
        }
      }
    } catch (e: any) {
      console.error('Failed to update message status in DB:', e.message);
    }
  }
};

// Wire up WebSocket handler
setAgentWsStatusHandler(processMessageStatus);

export const updateMessageStatus = async (req: Request, res: Response) => {
  const { messageId, status, error, deviceStatus } = req.body;
  await processMessageStatus(messageId, status, error, deviceStatus);
  res.json({ success: true });
};

// 5. Disconnect Android Agent device(s)
export const disconnectAgent = async (req: Request, res: Response) => {
  const { deviceId, deviceIds } = req.body;
  const targetIds: string[] = deviceIds || (deviceId ? [deviceId] : []);

  if (targetIds.length > 0) {
    try {
      await prisma.device.updateMany({
        where: { id: { in: targetIds } },
        data: { status: 'DISCONNECTED' }
      });
      console.log(`[Android Agent] Device(s) disconnected: ${targetIds.join(', ')}`);
    } catch (e: any) {
      console.error('Failed to update disconnect status:', e.message);
    }
  }

  res.json({ success: true, message: 'Agent disconnected successfully' });
};

// 6. Join groups queue (Warmup Auto-Join Groups)
export const joinGroupBatch = async (req: Request, res: Response) => {
  const { deviceIds = [], groupLinks = [] } = req.body;

  if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
    return res.status(400).json({ success: false, error: 'Pilih minimal satu perangkat (deviceId).' });
  }

  if (!Array.isArray(groupLinks) || groupLinks.length === 0) {
    return res.status(400).json({ success: false, error: 'Masukkan minimal satu tautan grup WhatsApp.' });
  }

  // Clean URLs
  const cleanUrls = groupLinks
    .map((l: string) => l.trim())
    .filter((l: string) => l.includes('chat.whatsapp.com/'));

  if (cleanUrls.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Format tautan grup tidak valid. Harus mengandung tautan seperti https://chat.whatsapp.com/KODE_UNDANGAN' 
    });
  }

  const devices = await prisma.device.findMany({
    where: { id: { in: deviceIds } }
  });

  let enqueuedCount = 0;
  let staggerMs = 0;

  for (const dev of devices) {
    let isAndroidAgent = false;
    try {
      if (dev.sessionData && JSON.parse(dev.sessionData).type === 'ANDROID_AGENT') {
        isAndroidAgent = true;
      }
    } catch (e) {}

    for (const url of cleanUrls) {
      const taskId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      if (isAndroidAgent) {
        enqueueAgentGroupJoin(dev.id, taskId, url, dev.name);
      } else {
        // Direct execution via worker for Web Scan QR sessions with human staggered delay (5s per join)
        executeWorkerGroupJoin(dev.id, taskId, url, dev.name, staggerMs);
        staggerMs += 5000;
      }
      enqueuedCount++;
    }
  }

  res.json({
    success: true,
    message: `Berhasil menjadwalkan ${enqueuedCount} tugas auto-join ke grup untuk ${devices.length} perangkat.`,
    tasksCount: enqueuedCount
  });
};

// 7. Get Group Tasks
export const getGroupTasksList = async (req: Request, res: Response) => {
  res.json({ success: true, tasks: groupJoinTasks });
};

// 8. Clear Group Tasks History
export const clearGroupTasks = async (req: Request, res: Response) => {
  groupJoinTasks.length = 0;
  res.json({ success: true, message: 'Riwayat antrean grup berhasil dibersihkan.' });
};

// 9. Agent In-App OTA Update Check
export const checkAgentUpdate = async (req: Request, res: Response) => {
  res.json({
    success: true,
    latestVersionCode: 15,
    latestVersionName: '1.7.5',
    downloadUrl: 'https://github.com/lklock17/wagtw/releases/download/android-agent-latest/app-debug.apk',
    releaseNotes: '• Fixed Keystore Signature (Mencegah konflik tanda tangan saat update)\n• Kompatibilitas installer Android 10-14 & HyperOS/MIUI/OneUI\n• WebSocket Realtime 0ms Instan',
    minSupportedVersionCode: 10
  });
};
