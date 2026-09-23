import { Request, Response } from 'express';
import { warmupService } from '../services/warmup.service';

export const getWarmupConfig = async (req: Request, res: Response) => {
  try {
    const config = await warmupService.getConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateWarmupConfig = async (req: Request, res: Response) => {
  try {
    const { isEnabled, dailyTarget, minDelayMinutes, aiBaseUrl, aiApiKey, aiModel, topicPrompt, deviceIds } = req.body;
    const updated = await warmupService.updateConfig({
      isEnabled,
      dailyTarget: dailyTarget ? Number(dailyTarget) : undefined,
      minDelayMinutes: minDelayMinutes ? Number(minDelayMinutes) : undefined,
      aiBaseUrl,
      aiApiKey,
      aiModel,
      topicPrompt,
      deviceIds
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const fetchAiModels = async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = req.body;
    const models = await warmupService.fetchModels(baseUrl, apiKey);
    res.json({ models });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getWarmupLogs = async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const logs = await warmupService.getLogs(limit);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const triggerWarmupManual = async (req: Request, res: Response) => {
  try {
    const result = await warmupService.runWarmupPair(true);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
