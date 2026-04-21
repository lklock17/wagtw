import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import axios from 'axios';
import { prisma } from '@wagtw/database';
import routes from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use('/uploads', express.static(uploadsDir));

app.get('/', (req, res) => {
  res.json({ message: 'WAGTW API is running', version: '1.0.0' });
});

app.use('/api', routes);

// Scheduled Messages Worker (Every 1 minute)
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const dueMessages = await prisma.scheduledMessage.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: now }
    }
  });

  const WORKER_URL = process.env.WORKER_URL || 'http://localhost:4001';

  for (const msg of dueMessages) {
    try {
      await axios.post(`${WORKER_URL}/messages/send`, {
        deviceId: msg.deviceId,
        to: msg.to,
        text: msg.body
      });

      await prisma.scheduledMessage.update({
        where: { id: msg.id },
        data: { status: 'SENT' }
      });
      console.log(`✅ Scheduled message sent to ${msg.to}`);
    } catch (error: any) {
      await prisma.scheduledMessage.update({
        where: { id: msg.id },
        data: { status: 'FAILED', error: error.message }
      });
      console.error(`❌ Failed to send scheduled message: ${error.message}`);
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API Server ready at http://localhost:${PORT}`);
});
