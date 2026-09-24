import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';

export const getThreads = async (req: Request, res: Response) => {
  const { deviceId } = req.query;

  const where: any = {
    NOT: {
      remoteNumber: { contains: 'status@' }
    }
  };

  if (deviceId && typeof deviceId === 'string' && deviceId !== 'all') {
    where.deviceId = deviceId;
  }

  const threads = await prisma.inboxThread.findMany({
    where,
    include: {
      device: {
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          status: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(threads);
};

export const getMessages = async (req: Request, res: Response) => {
  const { threadId } = req.params;
  const messages = await prisma.inboxMessage.findMany({
    where: { threadId },
    orderBy: { timestamp: 'asc' }
  });
  res.json(messages);
};

export const markAsRead = async (req: Request, res: Response) => {
  const { threadId } = req.params;
  await prisma.inboxThread.update({
    where: { id: threadId },
    data: { unreadCount: 0 }
  });
  res.json({ success: true });
};
