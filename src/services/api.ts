import {
  User,
  HabitProject,
  CheckInRule,
  CheckInRecord,
  DailyComment,
  FriendRequest,
  FriendUser,
  ChatMessage,
  AdminUserSummary,
  AdminUserDetail,
  NotificationConfig,
} from '../types';

let authToken: string | null = localStorage.getItem('auth_token');

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const getAuthToken = () => authToken;

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

export const api = {
  // Auth
  register: (data: { username: string; password: string; nickname: string }) =>
    request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { username: string; password: string }) =>
    request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: () => request<User>('/api/auth/me'),

  updateSendKey: (sendKey: string) =>
    request<{ success: boolean; serverchanSendKey: string }>('/api/user/sendkey', {
      method: 'POST',
      body: JSON.stringify({ sendKey }),
    }),

  testPush: (sendKey?: string) =>
    request<{ success: boolean; message: string }>('/api/push/test', {
      method: 'POST',
      body: JSON.stringify({ sendKey }),
    }),

  // Friends
  getFriends: () => request<FriendUser[]>('/api/friends/list'),
  getFriendRequests: () => request<(FriendRequest & { fromUser: User })[]>('/api/friends/requests'),
  sendFriendRequest: (toUsername: string) =>
    request<FriendRequest>('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ toUsername }),
    }),
  respondFriendRequest: (requestId: string, action: 'accept' | 'reject') =>
    request<{ success: boolean }>('/api/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ requestId, action }),
    }),
  searchUsers: (q: string) => request<User[]>(`/api/friends/search?q=${encodeURIComponent(q)}`),

  // Projects
  getProjects: () => request<HabitProject[]>('/api/projects/list'),
  createProject: (data: {
    title: string;
    isProxy: boolean;
    selectedFriendIds?: string[];
    creatorParticipates?: boolean;
    rules: CheckInRule;
  }) =>
    request<HabitProject>('/api/projects/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProjectRules: (projectId: string, rules: CheckInRule) =>
    request<HabitProject>(`/api/projects/${projectId}/rule`, {
      method: 'PUT',
      body: JSON.stringify({ rules }),
    }),
  removeMember: (projectId: string, memberId: string) =>
    request<HabitProject>(`/api/projects/${projectId}/remove-member`, {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    }),
  addMember: (projectId: string, memberId: string) =>
    request<HabitProject>(`/api/projects/${projectId}/add-member`, {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    }),

  // Calendar & Checkins
  getCalendarData: (projectId: string, month: string) =>
    request<{
      month: string;
      project: HabitProject;
      days: Record<
        string,
        {
          date: string;
          status: 'red' | 'yellow' | 'gray';
          records: CheckInRecord[];
          allQualified: boolean;
          hasAnySubmission: boolean;
          hasMySubmission: boolean;
          isMyQualified: boolean;
        }
      >;
    }>(`/api/checkins/calendar?projectId=${encodeURIComponent(projectId)}&month=${encodeURIComponent(month)}`),

  submitCheckIn: (data: {
    projectId: string;
    date: string;
    photos: string[];
    videos: string[];
    audios: { url: string; duration: number }[];
    text: string;
  }) =>
    request<{
      record: CheckInRecord;
      sparkUpdate: { newSpark: number; isRekindling: boolean; rekindleProgress: number };
    }>('/api/checkins/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDayDetail: (projectId: string, date: string) =>
    request<{
      date: string;
      records: CheckInRecord[];
      comments: DailyComment[];
    }>(`/api/checkins/day-detail?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`),

  // Comments
  getComments: (projectId: string, date: string) =>
    request<DailyComment[]>(`/api/comments/list?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`),

  addComment: (data: {
    projectId: string;
    date: string;
    content: string;
    replyToCommentId?: string;
    replyToNickname?: string;
  }) =>
    request<DailyComment>('/api/comments/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Messages
  getMessages: (friendId: string) => request<ChatMessage[]>(`/api/messages/${friendId}`),
  sendMessage: (data: {
    receiverId: string;
    type: 'text' | 'image' | 'audio';
    content: string;
    audioDuration?: number;
  }) =>
    request<ChatMessage>('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  markMessagesRead: (friendId: string) =>
    request<{ success: boolean }>('/api/messages/read', {
      method: 'POST',
      body: JSON.stringify({ friendId }),
    }),
  getBadgeCount: () => request<{ unreadCount: number }>('/api/notifications/badge'),

  // Admin Master API (Highest Authority)
  getAdminUsers: () => request<AdminUserSummary[]>('/api/admin/users'),
  updateUserPassword: (userId: string, password: string) =>
    request<{ success: boolean; user: any }>(`/api/admin/users/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  getAdminUserDetail: (userId: string) =>
    request<AdminUserDetail>(`/api/admin/users/${userId}/detail`),
  adminCreateCheckIn: (data: {
    projectId: string;
    userId: string;
    date: string;
    photos?: string[];
    videos?: string[];
    audios?: { url: string; duration: number }[];
    text?: string;
    isQualified?: boolean;
  }) =>
    request<{ success: boolean; record: CheckInRecord }>('/api/admin/checkins', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  adminUpdateCheckIn: (
    checkInId: string,
    data: {
      photos?: string[];
      videos?: string[];
      audios?: { url: string; duration: number }[];
      text?: string;
      isQualified?: boolean;
      date?: string;
    }
  ) =>
    request<{ success: boolean; record: CheckInRecord }>(`/api/admin/checkins/${checkInId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  adminDeleteCheckIn: (checkInId: string) =>
    request<{ success: boolean }>(`/api/admin/checkins/${checkInId}`, {
      method: 'DELETE',
    }),
  adminDeleteProject: (projectId: string) =>
    request<{ success: boolean }>(`/api/admin/projects/${projectId}`, {
      method: 'DELETE',
    }),

  // Admin Notification Configs Management
  getNotificationConfigs: () => request<NotificationConfig[]>('/api/admin/notifications/configs'),

  createNotificationConfig: (data: Omit<NotificationConfig, 'id' | 'createdAt'>) =>
    request<{ success: boolean; config: NotificationConfig }>('/api/admin/notifications/configs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateNotificationConfig: (id: string, data: Partial<NotificationConfig>) =>
    request<{ success: boolean; config: NotificationConfig }>(`/api/admin/notifications/configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleNotificationConfig: (id: string, enabled: boolean) =>
    request<{ success: boolean; config: NotificationConfig }>(`/api/admin/notifications/configs/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  deleteNotificationConfig: (id: string) =>
    request<{ success: boolean }>(`/api/admin/notifications/configs/${id}`, {
      method: 'DELETE',
    }),

  triggerDailyReminderPush: () =>
    request<{
      success: boolean;
      sentCount: number;
      skippedNoKeyCount: number;
      details: { nickname: string; projectTitle: string; success: boolean }[];
    }>('/api/admin/notifications/trigger-reminder', {
      method: 'POST',
    }),
};

