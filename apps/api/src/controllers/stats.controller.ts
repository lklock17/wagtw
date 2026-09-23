import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';

export const getStats = async (req: Request, res: Response) => {
  try {
    const [totalDevices, activeDevices, totalMessagesSent, totalInboxMessages, totalClients] = await Promise.all([
      prisma.device.count(),
      prisma.device.count({ where: { status: 'CONNECTED' } }),
      prisma.messageLog.count(),
      prisma.inboxMessage.count(),
      prisma.client.count()
    ]);

    // Calculate last 7 days message counts
    const now = new Date();
    const last7Days: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

      const count = await prisma.messageLog.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });

      last7Days.push({
        day: startOfDay.toLocaleDateString('en-US', { weekday: 'short' }),
        count
      });
    }

    res.json({
      totalDevices,
      activeDevices,
      totalMessagesSent,
      totalInboxMessages,
      totalClients,
      volumeChart: last7Days
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
