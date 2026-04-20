import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';
import fs from 'fs';
import path from 'path';

export const getMedia = async (req: Request, res: Response) => {
  const media = await prisma.media.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(media);
};

export const uploadMedia = async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { originalname, filename, mimetype, size } = req.file;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const url = `${baseUrl}/uploads/${filename}`;

  let type = 'DOCUMENT';
  if (mimetype.startsWith('image/')) type = 'IMAGE';
  if (mimetype.startsWith('video/')) type = 'VIDEO';
  if (mimetype.startsWith('audio/')) type = 'AUDIO';

  const media = await prisma.media.create({
    data: {
      name: originalname,
      url,
      type,
      mimeType: mimetype,
      size
    }
  });

  res.json(media);
};

export const deleteMedia = async (req: Request, res: Response) => {
  const { id } = req.params;
  const media = await prisma.media.findUnique({ where: { id } });
  
  if (media) {
    const filename = media.url.split('/').pop();
    const filepath = path.join(__dirname, '../../uploads', filename!);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    
    await prisma.media.delete({ where: { id } });
  }

  res.json({ success: true });
};
