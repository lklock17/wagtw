import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@wagtw/database';

class AIService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async generateResponse(prompt: string): Promise<string | null> {
    if (!this.genAI) return null;

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
      
      // Basic AI logic with system prompt
      const systemPrompt = "Anda adalah asisten WhatsApp otomatis yang sopan dan membantu. Berikan jawaban singkat dan padat.";
      
      const result = await model.generateContent([systemPrompt, prompt]);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('AI Error:', error);
      return null; // Fallback handled by caller
    }
  }
}

export const aiService = new AIService();
