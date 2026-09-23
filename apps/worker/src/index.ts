import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { waManager } from './services/whatsapp';
import { formatToWhatsAppJid } from './utils/phone';

dotenv.config();

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

  // Non-blocking
  waManager.createSession(id, name);
  res.json({ message: 'Session initialization started', deviceId: id });
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

  const client = await waManager.getClient(deviceId);
  if (!client) return res.status(404).json({ error: 'Session not found for device' });

  // Auto-detect and format phone number to proper WhatsApp JID
  const jid = formatToWhatsAppJid(to);

  try {
    // Humanized typing simulation before sending text (1.2s - 2.0s)
    try {
      if (typeof (client as any).startTyping === 'function') {
        const typingDuration = Math.floor(Math.random() * 800) + 1200;
        await (client as any).startTyping(jid, typingDuration);
        await new Promise((r) => setTimeout(r, typingDuration));
      }
    } catch (tErr) {
      // Non-blocking
    }

    let result;
    if (type === 'IMAGE' && url) {
      result = await client.sendImage(jid, url, 'image-name', caption);
    } else if (type === 'VIDEO' && url) {
      result = await client.sendVideoAsGif(jid, url, 'video-name', caption);
    } else {
      result = await client.sendText(jid, text);
    }
    
    res.json({ success: true, result, jid });
  } catch (error: any) {
    console.error(`Failed to send message via worker to ${jid}:`, error);
    res.status(500).json({ error: error?.message || 'Failed to send message via worker' });
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
    res.json({ success: true, deviceId, phone, code });
  } catch (error: any) {
    console.error(`Failed to request pairing code for device ${deviceId}:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, async () => {
  console.log(`👷 Worker Server ready at http://localhost:${PORT}`);
  
  // Initialize existing sessions
  await waManager.init();
});
