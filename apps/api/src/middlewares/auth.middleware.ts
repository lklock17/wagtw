import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@wagtw/database';

const JWT_SECRET = process.env.JWT_SECRET || 'wagtw_secret_key_123';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Check x-api-key header first (for external apps)
  const apiKeyHeader = (req.headers['x-api-key'] || req.headers['api-key']) as string;
  if (apiKeyHeader) {
    try {
      const client = await prisma.client.findUnique({
        where: { apiKey: apiKeyHeader }
      });
      if (client) {
        (req as any).client = client;
        return next();
      }
    } catch (e) {
      // Continue to check JWT
    }
  }

  // Check Bearer Token (can be JWT or API Key)
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please provide either Authorization: Bearer <token> or x-api-key: <your_api_key>'
    });
  }

  // 1. Try checking as client API key
  try {
    const client = await prisma.client.findUnique({
      where: { apiKey: token }
    });
    if (client) {
      (req as any).client = client;
      return next();
    }
  } catch (e) {
    // Continue
  }

  // 2. Try checking as JWT token (for Admin UI)
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token / API key' });
  }
};
