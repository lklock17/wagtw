import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const deviceService = {
  getDevices: () => api.get('/devices'),
  createDevice: (name: string) => api.post('/devices', { name }),
  connectDevice: (id: string) => api.post(`/devices/${id}/connect`),
  deleteDevice: (id: string) => api.delete(`/devices/${id}`),
  updateWebhook: (id: string, url: string) => api.patch(`/devices/${id}/webhook`, { webhookUrl: url }),
  testWebhook: (url: string) => api.post('/devices/test-webhook', { url }),
  getPairingCode: (id: string, phone: string) => api.post(`/devices/${id}/pairing-code`, { phone }),
  checkNumber: (id: string, phone: string) => api.post(`/devices/${id}/check-number`, { phone }),
};

export const inboxService = {
  getThreads: () => api.get('/inbox/threads'),
  getMessages: (threadId: string) => api.get(`/inbox/threads/${threadId}/messages`),
  markAsRead: (threadId: string) => api.post(`/inbox/threads/${threadId}/read`),
};

export const templateService = {
  getTemplates: () => api.get('/templates'),
  createTemplate: (data: any) => api.post('/templates', data),
  deleteTemplate: (id: string) => api.delete(`/templates/${id}`),
};

export const clientService = {
  getClients: () => api.get('/clients'),
  createClient: (data: any) => api.post('/clients', data),
  deleteClient: (id: string) => api.delete(`/clients/${id}`),
};

export const autoReplyService = {
  getRules: () => api.get('/autoreply'),
  createRule: (data: any) => api.post('/autoreply', data),
  updateRule: (id: string, data: any) => api.patch(`/autoreply/${id}`, data),
  deleteRule: (id: string) => api.delete(`/autoreply/${id}`),
};

export const bulkService = {
  createJob: (data: any) => api.post('/bulk', data),
  getJobs: () => api.get('/bulk'),
  getJobStatus: (id: string) => api.get(`/bulk/${id}`),
};

export const mediaService = {
  getMedia: () => api.get('/media'),
  uploadMedia: (formData: FormData) => api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteMedia: (id: string) => api.delete(`/media/${id}`),
};

export const scheduleService = {
  getSchedules: () => api.get('/schedules'),
  createSchedule: (data: any) => api.post('/schedules', data),
  deleteSchedule: (id: string) => api.delete(`/schedules/${id}`),
};

export const messageService = {
  sendMessage: (data: any) => api.post('/messages/send', data),
  checkNumber: (phone: string, deviceId?: string) => api.post('/messages/check-number', { phone, deviceId }),
};

export const statsService = {
  getStats: () => api.get('/stats'),
};

export const warmupService = {
  getConfig: () => api.get('/warmup/config'),
  updateConfig: (data: any) => api.post('/warmup/config', data),
  fetchModels: (baseUrl?: string, apiKey?: string) => api.post('/warmup/fetch-models', { baseUrl, apiKey }),
  getLogs: (limit = 50) => api.get(`/warmup/logs?limit=${limit}`),
  triggerManual: () => api.post('/warmup/trigger'),
};

export const authService = {
  getProfile: () => api.get('/auth/me'),
  changePassword: (data: { currentPassword?: string; newPassword: string }) => api.post('/auth/change-password', data),
  getUsers: () => api.get('/auth/users'),
  createUser: (data: { name?: string; email: string; password: string }) => api.post('/auth/users', data),
  deleteUser: (id: string) => api.delete(`/auth/users/${id}`),
  resetUserPassword: (id: string, newPassword: string) => api.patch(`/auth/users/${id}/password`, { newPassword }),
};

export default api;

