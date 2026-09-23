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

app.listen(PORT, async () => {
  console.log(`👷 Worker Server ready at http://localhost:${PORT}`);
  
  // Initialize existing sessions
  await waManager.init();
});
