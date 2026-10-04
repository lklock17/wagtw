import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';
import axios from 'axios';
import { normalizePhoneNumber } from '../utils/phone';
import { enqueueAgentMessage } from './agent.controller';

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
    // Circuit Breaker check before each message
    const currentDevice = await prisma.device.findUnique({ where: { id: job.deviceId } });
    if (!currentDevice || currentDevice.status !== 'CONNECTED' || currentDevice.isPaused) {
      // Find fallback connected device, prioritizing physical Android Agent devices first
      const connectedCandidates = await prisma.device.findMany({
        where: { status: 'CONNECTED', isPaused: false, id: { not: job.deviceId } }
      });

      const fallbackAgent = connectedCandidates.find(d => {
        try {
          const s = JSON.parse(d.sessionData || '{}');
          return s.type === 'ANDROID_AGENT';
        } catch (e) {
          return d.sessionData?.includes('ANDROID_AGENT');
        }
      });

      const fallback = fallbackAgent || connectedCandidates[0];

      if (fallback) {
        console.log(`[Bulk Job ${jobId}] Failover: Switching from ${job.deviceId} to ${fallback.name} (${fallback.id})`);
        job.deviceId = fallback.id;
        await prisma.bulkJob.update({ where: { id: jobId }, data: { deviceId: fallback.id } });
      } else {
        console.error(`[Bulk Circuit Breaker] All devices are OFFLINE or PAUSED. Auto-stopping bulk job ${jobId}.`);
        await prisma.bulkJob.update({
          where: { id: jobId },
          data: { status: 'PAUSED' }
        });
        return;
      }
    }

    try {
      if (currentDevice?.sessionData?.includes('ANDROID_AGENT')) {
        // Queue to Android Agent phone relay - Do NOT mark SENT yet!
        enqueueAgentMessage(job.deviceId, msg.id, msg.to, msg.body);
        // Leave status as PENDING until phone reports back via updateMessageStatus
        await prisma.bulkMessage.update({
          where: { id: msg.id },
          data: { status: 'PENDING' }
        });
      } else {
        // Send via worker (Puppeteer Web Session)
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
      }

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
