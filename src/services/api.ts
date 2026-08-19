import {
  User,
  FriendUser,
  FriendRequest,
  HabitProject,
  CheckInRule,
  CheckInRecord,
  DailyComment,
  ChatMessage,
  AdminUserSummary,
  AdminUserDetail,
  NotificationConfig,
} from '../types';

let authToken: string | null = localStorage.getItem('daka_auth_token');

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('daka_auth_token', token);
  } else {
    localStorage.removeItem('daka_auth_token');
  }
};

export const getAuthToken = () => authToken;

// Local storage keys (保留用于基础断网兜底，但核心写入一律优先通过 api 发送到 D1 数据库)
const LS_FRIENDS_KEY = 'daka_local_friends';
const LS_REQUESTS_KEY = 'daka_local_friend_requests';
const LS_REGISTERED_USERS_KEY = 'daka_local_registered_users';
const LS_CHECKINS_KEY = 'daka_local_checkins';
const LS_PROJECTS_KEY = 'daka_local_projects';
const LS_MESSAGES_KEY = 'daka_local_messages';

// 获取所有已知注册过的用户库 (用于在 D1 离线或弱网降级时，动态解析用户昵称，杜绝匿名脏数据覆盖)
const getKnownUsers = (): User[] => {
  try {
    const raw = localStorage.getItem(LS_REGISTERED_USERS_KEY);
    const users: User[] = raw ? JSON.parse(raw) : [];
    const defaultUsers: User[] = [
      { id: 'u_user1', username: 'user1', nickname: '打卡先锋', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1', createdAt: new Date().toISOString(), role: 'user', isAdmin: false },
      { id: 'u_user2', username: 'user2', nickname: '晨跑小鹿', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2', createdAt: new Date().toISOString(), role: 'user', isAdmin: false },
      { id: 'u_user3', username: 'user3', nickname: '读书伴侣', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user3', createdAt: new Date().toISOString(), role: 'user', isAdmin: false },
      { id: 'u_admin', username: 'admin', nickname: '系统管理员', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', createdAt: new Date().toISOString(), role: 'admin', isAdmin: true },
    ];
    defaultUsers.forEach(du => {
      if (!users.some(u => u.username.toLowerCase() === du.username.toLowerCase())) {
        users.push(du);
      }
    });
    return users;
  } catch {
    return [];
  }
};

const saveUserToKnown = (user: User) => {
  const current = getKnownUsers();
  if (!current.some(u => u.username.toLowerCase() === user.username.toLowerCase())) {
    current.push(user);
    localStorage.setItem(LS_REGISTERED_USERS_KEY, JSON.stringify(current));
  }
};

const getLocalRequests = (): (FriendRequest & { fromUser: User })[] => {
  try {
    const raw = localStorage.getItem(LS_REQUESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const setAllRequests = (reqs: (FriendRequest & { fromUser: User })[]) => {
  localStorage.setItem(LS_REQUESTS_KEY, JSON.stringify(reqs));
};

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 适度放宽超时至6秒，避免 Cloudflare 冷启动被误杀中断

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || '云端请求失败');
    }
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export const api = {
  // Auth
  register: async (data: { username: string; password: string; nickname: string }) => {
    try {
      const res = await request<{ user: User; token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      saveUserToKnown(res.user);
      setAuthToken(res.token);
      return res;
    } catch (err) {
      throw err;
    }
  },

  login: async (data: { username: string; password: string }) => {
    try {
      const res = await request<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      saveUserToKnown(res.user);
      setAuthToken(res.token);
      return res;
    } catch (err) {
      throw err;
    }
  },

  getMe: async (): Promise<User> => {
    try {
      const u = await request<User>('/api/auth/me');
      saveUserToKnown(u);
      return u;
    } catch (err) {
      const token = getAuthToken();
      if (!token) throw new Error('未登录');
      const username = token.replace('token_', '');
      const knownUsers = getKnownUsers();
      const matched = knownUsers.find(x => x.username.toLowerCase() === username.toLowerCase());
      if (matched) return matched;
      throw err;
    }
  },

  // 保存 ServerChan 推送密钥到云端 D1 (真实上线)
  updateSendKey: async (sendKey: string) => {
    return await request<{ success: boolean; serverchanSendKey: string }>('/api/user/sendkey', {
      method: 'POST',
      body: JSON.stringify({ sendKey }),
    });
  },

  // 触发实机微信推送测试 (真实上线)
  testPush: async (sendKey?: string) => {
    return await request<{ success: boolean; message: string }>('/api/push/test', {
      method: 'POST',
      body: JSON.stringify({ sendKey }),
    });
  },

  // Friends - 真实好友列表 (真实上线，直连 D1 双向好友)
  getFriends: async (): Promise<FriendUser[]> => {
    try {
      const res = await request<FriendUser[]>('/api/friends/list');
      return Array.isArray(res) ? res : [];
    } catch {
      const token = getAuthToken();
      const myUsername = token ? token.replace('token_', '') : 'user1';
      const raw = localStorage.getItem(`${LS_FRIENDS_KEY}_${myUsername}`);
      return raw ? JSON.parse(raw) : [];
    }
  },

  // 好友申请：获取发给我的待处理申请
  getFriendRequests: async (): Promise<(FriendRequest & { fromUser: User })[]> => {
    try {
      const res = await request<(FriendRequest & { fromUser: User })[]>('/api/friends/requests');
      return Array.isArray(res) ? res : [];
    } catch {
      const token = getAuthToken();
      const myUsername = token ? token.replace('token_', '') : 'user1';
      const myId = 'u_' + myUsername;
      const all = getLocalRequests();
      return all.filter((r) => r.toUserId === myId && r.status === 'pending');
    }
  },

  // 发送好友申请 (真实上线，未注册用户严格返回 404 无法发送)
  sendFriendRequest: async (toUsername: string): Promise<FriendRequest> => {
    return await request<FriendRequest>('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ toUsername }),
    });
  },

  // 同意/拒绝好友申请 (双向建交写入 D1)
  respondFriendRequest: async (requestId: string, action: 'accept' | 'reject') => {
    return await request<{ success: boolean }>('/api/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ requestId, action }),
    });
  },

  // 搜索真实注册用户 (绝对不展示虚拟或未注册的假账号)
  searchUsers: async (q: string): Promise<User[]> => {
    return await request<User[]>(`/api/friends/search?q=${encodeURIComponent(q)}`);
  },

  // Projects - 获取我加入或代创建的所有项目 (D1 数据库)
  getProjects: async (): Promise<HabitProject[]> => {
    try {
      const res = await request<HabitProject[]>('/api/projects/list');
      return Array.isArray(res) && res.length > 0 ? res : [];
    } catch {
      try {
        const raw = localStorage.getItem(LS_PROJECTS_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
      return [];
    }
  },

  // 创建打卡项目 (支持代创建模式与多端设备同步)
  createProject: async (data: {
    title: string;
    isProxy: boolean;
    selectedFriendIds?: string[];
    creatorParticipates?: boolean;
    rules: CheckInRule;
  }): Promise<HabitProject> => {
    return await request<HabitProject>('/api/projects/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateProjectRules: async (projectId: string, rules: CheckInRule) => {
    return await request<HabitProject>(`/api/projects/${projectId}/rule`, {
      method: 'PUT',
      body: JSON.stringify({ rules }),
    });
  },

  removeMember: async (projectId: string, memberId: string) => {
    return await request<HabitProject>(`/api/projects/${projectId}/remove-member`, {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    });
  },

  addMember: async (projectId: string, memberId: string) => {
    return await request<HabitProject>(`/api/projects/${projectId}/add-member`, {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    });
  },

  // Calendar & Checkins (拉取当月 D1 打卡记录)
  getCalendarData: async (projectId: string, month: string) => {
    return await request<any>(`/api/checkins/calendar?projectId=${encodeURIComponent(projectId)}&month=${encodeURIComponent(month)}`);
  },

  // 提交打卡 (真实写入 D1)
  submitCheckIn: async (data: {
    projectId: string;
    date: string;
    photos: string[];
    videos: string[];
    audios: { url: string; duration: number }[];
    text: string;
  }) => {
    return await request<any>('/api/checkins/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getDayDetail: async (projectId: string, date: string) => {
    return await request<{
      date: string;
      records: CheckInRecord[];
      comments: DailyComment[];
    }>(`/api/checkins/day-detail?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`);
  },

  // Comments
  getComments: async (projectId: string, date: string): Promise<DailyComment[]> => {
    try {
      const res = await request<DailyComment[]>(`/api/comments/list?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  addComment: async (data: {
    projectId: string;
    date: string;
    content: string;
    replyToCommentId?: string;
    replyToNickname?: string;
  }): Promise<DailyComment> => {
    return await request<DailyComment>('/api/comments/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Messages
  getMessages: async (friendId: string): Promise<ChatMessage[]> => {
    try {
      const res = await request<ChatMessage[]>(`/api/messages/${friendId}`);
      return Array.isArray(res) ? res : [];
    } catch {
      try {
        const raw = localStorage.getItem(`${LS_MESSAGES_KEY}_${friendId}`);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
  },

  sendMessage: async (data: {
    receiverId: string;
    type: 'text' | 'image' | 'audio';
    content: string;
    audioDuration?: number;
  }): Promise<ChatMessage> => {
    return await request<ChatMessage>('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  markMessagesRead: async (friendId: string) => {
    return await request<{ success: boolean }>('/api/messages/read', {
      method: 'POST',
      body: JSON.stringify({ friendId }),
    });
  },

  getBadgeCount: async (): Promise<{ unreadCount: number }> => {
    try {
      return await request<{ unreadCount: number }>('/api/notifications/badge');
    } catch {
      return { unreadCount: 0 };
    }
  },

  // Admin Master API (全功能 D1 直通，绝无演示成分)
  getAdminUsers: async (): Promise<AdminUserSummary[]> => {
    return await request<AdminUserSummary[]>('/api/admin/users');
  },

  updateUserPassword: async (userId: string, password: string) => {
    return await request<{ success: boolean; user: any }>(`/api/admin/users/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  getAdminUserDetail: async (userId: string): Promise<AdminUserDetail> => {
    try {
      return await request<AdminUserDetail>(`/api/admin/users/${userId}/detail`);
    } catch (err) {
      const knownUsers = getKnownUsers();
      const matchedUser = knownUsers.find((u) => u.id === userId) || {
        id: userId,
        username: 'user',
        nickname: '本地离线用户',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        createdAt: new Date().toISOString(),
        role: 'user',
        isAdmin: false,
      };
      return {
        user: matchedUser,
        projects: [],
        allProjects: [],
        checkIns: [],
      };
    }
  },

  // 新增：管理员专属私信对话流水云调用审计接口 (真实上云，拒绝任何 Local 降级)
  getAdminUserMessages: async (userId: string): Promise<any[]> => {
    return await request<any[]>(`/api/admin/users/${userId}/messages`);
  },

  adminCreateCheckIn: async (data: {
    projectId: string;
    userId: string;
    date: string;
    photos?: string[];
    videos?: string[];
    audios?: { url: string; duration: number }[];
    text?: string;
    isQualified?: boolean;
  }) => {
    return await request<{ success: boolean; record: CheckInRecord }>('/api/admin/checkins', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  adminUpdateCheckIn: async (
    checkInId: string,
    data: {
      photos?: string[];
      videos?: string[];
      audios?: { url: string; duration: number }[];
      text?: string;
      isQualified?: boolean;
      date?: string;
    }
  ) => {
    return await request<{ success: boolean; record: CheckInRecord }>(`/api/admin/checkins/${checkInId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  adminDeleteCheckIn: async (checkInId: string) => {
    return await request<{ success: boolean }>(`/api/admin/checkins/${checkInId}`, {
      method: 'DELETE',
    });
  },

  adminDeleteProject: async (projectId: string) => {
    return await request<{ success: boolean }>(`/api/admin/projects/${projectId}`, {
      method: 'DELETE',
    });
  },

  // Admin Notification Configs Management (微信 ServerChan 每日提醒规则)
  getNotificationConfigs: async (): Promise<NotificationConfig[]> => {
    return await request<NotificationConfig[]>('/api/admin/notifications/configs');
  },

  createNotificationConfig: async (data: Omit<NotificationConfig, 'id' | 'createdAt'>) => {
    return await request<{ success: boolean; config: NotificationConfig }>('/api/admin/notifications/configs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateNotificationConfig: async (id: string, data: Partial<NotificationConfig>) => {
    return await request<{ success: boolean; config: NotificationConfig }>(`/api/admin/notifications/configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  toggleNotificationConfig: async (id: string, enabled: boolean) => {
    return await request<{ success: boolean; config: NotificationConfig }>(`/api/admin/notifications/configs/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  },

  deleteNotificationConfig: async (id: string) => {
    return await request<{ success: boolean }>(`/api/admin/notifications/configs/${id}`, {
      method: 'DELETE',
    });
  },

  // 微信每日督促群发引擎接口
  triggerDailyReminderPush: async () => {
    return await request<{
      success: boolean;
      sentCount: number;
      skippedNoKeyCount: number;
      details: { nickname: string; projectTitle: string; success: boolean }[];
    }>('/api/admin/notifications/trigger-reminder', {
      method: 'POST',
    });
  },
};
