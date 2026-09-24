import { Request, Response } from 'express';
import { warmupService } from '../services/warmup.service';
import { PERSONA_TEMPLATES } from '../constants/personas';

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
    const {
      isEnabled,
      dailyTarget,
      minDelayMinutes,
      minDelaySeconds,
      maxDelaySeconds,
      chatTurns,
      personaMode,
      autoChatNewDevice,
      aiBaseUrl,
      aiApiKey,
      aiModel,
      topicPrompt,
      deviceIds
    } = req.body;

    const updated = await warmupService.updateConfig({
      isEnabled,
      dailyTarget: dailyTarget !== undefined ? Number(dailyTarget) : undefined,
      minDelayMinutes: minDelayMinutes !== undefined ? Number(minDelayMinutes) : undefined,
      minDelaySeconds: minDelaySeconds !== undefined ? Number(minDelaySeconds) : undefined,
      maxDelaySeconds: maxDelaySeconds !== undefined ? Number(maxDelaySeconds) : undefined,
      chatTurns: chatTurns !== undefined ? Number(chatTurns) : undefined,
      personaMode,
      autoChatNewDevice: autoChatNewDevice !== undefined ? Boolean(autoChatNewDevice) : undefined,
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

export const getPersonas = async (req: Request, res: Response) => {
  try {
    res.json({ personas: PERSONA_TEMPLATES });
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

export const welcomeDevice = async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }
    const result = await warmupService.welcomeNewDevice(deviceId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
