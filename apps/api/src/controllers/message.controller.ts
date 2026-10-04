import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';
import axios from 'axios';
import { enqueueAgentMessage, waitForAgentMessage } from './agent.controller';

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

  // Fetch all currently connected and unpaused devices
  const connectedDevices = await prisma.device.findMany({
    where: { status: 'CONNECTED', isPaused: false },
    orderBy: { createdAt: 'asc' }
  });

  if (connectedDevices.length === 0) {
    return res.status(503).json({
      success: false,
      error: 'Tidak ada perangkat WhatsApp yang aktif (CONNECTED dan tidak dijeda). Silakan aktifkan/hubungkan minimal satu perangkat di dashboard.'
    });
  }

  // Helper to distinguish physical Android Agent devices from QR Web devices
  const isAgentDevice = (d: any): boolean => {
    try {
      const s = JSON.parse(d.sessionData || '{}');
      return s.type === 'ANDROID_AGENT';
    } catch (e) {
      return d.sessionData?.includes('ANDROID_AGENT') || false;
    }
  };

  // Partition devices: Physical Android Phones (Priority 1) vs QR Web Sessions (Fallback)
  const agentDevices = connectedDevices.filter(d => isAgentDevice(d));
  const qrWebDevices = connectedDevices.filter(d => !isAgentDevice(d));

  // Determine candidate devices queue
  let candidateQueue: typeof connectedDevices = [];

  const isRotationRequested = autoRotate || !deviceId || deviceId === 'auto' || deviceId === 'rotate';

  if (!isRotationRequested) {
    // Specific device requested - check if it's paused
    const targetDevice = await prisma.device.findUnique({ where: { id: deviceId } });
    if (targetDevice?.isPaused) {
      return res.status(400).json({
        success: false,
        error: `Perangkat '${targetDevice.name}' sedang dalam status DIJEDA (Paused). Aktifkan perangkat terlebih dahulu untuk mengirim pesan.`
      });
    }

    const requestedDevice = connectedDevices.find((d) => d.id === deviceId);
    if (requestedDevice) {
      candidateQueue = [requestedDevice];
      if (failover) {
        // Fallback order: other Android agent phones first, then QR Web devices!
        const otherAgents = agentDevices.filter((d) => d.id !== deviceId);
        const otherQrWeb = qrWebDevices.filter((d) => d.id !== deviceId);
        candidateQueue.push(...otherAgents, ...otherQrWeb);
      }
    } else {
      if (failover) {
        // Device not connected/found: fallback to Android phones first, then QR Web devices!
        candidateQueue = [...agentDevices, ...qrWebDevices];
      } else {
        return res.status(400).json({
          success: false,
          error: `Specified device '${deviceId}' is not connected, paused, or not found.`
        });
      }
    }
  } else {
    // Auto-Rotate round-robin: ALWAYS prioritize physical Android phones!
    // Only if all Android phones fail will it fall back to QR Web devices.
    if (agentDevices.length > 0) {
      rotationIndex = rotationIndex % agentDevices.length;
      const rotatedAgents = [
        ...agentDevices.slice(rotationIndex),
        ...agentDevices.slice(0, rotationIndex)
      ];
      rotationIndex = (rotationIndex + 1) % agentDevices.length;
      // Primary: Rotated Android phones; Secondary (Failover): QR Web devices
      candidateQueue = [...rotatedAgents, ...qrWebDevices];
    } else {
      // If no Android phones are connected/unpaused, use QR Web devices
      rotationIndex = rotationIndex % qrWebDevices.length;
      const rotatedWeb = [
        ...qrWebDevices.slice(rotationIndex),
        ...qrWebDevices.slice(0, rotationIndex)
      ];
      rotationIndex = (rotationIndex + 1) % qrWebDevices.length;
      candidateQueue = rotatedWeb;
    }
  }

  let lastError: any = null;
  let attempts = 0;

  // Try candidate devices sequentially (Failover loop)
  for (const device of candidateQueue) {
    attempts++;
    try {
      let sessionInfo: any = null;
      try {
        if (device.sessionData) sessionInfo = JSON.parse(device.sessionData);
      } catch (e) {}

      // Handle Android Agent physical phone relay (Synchronous Await)
      if (sessionInfo?.type === 'ANDROID_AGENT') {
        const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        await prisma.messageLog.create({
          data: {
            id: msgId,
            deviceId: device.id,
            clientId: (req as any).client?.id || null,
            to: recipient,
            body: content || caption || 'Media Message',
            type: type as any,
            status: 'PENDING'
          }
        });

        enqueueAgentMessage(device.id, msgId, recipient, content || caption || '');

        // Wait for the physical phone agent to execute and report real result (up to 35s)
        const agentResult = await waitForAgentMessage(msgId, 35000);

        if (agentResult.status === 'SENT') {
          return res.json({
            success: true,
            status: 'SENT',
            message: 'Pesan berhasil terkirim dari WhatsApp ponsel!',
            data: {
              messageId: msgId,
              recipient,
              status: 'SENT',
              sentVia: {
                deviceId: device.id,
                deviceName: device.name,
                phoneNumber: device.phoneNumber,
                type: 'ANDROID_AGENT'
              },
              autoRotated: isRotationRequested,
              failoverTriggered: attempts > 1,
              attemptCount: attempts
            }
          });
        } else {
          lastError = agentResult.error || 'Pesan gagal dikirim oleh WhatsApp ponsel';
          console.warn(`[Failover] Agent device ${device.name} failed: ${lastError}.`);

          // CRITICAL ANTI-DUPLICATION RULE:
          // If the message was already queued and sent to an active Android phone,
          // DO NOT failover to Web QR if the reason is a timeout or if the recipient number was invalid.
          // Doing so will cause the recipient to receive duplicate messages because the phone might still complete the send!
          const isTerminalNumberError = lastError.includes('tidak terdaftar') || lastError.includes('invalid') || lastError.includes('tidak valid');
          const isTimeoutError = lastError.includes('Timeout');

          if (isTerminalNumberError) {
            // Target number is not on WhatsApp, trying other devices will only fail and risk account ban
            return res.status(400).json({
              success: false,
              status: 'FAILED',
              error: lastError,
              data: {
                messageId: msgId,
                recipient,
                status: 'FAILED',
                sentVia: {
                  deviceId: device.id,
                  deviceName: device.name,
                  phoneNumber: device.phoneNumber,
                  type: 'ANDROID_AGENT'
                },
                failoverTriggered: attempts > 1,
                attemptCount: attempts
              }
            });
          }

          if (isTimeoutError) {
            // Suppress failover to QR to prevent duplicate send!
            console.warn(`[Anti-Duplication] Message ${msgId} timed out on ${device.name}. Suppressing failover to QR to prevent duplicate send.`);
            return res.status(504).json({
              success: false,
              status: 'TIMEOUT',
              error: 'WhatsApp ponsel sedang memproses antrean pesan (timeout 35 detik). Pengalihan ke nomor lain dibatalkan demi mencegah pesan terkirim dobel.',
              data: {
                messageId: msgId,
                recipient,
                status: 'TIMEOUT',
                sentVia: {
                  deviceId: device.id,
                  deviceName: device.name,
                  phoneNumber: device.phoneNumber,
                  type: 'ANDROID_AGENT'
                },
                failoverTriggered: false,
                attemptCount: attempts
              }
            });
          }

          // If failover is enabled and there are other candidate devices, try next device
          if (failover && attempts < candidateQueue.length) {
            continue;
          }

          return res.status(400).json({
            success: false,
            status: 'FAILED',
            error: lastError,
            data: {
              messageId: msgId,
              recipient,
              status: 'FAILED',
              sentVia: {
                deviceId: device.id,
                deviceName: device.name,
                phoneNumber: device.phoneNumber,
                type: 'ANDROID_AGENT'
              },
              failoverTriggered: attempts > 1,
              attemptCount: attempts
            }
          });
        }
      }

      const response = await axios.post(`${WORKER_URL}/messages/send`, {
        deviceId: device.id,
        to: recipient,
        text: content,
        type,
        url,
        caption
      }, { timeout: 30000 });

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
