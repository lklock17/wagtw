import axios from 'axios';
import { prisma } from '@wagtw/database';

const DEFAULT_BASE_URL = process.env.AI_BASE_URL || 'http://103.89.2.102:20128/v1';
const DEFAULT_API_KEY = process.env.AI_API_KEY || 'sk-abf54a1d39290d81-l74lwh-ac3e8eda';
const DEFAULT_MODEL = process.env.AI_MODEL || 'mistral/mistral-large-latest';

class AIService {
  async generateResponse(prompt: string, customSystemPrompt?: string): Promise<string | null> {
    try {
      // 1. Fetch AI config from DB or fallback to default 9routes
      const config = await prisma.warmupConfig.findFirst({ where: { id: 'default' } });
      const url = (config?.aiBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
      const key = config?.aiApiKey || DEFAULT_API_KEY;
      const model = config?.aiModel || DEFAULT_MODEL;

      const systemPrompt = customSystemPrompt || 
        "Anda adalah asisten WhatsApp otomatis yang ramah, sopan, dan sigap membantu. Berikan jawaban yang akurat, padat, dan bahasa Indonesia yang baik.";

      const response = await axios.post(
        `${url}/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: 350,
          temperature: 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`
          },
          timeout: 15000,
          responseType: 'text'
        }
      );

      let rawData = response.data;
      if (typeof rawData === 'string') {
        const cleaned = rawData.split('data: [DONE]')[0].trim();
        try {
          const parsed = JSON.parse(cleaned);
          return parsed.choices?.[0]?.message?.content?.trim() || null;
        } catch {
          const match = rawData.match(/"content"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
          if (match && match[1]) {
            return JSON.parse(`"${match[1]}"`).trim();
          }
        }
      } else if (typeof rawData === 'object' && (rawData as any)?.choices?.[0]?.message?.content) {
        return (rawData as any).choices[0].message.content.trim();
      }

      return null;
    } catch (error: any) {
      console.error('9routes AI Error:', error.response?.data || error.message);
      return null;
    }
  }
}

export const aiService = new AIService();
