import express from 'express';
import dotenv from 'dotenv';
import { waManager } from './services/whatsapp';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'Worker is running' });
});

// Endpoint for API to trigger session creation
app.post('/sessions/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  // Non-blocking
  waManager.createSession(id, name);
  
  res.json({ message: 'Session initialization started' });
});

// Endpoint for sending messages
app.post('/messages/send', async (req, res) => {
  const { deviceId, to, text, type, url, caption } = req.body;
  
  const client = await waManager.getClient(deviceId);
  if (!client) return res.status(404).json({ error: 'Session not found for device' });

  try {
    let result;
    if (type === 'IMAGE' && url) {
      result = await client.sendImage(to, url, 'image-name', caption);
    } else if (type === 'VIDEO' && url) {
      result = await client.sendVideoAsGif(to, url, 'video-name', caption);
    } else {
      result = await client.sendText(to, text);
    }
    
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  console.log(`👷 Worker Server ready at http://localhost:${PORT}`);
  
  // Initialize existing sessions
  await waManager.init();
});
