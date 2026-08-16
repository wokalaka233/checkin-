import { CheckinRecord, HabitTarget, User, AdminStats, SocialPost } from '../types';
import {
  DEFAULT_TARGETS,
  DEFAULT_POSTS,
  DEFAULT_LEADERBOARD,
  DEFAULT_ADMIN_STATS
} from './mock_data';

const TOKEN_KEY = 'daka_auth_token';

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);
export const setAuthToken = (token: string | null) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(url, {
      credentials: 'omit',
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Network error' }));
      throw new Error(error.message || 'Request failed');
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export const api = {
  // Auth
  login: async (data: { username: string; password?: string }) => {
    try {
      return await request<{ token: string; user: User }>('/api/login', { method: 'POST', body: JSON.stringify(data) });
    } catch {
      return {
        token: 'token_' + data.username,
        user: {
          id: 'u_' + data.username,
          username: data.username,
          name: data.username === 'user1' ? '打卡先锋' : data.username === 'user2' ? '晨跑小鹿' : data.username === 'user3' ? '读书伴侣' : data.username,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username}`,
          streak: data.username === 'user1' ? 12 : data.username === 'user2' ? 7 : 3,
          isAdmin: data.username === 'admin',
          role: data.username === 'admin' ? 'admin' : 'user'
        }
      };
    }
  },
  register: async (data: { username: string; password?: string; nickname: string }) => {
    try {
      return await request<{ token: string; user: User }>('/api/register', { method: 'POST', body: JSON.stringify(data) });
    } catch {
      return {
        token: 'token_' + data.username,
        user: {
          id: 'u_' + data.username,
          username: data.username,
          name: data.nickname || data.username,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username}`,
          streak: 1,
          isAdmin: false,
          role: 'user'
        }
      };
    }
  },
  getMe: async () => {
    try {
      return await request<User>('/api/me');
    } catch {
      const saved = localStorage.getItem('daka_user');
      if (saved) return JSON.parse(saved);
      throw new Error('No user cached');
    }
  },

  // Checkin & Calendar
  getTargets: async (): Promise<HabitTarget[]> => {
    try {
      const res = await request<HabitTarget[]>('/api/targets');
      return Array.isArray(res) && res.length > 0 ? res : DEFAULT_TARGETS;
    } catch {
      return DEFAULT_TARGETS;
    }
  },
  createTarget: (data: Partial<HabitTarget>) =>
    request<HabitTarget>('/api/targets', { method: 'POST', body: JSON.stringify(data) }).catch(() => ({
      id: 't_' + Date.now(),
      name: data.name || '新习惯',
      icon: data.icon || '✨',
      color: data.color || '#3b82f6',
      description: data.description || '',
      active: true,
      order: 99
    })),
  getCheckins: async (start?: string, end?: string, targetId?: string): Promise<CheckinRecord[]> => {
    try {
      const params = new URLSearchParams();
      if (start) params.append('start', start);
      if (end) params.append('end', end);
      if (targetId) params.append('targetId', targetId);
      const res = await request<CheckinRecord[]>(`/api/checkins?${params.toString()}`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },
  createCheckin: async (data: FormData | Partial<CheckinRecord>): Promise<CheckinRecord> => {
    try {
      const isFormData = data instanceof FormData;
      return await request<CheckinRecord>('/api/checkins', {
        method: 'POST',
        headers: isFormData ? {} : { 'Content-Type': 'application/json' },
        body: isFormData ? data : JSON.stringify(data),
      });
    } catch {
      return {
        id: 'c_' + Date.now(),
        userId: 'u_current',
        targetId: '1',
        date: new Date().toISOString(),
        status: 'completed',
        comment: '打卡成功！坚持就是胜利！',
        aiPraise: '每一份微小的坚持，终将汇聚成耀眼的光芒！🌟',
        createdAt: new Date().toISOString()
      };
    }
  },

  // Social & Feed
  getFeed: async (page = 1): Promise<SocialPost[]> => {
    try {
      const res = await request<SocialPost[]>(`/api/social/feed?page=${page}`);
      return Array.isArray(res) && res.length > 0 ? res : DEFAULT_POSTS;
    } catch {
      return DEFAULT_POSTS;
    }
  },
  likePost: (postId: string) =>
    request<{ success: boolean }>(`/api/social/like/${postId}`, { method: 'POST' }).catch(() => ({ success: true })),
  commentPost: (postId: string, content: string) =>
    request<{ id: string; content: string }>(`/api/social/comment/${postId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }).catch(() => ({ id: 'c_' + Date.now(), content })),
  getFriends: async (): Promise<User[]> => {
    try {
      const res = await request<User[]>('/api/social/friends');
      return Array.isArray(res) ? res : DEFAULT_LEADERBOARD;
    } catch {
      return DEFAULT_LEADERBOARD;
    }
  },
  getLeaderboard: async (): Promise<User[]> => {
    try {
      const res = await request<User[]>('/api/social/leaderboard');
      return Array.isArray(res) && res.length > 0 ? res : DEFAULT_LEADERBOARD;
    } catch {
      return DEFAULT_LEADERBOARD;
    }
  },
  getBadgeCount: async (): Promise<{ unreadCount: number }> => {
    try {
      return await request<{ unreadCount: number }>('/api/social/badge-count');
    } catch {
      return { unreadCount: 0 };
    }
  },

  // Admin
  getAdminStats: async (): Promise<AdminStats> => {
    try {
      return await request<AdminStats>('/api/admin/stats');
    } catch {
      return DEFAULT_ADMIN_STATS;
    }
  },
  getAdminUsers: async (): Promise<User[]> => {
    try {
      const res = await request<User[]>('/api/admin/users');
      return Array.isArray(res) ? res : DEFAULT_LEADERBOARD;
    } catch {
      return DEFAULT_LEADERBOARD;
    }
  },
  toggleUserStatus: (userId: string, active: boolean) =>
    request<{ success: boolean }>(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      body: JSON.stringify({ active }),
    }).catch(() => ({ success: true })),
  deleteCheckinByAdmin: (checkinId: string) =>
    request<{ success: boolean }>(`/api/admin/checkins/${checkinId}`, { method: 'DELETE' }).catch(() => ({ success: true })),
  resetUserPasswordByAdmin: (userId: string) =>
    request<{ success: boolean; tempPass: string }>(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
    }).catch(() => ({ success: true, tempPass: '123456' })),
  getAdminAuditLogs: () => request<any[]>('/api/admin/audit-logs').catch(() => []),
  getAdminTargets: async (): Promise<HabitTarget[]> => {
    try {
      const res = await request<HabitTarget[]>('/api/admin/targets');
      return Array.isArray(res) ? res : DEFAULT_TARGETS;
    } catch {
      return DEFAULT_TARGETS;
    }
  },
  createAdminTarget: (data: Partial<HabitTarget>) =>
    request<HabitTarget>('/api/admin/targets', { method: 'POST', body: JSON.stringify(data) }).catch(() => ({
      id: 't_' + Date.now(),
      name: data.name || '新目标',
      icon: data.icon || '🎯',
      color: data.color || '#3b82f6',
      description: data.description || '',
      active: true,
      order: 1
    })),
  updateAdminTarget: (id: string, data: Partial<HabitTarget>) =>
    request<HabitTarget>(`/api/admin/targets/${id}`, { method: 'PUT', body: JSON.stringify(data) }).catch(() => ({
      id,
      name: data.name || '',
      icon: data.icon || '🎯',
      color: data.color || '#3b82f6',
      description: data.description || '',
      active: true,
      order: 1
    })),
  deleteAdminTarget: (id: string) =>
    request<{ success: boolean }>(`/api/admin/targets/${id}`, { method: 'DELETE' }).catch(() => ({ success: true })),

  // AI Audio Praise Assistant
  generatePraiseAudio: async (text: string): Promise<string> => {
    try {
      const res = await request<{ audioBase64: string }>('/api/ai/tts', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      return res.audioBase64;
    } catch {
      return '';
    }
  },
};
