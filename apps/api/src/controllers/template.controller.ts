import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';

export const getTemplates = async (req: Request, res: Response) => {
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(templates);
};

export const createTemplate = async (req: Request, res: Response) => {
  const { name, body, type } = req.body;
  const template = await prisma.template.create({
    data: { name, body, type }
  });
  res.json(template);
};

export const deleteTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.template.delete({ where: { id } });
  res.json({ success: true });
};
