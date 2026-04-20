import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
});

export const deviceService = {
  getDevices: () => api.get('/devices'),
  createDevice: (name: string) => api.post('/devices', { name }),
  connectDevice: (id: string) => api.post(`/devices/${id}/connect`),
  deleteDevice: (id: string) => api.delete(`/devices/${id}`),
};

export const messageService = {
  sendMessage: (data: any) => api.post('/messages/send', data),
};

export default api;
