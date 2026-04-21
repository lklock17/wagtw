import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';

export const getSchedules = async (req: Request, res: Response) => {
  const schedules = await prisma.scheduledMessage.findMany({
    include: { device: true },
    orderBy: { scheduledAt: 'asc' }
  });
  res.json(schedules);
};

export const createSchedule = async (req: Request, res: Response) => {
  const { deviceId, to, body, scheduledAt } = req.body;
  
  const schedule = await prisma.scheduledMessage.create({
    data: {
      deviceId,
      to,
      body,
      scheduledAt: new Date(scheduledAt),
      status: 'PENDING'
    }
  });
  
  res.json(schedule);
};

export const deleteSchedule = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.scheduledMessage.delete({ where: { id } });
  res.json({ success: true });
};
