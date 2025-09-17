import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: {
    username: string;
    email: string;
    password: string;
    display_name: string;
  }) => api.post('/auth/register', data),
  logout: (userId?: string) => api.post('/auth/logout', { userId }),
};

export const workspaceApi = {
  getMyWorkspaces: () => api.get('/workspaces/my-workspaces'),
  createWorkspace: (data: { name: string; url_slug: string }) =>
    api.post('/workspaces', data),
  getWorkspace: (id: string) => api.get(`/workspaces/${id}`),
  getMembers: (id: string) => api.get(`/workspaces/${id}/members`),
  joinWorkspace: (id: string) => api.post(`/workspaces/${id}/join`),
  createInvite: (workspaceId: string, data: { expires_in_days?: number; max_uses?: number | null }) =>
    api.post(`/workspaces/${workspaceId}/invite`, data),
  getInvites: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/invites`),
  deleteInvite: (workspaceId: string, inviteId: string) =>
    api.delete(`/workspaces/${workspaceId}/invites/${inviteId}`),
  joinViaInvite: (inviteCode: string) => api.post(`/workspaces/join/${inviteCode}`),
};

export const channelApi = {
  getWorkspaceChannels: (workspaceId: string) =>
    api.get(`/channels/workspace/${workspaceId}`),
  createChannel: (data: {
    workspace_id: string;
    name: string;
    description?: string;
    is_private?: boolean;
  }) => api.post('/channels', data),
  getChannel: (id: string) => api.get(`/channels/${id}`),
  getMembers: (id: string) => api.get(`/channels/${id}/members`),
  joinChannel: (id: string) => api.post(`/channels/${id}/join`),
  leaveChannel: (id: string) => api.post(`/channels/${id}/leave`),
  updateChannel: (id: string, data: any) => api.put(`/channels/${id}`, data),
};

export const messageApi = {
  getChannelMessages: (channelId: string, params?: any) =>
    api.get(`/messages/channel/${channelId}`, { params }),
  sendMessage: (data: {
    channel_id: string;
    content: string;
    message_type?: string;
    parent_message_id?: string;
  }) => api.post('/messages', data),
  getThread: (messageId: string) => api.get(`/messages/${messageId}/thread`),
  updateMessage: (id: string, content: string) =>
    api.put(`/messages/${id}`, { content }),
  deleteMessage: (id: string) => api.delete(`/messages/${id}`),
  addReaction: (messageId: string, emoji: string) =>
    api.post(`/messages/${messageId}/reactions`, { emoji }),
  removeReaction: (messageId: string, emoji: string) =>
    api.delete(`/messages/${messageId}/reactions/${emoji}`),
};

export const userApi = {
  getMe: () => api.get('/users/me'),
  getUser: (id: string) => api.get(`/users/${id}`),
  updateProfile: (data: any) => api.put('/users/me', data),
  updateStatus: (data: { status?: string; status_message?: string }) =>
    api.put('/users/me/status', data),
  searchUsers: (workspaceId: string, query: string) =>
    api.get(`/users/search/${workspaceId}`, { params: { q: query } }),
  createDirectMessage: (workspace_id: string, target_user_id: string) =>
    api.post('/users/direct-message', { workspace_id, target_user_id }),
  getDirectMessages: (workspaceId: string) =>
    api.get(`/users/direct-messages/${workspaceId}`),
};

export default api;
