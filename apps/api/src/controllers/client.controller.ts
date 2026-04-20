import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';

export const getClients = async (req: Request, res: Response) => {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(clients);
};

export const createClient = async (req: Request, res: Response) => {
  const { name, rateLimit } = req.body;
  const client = await prisma.client.create({
    data: { name, rateLimit: Number(rateLimit) }
  });
  res.json(client);
};

export const deleteClient = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.client.delete({ where: { id } });
  res.json({ success: true });
};
