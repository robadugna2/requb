import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('equb_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('equb_token');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

// Dashboard
export const getDashboardStats = async () => {
  const response = await api.get('/dashboard/stats');
  return response.data;
};

export const getRecentActivity = async () => {
  const response = await api.get('/dashboard/activity');
  return response.data;
};

export const getDepositChart = async () => {
  const response = await api.get('/dashboard/deposits-chart');
  return response.data;
};

// Groups
export const getGroups = async () => {
  const response = await api.get('/groups');
  return response.data;
};

export const getGroup = async (id: string) => {
  const response = await api.get(`/groups/${id}`);
  return response.data;
};

export const createGroup = async (data: {
  name: string;
  contributionAmount: number;
  cycleDuration: string;
  maxMembers: number;
  description?: string;
}) => {
  const response = await api.post('/groups', data);
  return response.data;
};

// Members
export const getMembers = async (search?: string) => {
  const params = search ? { search } : {};
  const response = await api.get('/users', { params });
  return response.data;
};

export const createMember = async (data: {
  name: string;
  phone: string;
  telegramId?: string;
  groupId?: string;
}) => {
  const response = await api.post('/users', data);
  return response.data;
};

export const getMember = async (id: string) => {
  const response = await api.get(`/users/${id}`);
  return response.data;
};

// Deposits / Receipts
export const getDeposits = async (filters?: {
  status?: string;
  groupId?: string;
}) => {
  const response = await api.get('/deposits', { params: filters });
  return response.data;
};

export const getGroupDeposits = async (groupId: string) => {
  const response = await api.get(`/groups/${groupId}/deposits`);
  return response.data;
};

export const verifyDeposit = async (id: string) => {
  const response = await api.patch(`/deposits/${id}/verify`);
  return response.data;
};

export const rejectDeposit = async (id: string, reason?: string) => {
  const response = await api.patch(`/deposits/${id}/reject`, { reason });
  return response.data;
};

// Lottery
export const triggerLottery = async (groupId: string) => {
  const response = await api.post(`/groups/${groupId}/lottery`);
  return response.data;
};

export const getLotteryResults = async (groupId?: string) => {
  const params = groupId ? { groupId } : {};
  const response = await api.get('/lottery/results', { params });
  return response.data;
};

export default api;
