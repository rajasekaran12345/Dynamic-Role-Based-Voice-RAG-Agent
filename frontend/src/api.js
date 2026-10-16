import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export const authAPI = {
  register: (name, role) => api.post('/api/register', { name, role }),
  login: (userId) => api.post('/api/login', { user_id: userId }),
  savePrompt: (userId, prompt) => api.post('/api/agent-prompt', { user_id: userId, system_prompt: prompt }),
  saveVoice: (userId, voice) => api.post('/api/agent-voice', { user_id: userId, selected_voice: voice }),
  getAgentConfig: (userId) => api.get(`/api/agent-config/${userId}`),
};

export const documentAPI = {
  upload: (formData) => api.post('/api/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  list: (userId) => api.get(`/api/documents/${userId}`),
  delete: (docId, userId) => api.delete(`/api/documents/${docId}`, { params: { user_id: userId } }),
};

export const chatAPI = {
  send: (payload) => api.post('/api/chat', payload),
  getHistory: (userId) => api.get(`/api/chat/history/${userId}`),
  executeMCP: (payload) => api.post('/api/mcp/execute', payload),
};

export const voiceAPI = {
  getPreviewUrl: (voice) => `${API_BASE_URL}/api/voice/preview?voice=${voice}`,
  ttsStreamUrl: () => `${API_BASE_URL}/api/voice/tts`,
  getLiveKitToken: (userId, room) => api.get('/api/livekit/token', { params: { user_id: userId, room } }),
  getToken: (userId, room) => api.get('/api/livekit/token', { params: { user_id: userId, room } }),
  transcribeAudio: (formData) => api.post('/api/voice/stt', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};
