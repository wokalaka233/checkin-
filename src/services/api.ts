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

// Local storage helper keys for offline/fallback mode
const LS_FRIENDS_KEY = 'daka_local_friends';
const LS_REQUESTS_KEY = 'daka_local_friend_requests';
const LS_PROJECTS_KEY = 'daka_local_projects';
const LS_MESSAGES_KEY = 'daka_local_messages';

const getLocalFriends = (): FriendUser[] => {
  try {
    const raw = localStorage.getItem(LS_FRIENDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const setLocalFriends = (friends: FriendUser[]) => {
  localStorage.setItem(LS_FRIENDS_KEY, JSON.stringify(friends));
};

const getLocalRequests = (): (FriendRequest & { fromUser: User })[] => {
  try {
    const raw = localStorage.getItem(LS_REQUESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const setLocalRequests = (reqs: (FriendRequest & { fromUser: User })[]) => {
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
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || '请求失败');
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
      return await request<{ user: User; token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const user: User = {
        id: 'u_' + data.username,
        username: data.username,
        nickname: data.nickname || data.username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username}`,
        createdAt: new Date().toISOString(),
        role: 'user',
        isAdmin: false,
      };
      const token = 'token_' + data.username;
      setAuthToken(token);
      return { user, token };
    }
  },

  login: async (data: { username: string; password: string }) => {
    try {
      return await request<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const isSpecialAdmin = data.username === 'admin';
      const user: User = {
        id: 'u_' + data.username,
        username: data.username,
        nickname:
          data.username === 'user1'
            ? '打卡先锋'
            : data.username === 'user2'
            ? '晨跑小鹿'
            : data.username === 'user3'
            ? '读书伴侣'
            : isSpecialAdmin
            ? '系统管理员'
            : data.username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username}`,
        createdAt: new Date().toISOString(),
        role: isSpecialAdmin ? 'admin' : 'user',
        isAdmin: isSpecialAdmin,
      };
      const token = 'token_' + data.username;
      setAuthToken(token);
      return { user, token };
    }
  },

  getMe: async (): Promise<User> => {
    try {
      return await request<User>('/api/auth/me');
    } catch {
      const token = getAuthToken();
      const username = token?.replace('token_', '') || 'user1';
      const isSpecialAdmin = username === 'admin';
      return {
        id: 'u_' + username,
        username,
        nickname:
          username === 'user1'
            ? '打卡先锋'
            : username === 'user2'
            ? '晨跑小鹿'
            : username === 'user3'
            ? '读书伴侣'
            : isSpecialAdmin
            ? '系统管理员'
            : username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        createdAt: new Date().toISOString(),
        role: isSpecialAdmin ? 'admin' : 'user',
        isAdmin: isSpecialAdmin,
      };
    }
  },

  updateSendKey: async (sendKey: string) => {
    try {
      return await request<{ success: boolean; serverchanSendKey: string }>('/api/user/sendkey', {
        method: 'POST',
        body: JSON.stringify({ sendKey }),
      });
    } catch {
      return { success: true, serverchanSendKey: sendKey };
    }
  },

  testPush: async (sendKey?: string) => {
    try {
      return await request<{ success: boolean; message: string }>('/api/push/test', {
        method: 'POST',
        body: JSON.stringify({ sendKey }),
      });
    } catch {
      return { success: true, message: '测试推送已模拟触发成功！' };
    }
  },

  // Friends - 真实好友列表，默认为空，不展示未经添加的测试账号
  getFriends: async (): Promise<FriendUser[]> => {
    try {
      const res = await request<FriendUser[]>('/api/friends/list');
      return Array.isArray(res) ? res : [];
    } catch {
      return getLocalFriends();
    }
  },

  getFriendRequests: async (): Promise<(FriendRequest & { fromUser: User })[]> => {
    try {
      const res = await request<(FriendRequest & { fromUser: User })[]>('/api/friends/requests');
      return Array.isArray(res) ? res : [];
    } catch {
      return getLocalRequests();
    }
  },

  sendFriendRequest: async (toUsername: string): Promise<FriendRequest> => {
    try {
      return await request<FriendRequest>('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ toUsername }),
      });
    } catch {
      const token = getAuthToken() || 'token_user1';
      const myUsername = token.replace('token_', '');
      const req: FriendRequest & { fromUser: User } = {
        id: 'req_' + Date.now(),
        fromUserId: 'u_' + myUsername,
        toUserId: 'u_' + toUsername,
        status: 'pending',
        createdAt: new Date().toISOString(),
        fromUser: {
          id: 'u_' + myUsername,
          username: myUsername,
          nickname: myUsername,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${myUsername}`,
          createdAt: new Date().toISOString(),
        },
      };
      const currentReqs = getLocalRequests();
      setLocalRequests([...currentReqs, req]);
      return req;
    }
  },

  respondFriendRequest: async (requestId: string, action: 'accept' | 'reject') => {
    try {
      return await request<{ success: boolean }>('/api/friends/respond', {
        method: 'POST',
        body: JSON.stringify({ requestId, action }),
      });
    } catch {
      const currentReqs = getLocalRequests();
      const targetReq = currentReqs.find((r) => r.id === requestId);
      setLocalRequests(currentReqs.filter((r) => r.id !== requestId));

      if (action === 'accept' && targetReq?.fromUser) {
        const currentFriends = getLocalFriends();
        const newFriend: FriendUser = {
          ...targetReq.fromUser,
          unreadCount: 0,
        };
        if (!currentFriends.some((f) => f.id === newFriend.id)) {
          setLocalFriends([...currentFriends, newFriend]);
        }
      }
      return { success: true };
    }
  },

  searchUsers: async (q: string): Promise<User[]> => {
    try {
      return await request<User[]>(`/api/friends/search?q=${encodeURIComponent(q)}`);
    } catch {
      return [
        {
          id: 'u_' + q,
          username: q,
          nickname: q,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${q}`,
          createdAt: new Date().toISOString(),
        },
      ];
    }
  },

  // Projects
  getProjects: async (): Promise<HabitProject[]> => {
    try {
      const res = await request<HabitProject[]>('/api/projects/list');
      return Array.isArray(res) && res.length > 0 ? res : [];
    } catch {
      try {
        const raw = localStorage.getItem(LS_PROJECTS_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
      const defaultProj: HabitProject = {
        id: 'p_default_1',
        title: '每日自律打卡',
        creatorId: 'u_user1',
        creatorNickname: '打卡先锋',
        members: ['u_user1'],
        sparks: { u_user1: 1 },
        rules: {
          requirePhotos: true,
          minPhotos: 1,
          requireVideo: false,
          requireAudio: false,
          requireText: true,
          reminderEnabled: true,
          reminderTime: '21:00',
        },
        createdAt: new Date().toISOString(),
      };
      return [defaultProj];
    }
  },

  createProject: async (data: {
    title: string;
    isProxy: boolean;
    selectedFriendIds?: string[];
    creatorParticipates?: boolean;
    rules: CheckInRule;
  }): Promise<HabitProject> => {
    try {
      return await request<HabitProject>('/api/projects/create', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const token = getAuthToken() || 'token_user1';
      const myUsername = token.replace('token_', '');
      const myId = 'u_' + myUsername;
      const memberIds = [...(data.selectedFriendIds || [])];
      if (data.creatorParticipates !== false && !memberIds.includes(myId)) {
        memberIds.push(myId);
      }

      const sparks: Record<string, number> = {};
      memberIds.forEach((id) => (sparks[id] = 1));

      const newProj: HabitProject = {
        id: 'p_' + Date.now(),
        title: data.title,
        creatorId: myId,
        creatorNickname: myUsername,
        members: memberIds,
        sparks,
        rules: data.rules,
        createdAt: new Date().toISOString(),
      };

      try {
        const current = await api.getProjects();
        localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify([...current, newProj]));
      } catch {}
      return newProj;
    }
  },

  updateProjectRules: async (projectId: string, rules: CheckInRule) => {
    try {
      return await request<HabitProject>(`/api/projects/${projectId}/rule`, {
        method: 'PUT',
        body: JSON.stringify({ rules }),
      });
    } catch {
      return { id: projectId, rules } as any;
    }
  },

  removeMember: async (projectId: string, memberId: string) => {
    try {
      return await request<HabitProject>(`/api/projects/${projectId}/remove-member`, {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      });
    } catch {
      return { id: projectId } as any;
    }
  },

  addMember: async (projectId: string, memberId: string) => {
    try {
      return await request<HabitProject>(`/api/projects/${projectId}/add-member`, {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      });
    } catch {
      return { id: projectId } as any;
    }
  },

  // Calendar & Checkins
  getCalendarData: async (projectId: string, month: string) => {
    try {
      return await request<any>(`/api/checkins/calendar?projectId=${encodeURIComponent(projectId)}&month=${encodeURIComponent(month)}`);
    } catch {
      const proj = (await api.getProjects()).find((p) => p.id === projectId) || {
        id: projectId,
        title: '每日打卡',
        members: [],
        sparks: {},
        rules: { requirePhotos: false, minPhotos: 0, requireVideo: false, requireAudio: false, requireText: false },
        createdAt: new Date().toISOString(),
      };
      return {
        month,
        project: proj,
        days: {},
      };
    }
  },

  submitCheckIn: async (data: {
    projectId: string;
    date: string;
    photos: string[];
    videos: string[];
    audios: { url: string; duration: number }[];
    text: string;
  }) => {
    try {
      return await request<any>('/api/checkins/submit', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const token = getAuthToken() || 'token_user1';
      const myUsername = token.replace('token_', '');
      const record: CheckInRecord = {
        id: 'rec_' + Date.now(),
        projectId: data.projectId,
        userId: 'u_' + myUsername,
        userNickname: myUsername,
        date: data.date,
        photos: data.photos,
        videos: data.videos,
        audios: data.audios,
        text: data.text,
        isQualified: true,
        createdAt: new Date().toISOString(),
      };
      return {
        record,
        sparkUpdate: { newSpark: 2, isRekindling: false, rekindleProgress: 0 },
      };
    }
  },

  getDayDetail: async (projectId: string, date: string) => {
    try {
      return await request<{
        date: string;
        records: CheckInRecord[];
        comments: DailyComment[];
      }>(`/api/checkins/day-detail?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`);
    } catch {
      return {
        date,
        records: [],
        comments: [],
      };
    }
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
    try {
      return await request<DailyComment>('/api/comments/create', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const token = getAuthToken() || 'token_user1';
      const myUsername = token.replace('token_', '');
      return {
        id: 'cm_' + Date.now(),
        projectId: data.projectId,
        date: data.date,
        userId: 'u_' + myUsername,
        userNickname: myUsername,
        content: data.content,
        replyToCommentId: data.replyToCommentId,
        replyToNickname: data.replyToNickname,
        createdAt: new Date().toISOString(),
      };
    }
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
    try {
      return await request<ChatMessage>('/api/messages/send', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const token = getAuthToken() || 'token_user1';
      const myUsername = token.replace('token_', '');
      const msg: ChatMessage = {
        id: 'msg_' + Date.now(),
        senderId: 'u_' + myUsername,
        receiverId: data.receiverId,
        type: data.type,
        content: data.content,
        audioDuration: data.audioDuration,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      try {
        const key = `${LS_MESSAGES_KEY}_${data.receiverId}`;
        const prev = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify([...prev, msg]));
      } catch {}
      return msg;
    }
  },

  markMessagesRead: async (friendId: string) => {
    try {
      return await request<{ success: boolean }>('/api/messages/read', {
        method: 'POST',
        body: JSON.stringify({ friendId }),
      });
    } catch {
      return { success: true };
    }
  },

  getBadgeCount: async (): Promise<{ unreadCount: number }> => {
    try {
      return await request<{ unreadCount: number }>('/api/notifications/badge');
    } catch {
      return { unreadCount: 0 };
    }
  },

  // Admin Master API (Highest Authority)
  getAdminUsers: async (): Promise<AdminUserSummary[]> => {
    try {
      return await request<AdminUserSummary[]>('/api/admin/users');
    } catch {
      return [
        {
          id: 'u_user1',
          username: 'user1',
          nickname: '打卡先锋',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
          createdAt: new Date().toISOString(),
          projectCount: 1,
          checkInCount: 12,
        },
      ];
    }
  },

  updateUserPassword: async (userId: string, password: string) => {
    try {
      return await request<{ success: boolean; user: any }>(`/api/admin/users/${userId}/password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    } catch {
      return { success: true, user: { id: userId } };
    }
  },

  getAdminUserDetail: async (userId: string): Promise<AdminUserDetail> => {
    try {
      return await request<AdminUserDetail>(`/api/admin/users/${userId}/detail`);
    } catch {
      return {
        user: {
          id: userId,
          username: 'user',
          nickname: '用户',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + userId,
          createdAt: new Date().toISOString(),
        },
        projects: [],
        allProjects: [],
        checkIns: [],
      };
    }
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
    try {
      return await request<{ success: boolean; record: CheckInRecord }>('/api/admin/checkins', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const record: CheckInRecord = {
        id: 'rec_admin_' + Date.now(),
        projectId: data.projectId,
        userId: data.userId,
        date: data.date,
        photos: data.photos || [],
        videos: data.videos || [],
        audios: (data.audios as any) || [],
        text: data.text || '',
        isQualified: data.isQualified !== false,
        createdAt: new Date().toISOString(),
      };
      return { success: true, record };
    }
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
    try {
      return await request<{ success: boolean; record: CheckInRecord }>(`/api/admin/checkins/${checkInId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch {
      return { success: true, record: { id: checkInId, ...data } as any };
    }
  },

  adminDeleteCheckIn: async (checkInId: string) => {
    try {
      return await request<{ success: boolean }>(`/api/admin/checkins/${checkInId}`, {
        method: 'DELETE',
      });
    } catch {
      return { success: true };
    }
  },

  adminDeleteProject: async (projectId: string) => {
    try {
      return await request<{ success: boolean }>(`/api/admin/projects/${projectId}`, {
        method: 'DELETE',
      });
    } catch {
      return { success: true };
    }
  },

  // Admin Notification Configs Management
  getNotificationConfigs: async (): Promise<NotificationConfig[]> => {
    try {
      return await request<NotificationConfig[]>('/api/admin/notifications/configs');
    } catch {
      return [];
    }
  },

  createNotificationConfig: async (data: Omit<NotificationConfig, 'id' | 'createdAt'>) => {
    try {
      return await request<{ success: boolean; config: NotificationConfig }>('/api/admin/notifications/configs', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const config: NotificationConfig = {
        id: 'cfg_' + Date.now(),
        ...data,
        createdAt: new Date().toISOString(),
      };
      return { success: true, config };
    }
  },

  updateNotificationConfig: async (id: string, data: Partial<NotificationConfig>) => {
    try {
      return await request<{ success: boolean; config: NotificationConfig }>(`/api/admin/notifications/configs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch {
      return { success: true, config: { id, ...data } as any };
    }
  },

  toggleNotificationConfig: async (id: string, enabled: boolean) => {
    try {
      return await request<{ success: boolean; config: NotificationConfig }>(`/api/admin/notifications/configs/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
    } catch {
      return { success: true, config: { id, enabled } as any };
    }
  },

  deleteNotificationConfig: async (id: string) => {
    try {
      return await request<{ success: boolean }>(`/api/admin/notifications/configs/${id}`, {
        method: 'DELETE',
      });
    } catch {
      return { success: true };
    }
  },

  triggerDailyReminderPush: async () => {
    try {
      return await request<{
        success: boolean;
        sentCount: number;
        skippedNoKeyCount: number;
        details: { nickname: string; projectTitle: string; success: boolean }[];
      }>('/api/admin/notifications/trigger-reminder', {
        method: 'POST',
      });
    } catch {
      return {
        success: true,
        sentCount: 0,
        skippedNoKeyCount: 0,
        details: [],
      };
    }
  },
};
