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
