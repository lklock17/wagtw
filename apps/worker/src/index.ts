import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import dns from 'dns';
import { waManager } from './services/whatsapp';
import { formatToWhatsAppJid } from './utils/phone';

dotenv.config();

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const app = express();
const PORT = process.env.WORKER_PORT || 4011;

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'Worker is running', port: PORT });
});

// Endpoint for API to trigger session creation (supports /sessions/:id and /sessions/init)
const handleSessionCreate = async (req: Request, res: Response) => {
  const id = (req.params.id || req.body.deviceId) as string;
  const name = (req.body.name || req.body.sessionName || id) as string;

  if (!id) {
    return res.status(400).json({ error: 'deviceId is required' });
  }

  // If session is already alive in memory, try instant QR refresh first
  const refreshed = await waManager.refreshQr(id);
  if (!refreshed) {
    // Non-blocking sequential queue for launching new browser
    waManager.enqueueSession(id, name, false);
  }

  res.json({ message: 'Session initialization queued', deviceId: id, fastRefreshed: refreshed });
};

app.post('/sessions/:id', handleSessionCreate);
app.post('/sessions/init', handleSessionCreate);

// Endpoint to logout and remove session
app.delete('/sessions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await waManager.logout(id);
    res.json({ success: true, message: 'Session closed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/sessions/:id/logout', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await waManager.logout(id);
    res.json({ success: true, message: 'Session closed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint for sending messages
app.post('/messages/send', async (req, res) => {
  const { deviceId, to, text, type, url, caption } = req.body;
  
  if (!deviceId || !to) {
    return res.status(400).json({ error: 'deviceId and to are required' });
  }

  const startTime = Date.now();
  console.log(`[Worker /messages/send] Incoming dispatch request for device ${deviceId} to ${to}`);

  const client = await waManager.getClient(deviceId);
  if (!client) {
    console.warn(`[Worker /messages/send] Session not found or disconnected for device ${deviceId}`);
    return res.status(404).json({ error: 'Session not found for device' });
  }

  // Auto-detect and format phone number to proper WhatsApp JID
  const jid = formatToWhatsAppJid(to);

  try {
    // Non-blocking human typing simulation (lightweight jitter 400-800ms)
    try {
      if (typeof (client as any).startTyping === 'function') {
        const textLen = (text || caption || '').length;
        const typingDuration = Math.min(Math.max(textLen * 20, 400), 1000);
        (client as any).startTyping(jid, typingDuration).catch(() => {});
        await new Promise((r) => setTimeout(r, Math.min(typingDuration, 600)));
        if (typeof (client as any).stopTyping === 'function') {
          (client as any).stopTyping(jid).catch(() => {});
        }
      }
    } catch (tErr) {
      // Non-blocking
    }

    const sendWithTimeout = async () => {
      if (type === 'IMAGE' && url) {
        return await client.sendImage(jid, url, 'image-name', caption);
      } else if (type === 'VIDEO' && url) {
        return await client.sendVideoAsGif(jid, url, 'video-name', caption);
      } else {
        return await client.sendText(jid, text);
      }
    };

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('WhatsApp client timed out sending message after 30s')), 30000)
    );

    const result = await Promise.race([sendWithTimeout(), timeoutPromise]);
    
    console.log(`[Worker /messages/send] Message sent successfully to ${jid} via ${deviceId} in ${Date.now() - startTime}ms`);
    res.json({ success: true, result, jid });
  } catch (error: any) {
    const errText = error?.message || String(error);
    console.error(`Failed to send message via worker to ${jid}:`, errText);
    if (errText.includes('timed out') || errText.includes('Target closed') || errText.includes('protocolTimeout')) {
      waManager.evictAuthenticatedSession(deviceId);
    }
    res.status(500).json({ error: errText || 'Failed to send message via worker' });
  }
});

// Endpoint to join a WhatsApp group via invite link or code
app.post('/groups/join', async (req: Request, res: Response) => {
  const { deviceId, inviteUrl } = req.body;

  if (!deviceId || !inviteUrl) {
    return res.status(400).json({ error: 'deviceId and inviteUrl are required' });
  }

  const client = await waManager.getClient(deviceId);
  if (!client) {
    return res.status(404).json({ error: 'Device session not active or not connected' });
  }

  try {
    let inviteCode = inviteUrl.trim();
    if (inviteCode.includes('chat.whatsapp.com/')) {
      inviteCode = inviteCode.split('chat.whatsapp.com/')[1].replace('invite/', '').split('?')[0].split('/')[0];
    }

    console.log(`[Worker] Device ${deviceId} attempting to join group with code: ${inviteCode}`);
    const result = await (client as any).joinGroup(inviteCode);
    console.log(`[Worker] Device ${deviceId} successfully joined group:`, result);

    res.json({ success: true, result });
  } catch (error: any) {
    console.error(`[Worker] Device ${deviceId} failed to join group:`, error.message);
    res.status(500).json({ success: false, error: error.message || 'Gagal bergabung ke grup' });
  }
});

// Endpoint to check if phone number is registered & active on WhatsApp
app.post('/devices/:deviceId/check-number', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'phone is required' });
  }

  const client = await waManager.getClient(deviceId);
  if (!client) {
    return res.status(404).json({ error: 'Device session not active or not connected' });
  }

  const jid = formatToWhatsAppJid(phone);

  try {
    const profile = await client.checkNumberStatus(jid);
    const isValid = Boolean(profile && ((profile as any).numberExists !== false && profile.status === 200));

    res.json({
      success: true,
      phone,
      jid,
      isValid,
      isBusiness: Boolean((profile as any)?.isBusiness),
      canReceiveMessage: Boolean((profile as any)?.canReceiveMessage !== false),
      raw: profile
    });
  } catch (error: any) {
    console.error(`Failed to check number status for ${phone}:`, error.message);
    res.status(500).json({ success: false, error: error.message, phone });
  }
});

// Endpoint to request 8-digit Pairing Code for phone linking
app.post('/devices/:deviceId/pairing-code', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'phone is required' });
  }

  try {
    const code = await waManager.requestPairingCode(deviceId, phone);
    res.json({ success: true, deviceId, phone, code, pairingCode: code });
  } catch (error: any) {
    console.error(`Failed to request pairing code for device ${deviceId}:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const server = app.listen(PORT, async () => {
  console.log(`👷 Worker Server ready at http://localhost:${PORT}`);
  
  // Initialize existing sessions
  await waManager.init();
});

const handleShutdown = async (signal: string) => {
  console.log(`\n🛑 Worker received ${signal}. Closing WhatsApp sessions gracefully...`);
  server.close();
  try {
    await waManager.shutdown();
  } catch (err: any) {
    console.error('Error during waManager.shutdown:', err.message);
  }
  process.exit(0);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

