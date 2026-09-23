import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';

export const getRules = async (req: Request, res: Response) => {
  const rules = await prisma.autoReplyRule.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(rules);
};

export const createRule = async (req: Request, res: Response) => {
  const { keyword, response, isAi, cooldown } = req.body;
  const rule = await prisma.autoReplyRule.create({
    data: { 
      keyword, 
      response, 
      isAi: Boolean(isAi), 
      cooldown: Number(cooldown) 
    }
  });
  res.json(rule);
};

export const deleteRule = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.autoReplyRule.delete({ where: { id } });
  res.json({ success: true });
};

export const updateRule = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { keyword, response, isAi, cooldown, isActive } = req.body;
  
  try {
    const rule = await prisma.autoReplyRule.update({
      where: { id },
      data: {
        ...(keyword !== undefined ? { keyword } : {}),
        ...(response !== undefined ? { response } : {}),
        ...(isAi !== undefined ? { isAi: Boolean(isAi) } : {}),
        ...(cooldown !== undefined ? { cooldown: Number(cooldown) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      }
    });
    res.json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
