import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';
import axios from 'axios';
import { normalizePhoneNumber } from '../utils/phone';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:4011';

export const createBulkJob = async (req: Request, res: Response) => {
  const { name, deviceId, contacts, body, delay } = req.body;

  try {
    const job = await prisma.bulkJob.create({
      data: {
        name,
        deviceId,
        total: contacts.length,
        delay: Number(delay) || 5,
        status: 'PENDING',
        messages: {
          create: contacts.map((to: string) => ({
            to: normalizePhoneNumber(to),
            body,
            status: 'PENDING'
          }))
        }
      },
      include: { messages: true }
    });

    // Start processing in background (Non-blocking)
    processBulkJob(job.id);

    res.json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create bulk job' });
  }
};

export const getBulkJobs = async (req: Request, res: Response) => {
  const jobs = await prisma.bulkJob.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { messages: true } } }
  });
  res.json(jobs);
};

export const getBulkJobStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const job = await prisma.bulkJob.findUnique({
    where: { id },
    include: { messages: true }
  });
  res.json(job);
};

// Background Processor
async function processBulkJob(jobId: string) {
  const job = await prisma.bulkJob.findUnique({
    where: { id: jobId },
    include: { messages: true }
  });

  if (!job) return;

  await prisma.bulkJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING' }
  });

  for (const msg of job.messages) {
    try {
      // Send to worker
      await axios.post(`${WORKER_URL}/messages/send`, {
        deviceId: job.deviceId,
        to: msg.to,
        text: msg.body
      });

      await prisma.bulkMessage.update({
        where: { id: msg.id },
        data: { status: 'SENT', sentAt: new Date() }
      });

      await prisma.bulkJob.update({
        where: { id: jobId },
        data: { sent: { increment: 1 } }
      });

    } catch (error: any) {
      await prisma.bulkMessage.update({
        where: { id: msg.id },
        data: { status: 'FAILED', error: error.message }
      });

      await prisma.bulkJob.update({
        where: { id: jobId },
        data: { failed: { increment: 1 } }
      });
    }

    // Humanized Dynamic Jitter Delay (delay + 1.5s - 5s random variation)
    const baseDelayMs = Math.max(job.delay || 5, 2) * 1000;
    const humanJitterMs = Math.floor(Math.random() * 3500) + 1500;
    await new Promise(resolve => setTimeout(resolve, baseDelayMs + humanJitterMs));
  }

  await prisma.bulkJob.update({
    where: { id: jobId },
    data: { status: 'COMPLETED' }
  });
}
