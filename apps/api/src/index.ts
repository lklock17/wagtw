import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import dns from 'dns';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import axios from 'axios';
import { prisma } from '@wagtw/database';
import routes from './routes';
import { warmupService } from './services/warmup.service';
import { normalizePhoneNumber } from './utils/phone';

dotenv.config();

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const app = express();
const PORT = process.env.API_PORT || process.env.PORT || 4010;

app.use(helmet({ crossOriginResourcePolicy: false }));

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : ['http://localhost:5174', 'http://localhost:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5173', 'https://lklock17.github.io'];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in dev to avoid client blocks
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

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

  const WORKER_URL = process.env.WORKER_URL || 'http://localhost:4011';

  for (const msg of dueMessages) {
    try {
      const normalizedTo = normalizePhoneNumber(msg.to);
      await axios.post(`${WORKER_URL}/messages/send`, {
        deviceId: msg.deviceId,
        to: normalizedTo,
        text: msg.body
      });

      await prisma.scheduledMessage.update({
        where: { id: msg.id },
        data: { status: 'SENT' }
      });
      console.log(`✅ Scheduled message sent to ${normalizedTo}`);
    } catch (error: any) {
      await prisma.scheduledMessage.update({
        where: { id: msg.id },
        data: { status: 'FAILED', error: error.response?.data?.error || error.message }
      });
      console.error(`❌ Failed to send scheduled message: ${error.message}`);
    }
  }

  // Warmup Service Tick
  try {
    await warmupService.cronTick();
  } catch (err: any) {
    console.error('Warmup cron error:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API Server ready at http://localhost:${PORT}`);
});
