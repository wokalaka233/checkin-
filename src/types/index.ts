export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar?: string;
  serverchanSendKey?: string;
  createdAt: string;
  isAdmin?: boolean;
  role?: string;
}

export interface AdminUserSummary extends User {
  password?: string;
  projectCount: number;
  checkInCount: number;
  lastCheckInDate?: string | null;
}

export interface AdminUserDetail {
  user: User & { password?: string };
  projects: HabitProject[];
  allProjects: HabitProject[];
  checkIns: (CheckInRecord & { projectTitle?: string })[];
}

export interface CheckInRule {
  requirePhotos: boolean;
  minPhotos: number;
  requireVideo: boolean;
  requireAudio: boolean;
  requireText: boolean;
  note?: string;
  reminderEnabled?: boolean;
  reminderTime?: string;
  reminderMessage?: string;
}

export interface HabitProject {
  id: string;
  title: string;
  creatorId: string;
  creatorNickname?: string;
  members: string[]; // userIds
  memberUsers?: User[];
  sparks: Record<string, number>; // userId -> spark count
  removedMembers?: Record<string, {
    lockedSparks: number;
    rekindleStreak: number;
    removedAt: string;
  }>;
  rules: CheckInRule;
  createdAt: string;
  currentUserSpark?: number;
  rekindleStatus?: {
    isRekindling: boolean;
    progress: number; // 0..3
    lockedSparks: number;
  };
  reminderEnabled?: boolean;
  reminderTime?: string;
  reminderMessage?: string;
}

export interface CheckInAudio {
  url: string;
  duration: number;
}

export interface CheckInRecord {
  id: string;
  projectId: string;
  userId: string;
  userNickname?: string;
  userAvatar?: string;
  date: string; // 'YYYY-MM-DD'
  photos: string[];
  videos: string[];
  audios: CheckInAudio[];
  text: string;
  isQualified: boolean;
  ruleSnapshot?: CheckInRule;
  createdAt: string;
}

export type DayCompletionStatus = 'red' | 'yellow' | 'gray';

export interface DaySummary {
  date: string;
  status: DayCompletionStatus; // red: 全员达标, yellow: 部分打卡未达标, gray: 缺勤
  records: CheckInRecord[];
  allQualified: boolean;
  hasAnySubmission: boolean;
  hasMySubmission: boolean;
  isMyQualified: boolean;
}

export interface DailyComment {
  id: string;
  projectId: string;
  date: string; // 'YYYY-MM-DD'
  userId: string;
  userNickname: string;
  userAvatar?: string;
  content: string;
  replyToCommentId?: string;
  replyToNickname?: string;
  createdAt: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUser?: User;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface FriendUser extends User {
  unreadCount?: number;
  lastMessage?: ChatMessage;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  type: 'text' | 'image' | 'audio';
  content: string;
  audioDuration?: number;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationConfig {
  id: string;
  type: 'daily_uncheck_reminder' | 'friend_chat' | 'new_comment' | 'project_finished' | 'custom' | string;
  name: string;
  description: string;
  enabled: boolean;
  triggerTime?: string;
  titleTemplate: string;
  contentTemplate: string;
  quotaCostNote: string;
  createdAt: string;
}

