import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';
import axios from 'axios';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:4011';
let rotationIndex = 0;

// Helper to sanitize phone numbers
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

export const sendMessage = async (req: Request, res: Response) => {
  const { 
    deviceId, 
    to, 
    text, 
    message, 
    type = 'TEXT', 
    url, 
    caption,
    autoRotate = false,
    failover = true,
    delay
  } = req.body;

  const content = text || message;
  if (!to || (!content && !url)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: "to" and ("text" or "message") are required' 
    });
  }

  // If delay is specified (in seconds), pause before sending
  if (delay && Number(delay) > 0) {
    const delayMs = Math.min(Number(delay) * 1000, 300000); // cap at 5 minutes
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const recipient = formatPhoneNumber(to);

  // Fetch all currently connected devices
  const connectedDevices = await prisma.device.findMany({
    where: { status: 'CONNECTED' },
    orderBy: { createdAt: 'asc' }
  });

  if (connectedDevices.length === 0) {
    return res.status(503).json({
      success: false,
      error: 'No active WhatsApp devices connected. Please connect at least one device on the dashboard.'
    });
  }

  // Determine candidate devices queue
  let candidateQueue: typeof connectedDevices = [];

  const isRotationRequested = autoRotate || !deviceId || deviceId === 'auto' || deviceId === 'rotate';

  if (!isRotationRequested) {
    // Specific device requested
    const requestedDevice = connectedDevices.find((d) => d.id === deviceId);
    if (requestedDevice) {
      candidateQueue = [requestedDevice];
      if (failover) {
        // Add other connected devices as fallback
        const otherDevices = connectedDevices.filter((d) => d.id !== deviceId);
        candidateQueue.push(...otherDevices);
      }
    } else {
      if (failover) {
        // Device not connected/found, fallback to other connected devices
        candidateQueue = [...connectedDevices];
      } else {
        return res.status(400).json({
          success: false,
          error: `Specified device '${deviceId}' is not connected or not found.`
        });
      }
    }
  } else {
    // Auto-Rotate round-robin across connected devices
    rotationIndex = rotationIndex % connectedDevices.length;
    const rotated = [
      ...connectedDevices.slice(rotationIndex),
      ...connectedDevices.slice(0, rotationIndex)
    ];
    candidateQueue = rotated;
    rotationIndex = (rotationIndex + 1) % connectedDevices.length;
  }

  let lastError: any = null;
  let attempts = 0;

  // Try candidate devices sequentially (Failover loop)
  for (const device of candidateQueue) {
    attempts++;
    try {
      const response = await axios.post(`${WORKER_URL}/messages/send`, {
        deviceId: device.id,
        to: recipient,
        text: content,
        type,
        url,
        caption
      }, { timeout: 15000 });

      // Log success to database
      await prisma.messageLog.create({
        data: {
          deviceId: device.id,
          clientId: (req as any).client?.id || null,
          to: recipient,
          body: content || caption || 'Media Message',
          type: type as any,
          status: 'SENT'
        }
      });

      return res.json({
        success: true,
        message: 'Message dispatched successfully',
        data: {
          recipient,
          sentVia: {
            deviceId: device.id,
            deviceName: device.name,
            phoneNumber: device.phoneNumber
          },
          autoRotated: isRotationRequested,
          failoverTriggered: attempts > 1,
          attemptCount: attempts,
          workerResult: response.data
        }
      });
    } catch (err: any) {
      lastError = err.response?.data?.error || err.message;
      console.warn(`[Failover] Device ${device.name} (${device.id}) failed to send: ${lastError}. Trying next...`);
      
      // If error indicates session disconnected, optionally check device status
      if (err.response?.status === 404) {
        prisma.device.update({
          where: { id: device.id },
          data: { status: 'DISCONNECTED' }
        }).catch(() => {});
      }
    }
  }

  // If all candidates in queue failed
  await prisma.messageLog.create({
    data: {
      deviceId: candidateQueue[0]?.id || 'unknown',
      clientId: (req as any).client?.id || null,
      to: recipient,
      body: content || caption || 'Media Message',
      type: type as any,
      status: 'FAILED',
      error: `All ${attempts} available devices failed to send. Last error: ${lastError}`
    }
  });

  return res.status(500).json({
    success: false,
    error: 'Failed to send message through any available connected device',
    details: lastError,
    attempts
  });
};

export const checkNumberGlobal = async (req: Request, res: Response) => {
  const { phone, deviceId } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, error: 'Nomor telepon ("phone") wajib diisi' });
  }

  // Find an active connected device
  const connectedDevice = deviceId
    ? await prisma.device.findFirst({ where: { id: deviceId, status: 'CONNECTED' } })
    : await prisma.device.findFirst({ where: { status: 'CONNECTED' }, orderBy: { updatedAt: 'desc' } });

  if (!connectedDevice) {
    return res.status(503).json({
      success: false,
      error: 'Tidak ada perangkat WhatsApp yang aktif (CONNECTED) untuk memeriksa nomor ini.'
    });
  }

  try {
    const response = await axios.post(
      `${WORKER_URL}/devices/${connectedDevice.id}/check-number`,
      { phone },
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message
    });
  }
};
