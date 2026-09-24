import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';

export const getThreads = async (req: Request, res: Response) => {
  const { deviceId, search, filterType } = req.query;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 15));
  const skip = (page - 1) * limit;

  const where: any = {
    NOT: {
      remoteNumber: { contains: 'status@' }
    }
  };

  if (deviceId && typeof deviceId === 'string' && deviceId !== 'all') {
    where.deviceId = deviceId;
  }

  if (filterType === 'channel') {
    where.remoteNumber = { endsWith: '@newsletter' };
  } else if (filterType === 'direct') {
    where.NOT = [
      ...(Array.isArray(where.NOT) ? where.NOT : [where.NOT]),
      { remoteNumber: { endsWith: '@newsletter' } },
      { remoteNumber: { endsWith: '@g.us' } }
    ];
  }

  if (search && typeof search === 'string' && search.trim()) {
    const s = search.trim();
    where.OR = [
      { contactName: { contains: s, mode: 'insensitive' } },
      { formattedNumber: { contains: s, mode: 'insensitive' } },
      { remoteNumber: { contains: s, mode: 'insensitive' } },
      { lastMessage: { contains: s, mode: 'insensitive' } }
    ];
  }

  const [total, threads] = await Promise.all([
    prisma.inboxThread.count({ where }),
    prisma.inboxThread.findMany({
      where,
      skip,
      take: limit,
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
    })
  ]);

  res.json({
    data: threads,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  });
};

export const getMessages = async (req: Request, res: Response) => {
  const { threadId } = req.params;
  const limit = Math.max(10, Math.min(100, parseInt(req.query.limit as string) || 40));
  const before = req.query.before as string;

  const where: any = { threadId };
  if (before) {
    where.timestamp = { lt: new Date(before) };
  }

  const [total, messages] = await Promise.all([
    prisma.inboxMessage.count({ where: { threadId } }),
    prisma.inboxMessage.findMany({
      where,
      take: limit,
      orderBy: { timestamp: 'desc' }
    })
  ]);

  // Reverse so they display in chronological order in the chat pane
  messages.reverse();

  res.json({
    data: messages,
    total,
    hasMore: total > messages.length
  });
};

export const markAsRead = async (req: Request, res: Response) => {
  const { threadId } = req.params;
  await prisma.inboxThread.update({
    where: { id: threadId },
    data: { unreadCount: 0 }
  });
  res.json({ success: true });
};
