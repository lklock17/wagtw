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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/docs')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

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
  getThreads: (params?: { deviceId?: string; page?: number; limit?: number; search?: string; filterType?: string }) =>
    api.get('/inbox/threads', { params }),
  getMessages: (threadId: string, params?: { limit?: number; before?: string }) =>
    api.get(`/inbox/threads/${threadId}/messages`, { params }),
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
  getPersonas: () => api.get('/warmup/personas'),
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

export const telegramService = {
  getConfig: () => api.get('/telegram/config'),
  updateConfig: (data: any) => api.post('/telegram/config', data),
  testTelegram: (botToken: string, chatId: string) => api.post('/telegram/test', { botToken, chatId }),
};

export const contactService = {
  getContacts: (params?: { search?: string; tag?: string }) => api.get('/contacts', { params }),
  getTags: () => api.get('/contacts/tags'),
  createContact: (data: { name: string; phoneNumber: string; email?: string; tags?: string[]; notes?: string }) =>
    api.post('/contacts', data),
  updateContact: (id: string, data: { name?: string; phoneNumber?: string; email?: string; tags?: string[]; notes?: string }) =>
    api.put(`/contacts/${id}`, data),
  deleteContact: (id: string) => api.delete(`/contacts/${id}`),
  importContacts: (data: { contacts: any[]; defaultTag?: string }) => api.post('/contacts/import', data),
  getExportVcfUrl: (tag?: string) => `/api/contacts/export/vcf${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`
};

export default api;

