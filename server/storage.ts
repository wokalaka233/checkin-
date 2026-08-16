import fs from 'fs';
import path from 'path';

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  nickname: string;
  avatar: string;
  serverchanSendKey?: string;
  createdAt: string;
}

export interface StoredFriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface StoredFriendship {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: string;
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

export interface StoredProject {
  id: string;
  title: string;
  creatorId: string;
  members: string[]; // userIds
  sparks: Record<string, number>; // userId -> spark count
  removedMembers: Record<string, {
    lockedSparks: number;
    rekindleStreak: number;
    removedAt: string;
  }>;
  rules: CheckInRule;
  reminderEnabled?: boolean;
  reminderTime?: string;
  reminderMessage?: string;
  createdAt: string;
}

export interface StoredCheckInRecord {
  id: string;
  projectId: string;
  userId: string;
  date: string; // 'YYYY-MM-DD'
  photos: string[];
  videos: string[];
  audios: { url: string; duration: number }[];
  text: string;
  isQualified: boolean;
  ruleSnapshot: CheckInRule;
  createdAt: string;
}

export interface StoredComment {
  id: string;
  projectId: string;
  date: string; // 'YYYY-MM-DD'
  userId: string;
  content: string;
  replyToCommentId?: string;
  replyToNickname?: string;
  createdAt: string;
}

export interface StoredMessage {
  id: string;
  senderId: string;
  receiverId: string;
  type: 'text' | 'image' | 'audio';
  content: string;
  audioDuration?: number;
  isRead: boolean;
  createdAt: string;
}

export interface StoredNotificationConfig {
  id: string;
  type: string; // 'daily_uncheck_reminder' | 'friend_chat' | 'new_comment' | 'project_finished' | 'custom'
  name: string;
  description: string;
  enabled: boolean;
  triggerTime?: string;
  titleTemplate: string;
  contentTemplate: string;
  quotaCostNote: string;
  createdAt: string;
}

export interface StorageData {
  users: StoredUser[];
  friendRequests: StoredFriendRequest[];
  friendships: StoredFriendship[];
  projects: StoredProject[];
  checkIns: StoredCheckInRecord[];
  comments: StoredComment[];
  messages: StoredMessage[];
  notificationConfigs: StoredNotificationConfig[];
}

export interface IDatabaseAdapter {
  init(): Promise<void>;
  getUserById(id: string): Promise<StoredUser | null>;
  getUserByUsername(username: string): Promise<StoredUser | null>;
  createUser(user: Omit<StoredUser, 'id' | 'createdAt'>): Promise<StoredUser>;
  updateUserSendKey(userId: string, sendKey: string): Promise<StoredUser>;
  searchUsers(query: string, excludeUserId: string): Promise<StoredUser[]>;
  
  // Friends
  getFriends(userId: string): Promise<StoredUser[]>;
  getFriendRequests(userId: string): Promise<(StoredFriendRequest & { fromUser: StoredUser })[]>;
  sendFriendRequest(fromUserId: string, toUsername: string): Promise<StoredFriendRequest>;
  respondFriendRequest(requestId: string, userId: string, action: 'accept' | 'reject'): Promise<boolean>;
  
  // Projects
  getProjectsForUser(userId: string): Promise<StoredProject[]>;
  getProjectById(id: string): Promise<StoredProject | null>;
  createProject(data: {
    title: string;
    creatorId: string;
    members: string[];
    rules: CheckInRule;
  }): Promise<StoredProject>;
  updateProjectRules(projectId: string, creatorId: string, rules: CheckInRule): Promise<StoredProject>;
  removeMemberFromProject(projectId: string, creatorId: string, memberId: string): Promise<StoredProject>;
  addMemberToProject(projectId: string, creatorId: string, memberId: string): Promise<StoredProject>;
  
  // Checkins
  getCheckInsForProject(projectId: string, monthPrefix?: string): Promise<StoredCheckInRecord[]>;
  submitCheckIn(data: {
    projectId: string;
    userId: string;
    date: string;
    photos: string[];
    videos: string[];
    audios: { url: string; duration: number }[];
    text: string;
  }): Promise<{ record: StoredCheckInRecord; sparkUpdate: { newSpark: number; isRekindling: boolean; rekindleProgress: number } }>;
  
  // Comments
  getCommentsForDate(projectId: string, date: string): Promise<(StoredComment & { userNickname: string; userAvatar: string })[]>;
  addComment(data: {
    projectId: string;
    date: string;
    userId: string;
    content: string;
    replyToCommentId?: string;
    replyToNickname?: string;
  }): Promise<StoredComment & { userNickname: string; userAvatar: string }>;

  // Chat
  getMessages(user1Id: string, user2Id: string): Promise<StoredMessage[]>;
  sendMessage(data: {
    senderId: string;
    receiverId: string;
    type: 'text' | 'image' | 'audio';
    content: string;
    audioDuration?: number;
  }): Promise<StoredMessage>;
  markMessagesRead(senderId: string, receiverId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;

  // Admin & Management
  getAllUsers(): Promise<StoredUser[]>;
  updateUserPassword(userId: string, newPasswordHash: string): Promise<StoredUser | null>;
  getAllProjects(): Promise<StoredProject[]>;
  getAllCheckInsForUser(userId: string): Promise<StoredCheckInRecord[]>;
  deleteCheckIn(checkInId: string): Promise<boolean>;
  updateCheckIn(checkInId: string, data: Partial<StoredCheckInRecord>): Promise<StoredCheckInRecord | null>;
  createCheckInAdmin(data: {
    projectId: string;
    userId: string;
    date: string;
    photos: string[];
    videos: string[];
    audios: { url: string; duration: number }[];
    text: string;
    isQualified?: boolean;
  }): Promise<StoredCheckInRecord>;
  deleteProject(projectId: string): Promise<boolean>;

  // Notification Configs Management
  getNotificationConfigs(): Promise<StoredNotificationConfig[]>;
  createNotificationConfig(data: Omit<StoredNotificationConfig, 'id' | 'createdAt'>): Promise<StoredNotificationConfig>;
  updateNotificationConfig(id: string, data: Partial<StoredNotificationConfig>): Promise<StoredNotificationConfig | null>;
  deleteNotificationConfig(id: string): Promise<boolean>;
  toggleNotificationConfig(id: string, enabled: boolean): Promise<StoredNotificationConfig | null>;
}

export class JsonFileDatabaseAdapter implements IDatabaseAdapter {
  private filePath: string;
  private data: StorageData = {
    users: [],
    friendRequests: [],
    friendships: [],
    projects: [],
    checkIns: [],
    comments: [],
    messages: [],
    notificationConfigs: [],
  };

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), '.data', 'store.json');
  }

  async init(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        await this.seedInitialData();
        await this.persist();
      }
    } catch (e) {
      console.error('Failed to init JsonFileDatabaseAdapter:', e);
      await this.seedInitialData();
    }
  }

  private async persist(): Promise<void> {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to persist database:', e);
    }
  }

  private async seedInitialData(): Promise<void> {
    const now = new Date().toISOString();
    const demoUsers: StoredUser[] = [
      {
        id: 'u_demo1',
        username: 'user1',
        passwordHash: '123456',
        nickname: '打卡先锋',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        createdAt: now,
      },
      {
        id: 'u_demo2',
        username: 'user2',
        passwordHash: '123456',
        nickname: '晨跑小鹿',
        avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
        createdAt: now,
      },
      {
        id: 'u_demo3',
        username: 'user3',
        passwordHash: '123456',
        nickname: '读书伴侣',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        createdAt: now,
      },
    ];

    this.data.users = demoUsers;
    this.data.friendships = [
      { id: 'f_1_2', user1Id: 'u_demo1', user2Id: 'u_demo2', createdAt: now },
      { id: 'f_1_3', user1Id: 'u_demo1', user2Id: 'u_demo3', createdAt: now },
    ];

    const sampleProject: StoredProject = {
      id: 'p_morning_run',
      title: '每日晨练与健康打卡',
      creatorId: 'u_demo1',
      members: ['u_demo1', 'u_demo2', 'u_demo3'],
      sparks: {
        u_demo1: 7,
        u_demo2: 5,
        u_demo3: 3,
      },
      removedMembers: {},
      rules: {
        requirePhotos: true,
        minPhotos: 1,
        requireVideo: false,
        requireAudio: false,
        requireText: true,
        note: '每日早晨运动完成拍照一张，并写一句话感言',
      },
      createdAt: now,
    };

    this.data.projects = [sampleProject];
  }

  async getUserById(id: string): Promise<StoredUser | null> {
    return this.data.users.find(u => u.id === id) || null;
  }

  async getUserByUsername(username: string): Promise<StoredUser | null> {
    return this.data.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  async createUser(userData: Omit<StoredUser, 'id' | 'createdAt'>): Promise<StoredUser> {
    const user: StoredUser = {
      id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...userData,
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(user);
    await this.persist();
    return user;
  }

  async updateUserSendKey(userId: string, sendKey: string): Promise<StoredUser> {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    user.serverchanSendKey = sendKey ? sendKey.trim() : '';
    await this.persist();
    return user;
  }

  async searchUsers(query: string, excludeUserId: string): Promise<StoredUser[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.data.users.filter(
      u => u.id !== excludeUserId && (u.username.toLowerCase().includes(q) || u.nickname.toLowerCase().includes(q))
    );
  }

  async getFriends(userId: string): Promise<StoredUser[]> {
    const friendIds = this.data.friendships
      .filter(f => f.user1Id === userId || f.user2Id === userId)
      .map(f => (f.user1Id === userId ? f.user2Id : f.user1Id));

    return this.data.users.filter(u => friendIds.includes(u.id));
  }

  async getFriendRequests(userId: string): Promise<(StoredFriendRequest & { fromUser: StoredUser })[]> {
    const reqs = this.data.friendRequests.filter(r => r.toUserId === userId && r.status === 'pending');
    const result: (StoredFriendRequest & { fromUser: StoredUser })[] = [];
    for (const r of reqs) {
      const fromUser = await this.getUserById(r.fromUserId);
      if (fromUser) {
        result.push({ ...r, fromUser });
      }
    }
    return result;
  }

  async sendFriendRequest(fromUserId: string, toUsername: string): Promise<StoredFriendRequest> {
    const target = await this.getUserByUsername(toUsername);
    if (!target) throw new Error('用户不存在');
    if (target.id === fromUserId) throw new Error('不能添加自己为好友');

    const alreadyFriends = this.data.friendships.some(
      f => (f.user1Id === fromUserId && f.user2Id === target.id) || (f.user1Id === target.id && f.user2Id === fromUserId)
    );
    if (alreadyFriends) throw new Error('已经是好友了');

    const existingReq = this.data.friendRequests.find(
      r => r.fromUserId === fromUserId && r.toUserId === target.id && r.status === 'pending'
    );
    if (existingReq) return existingReq;

    const newReq: StoredFriendRequest = {
      id: `freq_${Date.now()}`,
      fromUserId,
      toUserId: target.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.data.friendRequests.push(newReq);
    await this.persist();
    return newReq;
  }

  async respondFriendRequest(requestId: string, userId: string, action: 'accept' | 'reject'): Promise<boolean> {
    const req = this.data.friendRequests.find(r => r.id === requestId && r.toUserId === userId);
    if (!req) return false;

    req.status = action === 'accept' ? 'accepted' : 'rejected';
    if (action === 'accept') {
      const already = this.data.friendships.some(
        f =>
          (f.user1Id === req.fromUserId && f.user2Id === req.toUserId) ||
          (f.user1Id === req.toUserId && f.user2Id === req.fromUserId)
      );
      if (!already) {
        this.data.friendships.push({
          id: `f_${Date.now()}`,
          user1Id: req.fromUserId,
          user2Id: req.toUserId,
          createdAt: new Date().toISOString(),
        });
      }
    }
    await this.persist();
    return true;
  }

  async getProjectsForUser(userId: string): Promise<StoredProject[]> {
    return this.data.projects.filter(p => p.members.includes(userId));
  }

  async getProjectById(id: string): Promise<StoredProject | null> {
    return this.data.projects.find(p => p.id === id) || null;
  }

  async createProject(data: {
    title: string;
    creatorId: string;
    members: string[];
    rules: CheckInRule;
    reminderEnabled?: boolean;
    reminderTime?: string;
    reminderMessage?: string;
  }): Promise<StoredProject> {
    const sparks: Record<string, number> = {};
    for (const m of data.members) {
      sparks[m] = 0;
    }

    const project: StoredProject = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: data.title,
      creatorId: data.creatorId,
      members: data.members,
      sparks,
      removedMembers: {},
      rules: data.rules,
      reminderEnabled: data.reminderEnabled ?? data.rules.reminderEnabled ?? false,
      reminderTime: data.reminderTime || data.rules.reminderTime || '21:00',
      reminderMessage: data.reminderMessage || data.rules.reminderMessage || '',
      createdAt: new Date().toISOString(),
    };

    this.data.projects.push(project);
    await this.persist();
    return project;
  }

  async updateProjectRules(projectId: string, creatorId: string, rules: CheckInRule): Promise<StoredProject> {
    const project = await this.getProjectById(projectId);
    if (!project) throw new Error('项目不存在');
    if (project.creatorId !== creatorId) throw new Error('只有创建者可修改规则');

    project.rules = rules;
    if (rules.reminderEnabled !== undefined) project.reminderEnabled = rules.reminderEnabled;
    if (rules.reminderTime !== undefined) project.reminderTime = rules.reminderTime;
    if (rules.reminderMessage !== undefined) project.reminderMessage = rules.reminderMessage;
    await this.persist();
    return project;
  }

  async removeMemberFromProject(projectId: string, creatorId: string, memberId: string): Promise<StoredProject> {
    const project = await this.getProjectById(projectId);
    if (!project) throw new Error('项目不存在');
    if (project.creatorId !== creatorId) throw new Error('只有创建者可管理成员');
    if (memberId === project.creatorId) throw new Error('创建者不能移出自己');

    const currentSparks = project.sparks[memberId] || 0;
    if (!project.removedMembers) project.removedMembers = {};
    project.removedMembers[memberId] = {
      lockedSparks: currentSparks,
      rekindleStreak: 0,
      removedAt: new Date().toISOString(),
    };

    project.members = project.members.filter(m => m !== memberId);
    delete project.sparks[memberId];

    await this.persist();
    return project;
  }

  async addMemberToProject(projectId: string, creatorId: string, memberId: string): Promise<StoredProject> {
    const project = await this.getProjectById(projectId);
    if (!project) throw new Error('项目不存在');
    if (project.creatorId !== creatorId) throw new Error('只有创建者可管理成员');

    if (!project.members.includes(memberId)) {
      project.members.push(memberId);
      // Check if rekindling
      if (project.removedMembers && project.removedMembers[memberId]) {
        project.sparks[memberId] = 0; // Starts from 0 until 3 consecutive qualified checkins
        project.removedMembers[memberId].rekindleStreak = 0;
      } else {
        project.sparks[memberId] = 0;
      }
    }

    await this.persist();
    return project;
  }

  async getCheckInsForProject(projectId: string, monthPrefix?: string): Promise<StoredCheckInRecord[]> {
    return this.data.checkIns.filter(
      c => c.projectId === projectId && (!monthPrefix || c.date.startsWith(monthPrefix))
    );
  }

  async submitCheckIn(data: {
    projectId: string;
    userId: string;
    date: string;
    photos: string[];
    videos: string[];
    audios: { url: string; duration: number }[];
    text: string;
  }): Promise<{ record: StoredCheckInRecord; sparkUpdate: { newSpark: number; isRekindling: boolean; rekindleProgress: number } }> {
    const project = await this.getProjectById(data.projectId);
    if (!project) throw new Error('打卡项目不存在');
    if (!project.members.includes(data.userId)) throw new Error('你不在该项目成员列表中');

    // Rule evaluation
    const rule = project.rules;
    const meetsPhotos = !rule.requirePhotos || data.photos.length >= (rule.minPhotos || 1);
    const meetsVideo = !rule.requireVideo || data.videos.length > 0;
    const meetsAudio = !rule.requireAudio || data.audios.length > 0;
    const meetsText = !rule.requireText || data.text.trim().length > 0;
    const isQualified = meetsPhotos && meetsVideo && meetsAudio && meetsText;

    // Check existing record for this user & date
    let existing = this.data.checkIns.find(
      c => c.projectId === data.projectId && c.userId === data.userId && c.date === data.date
    );

    const now = new Date().toISOString();
    let record: StoredCheckInRecord;

    const wasQualified = existing ? existing.isQualified : false;

    if (existing) {
      existing.photos = data.photos;
      existing.videos = data.videos;
      existing.audios = data.audios;
      existing.text = data.text;
      // If rule changed previously, a previously qualified check-in does not lose qualification,
      // but new qualifications apply
      existing.isQualified = wasQualified || isQualified;
      record = existing;
    } else {
      record = {
        id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        projectId: data.projectId,
        userId: data.userId,
        date: data.date,
        photos: data.photos,
        videos: data.videos,
        audios: data.audios,
        text: data.text,
        isQualified,
        ruleSnapshot: { ...rule },
        createdAt: now,
      };
      this.data.checkIns.push(record);
    }

    // Rekindle & Spark calculation
    const isRekindling = !!(project.removedMembers && project.removedMembers[data.userId]);
    let rekindleProgress = 0;
    let newSpark = project.sparks[data.userId] || 0;

    if (record.isQualified && !wasQualified) {
      if (isRekindling) {
        const rekindleInfo = project.removedMembers[data.userId];
        rekindleInfo.rekindleStreak = (rekindleInfo.rekindleStreak || 0) + 1;
        rekindleProgress = rekindleInfo.rekindleStreak;
        if (rekindleInfo.rekindleStreak >= 3) {
          // Rekindle complete! Restore locked sparks + 3
          newSpark = rekindleInfo.lockedSparks + 3;
          project.sparks[data.userId] = newSpark;
          delete project.removedMembers[data.userId];
        } else {
          newSpark = rekindleInfo.rekindleStreak;
          project.sparks[data.userId] = newSpark;
        }
      } else {
        newSpark = (project.sparks[data.userId] || 0) + 1;
        project.sparks[data.userId] = newSpark;
      }
    }

    await this.persist();
    return {
      record,
      sparkUpdate: {
        newSpark,
        isRekindling: !!(project.removedMembers && project.removedMembers[data.userId]),
        rekindleProgress,
      },
    };
  }

  async getCommentsForDate(projectId: string, date: string): Promise<(StoredComment & { userNickname: string; userAvatar: string })[]> {
    const rawComments = this.data.comments.filter(c => c.projectId === projectId && c.date === date);
    const results: (StoredComment & { userNickname: string; userAvatar: string })[] = [];
    for (const c of rawComments) {
      const user = await this.getUserById(c.userId);
      results.push({
        ...c,
        userNickname: user?.nickname || '未知成员',
        userAvatar: user?.avatar || '',
      });
    }
    return results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async addComment(data: {
    projectId: string;
    date: string;
    userId: string;
    content: string;
    replyToCommentId?: string;
    replyToNickname?: string;
  }): Promise<StoredComment & { userNickname: string; userAvatar: string }> {
    const user = await this.getUserById(data.userId);
    if (!user) throw new Error('用户不存在');

    const comment: StoredComment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      projectId: data.projectId,
      date: data.date,
      userId: data.userId,
      content: data.content.trim(),
      replyToCommentId: data.replyToCommentId,
      replyToNickname: data.replyToNickname,
      createdAt: new Date().toISOString(),
    };

    this.data.comments.push(comment);
    await this.persist();

    return {
      ...comment,
      userNickname: user.nickname,
      userAvatar: user.avatar,
    };
  }

  async getMessages(user1Id: string, user2Id: string): Promise<StoredMessage[]> {
    return this.data.messages.filter(
      m => (m.senderId === user1Id && m.receiverId === user2Id) || (m.senderId === user2Id && m.receiverId === user1Id)
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async sendMessage(data: {
    senderId: string;
    receiverId: string;
    type: 'text' | 'image' | 'audio';
    content: string;
    audioDuration?: number;
  }): Promise<StoredMessage> {
    const msg: StoredMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: data.senderId,
      receiverId: data.receiverId,
      type: data.type,
      content: data.content,
      audioDuration: data.audioDuration,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    this.data.messages.push(msg);
    await this.persist();
    return msg;
  }

  async markMessagesRead(senderId: string, receiverId: string): Promise<void> {
    let changed = false;
    for (const m of this.data.messages) {
      if (m.senderId === senderId && m.receiverId === receiverId && !m.isRead) {
        m.isRead = true;
        changed = true;
      }
    }
    if (changed) {
      await this.persist();
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const unreadMsgs = this.data.messages.filter(m => m.receiverId === userId && !m.isRead).length;
    const unreadReqs = this.data.friendRequests.filter(r => r.toUserId === userId && r.status === 'pending').length;
    return unreadMsgs + unreadReqs;
  }

  // --- Admin Methods ---
  async getAllUsers(): Promise<StoredUser[]> {
    return [...this.data.users];
  }

  async updateUserPassword(userId: string, newPasswordHash: string): Promise<StoredUser | null> {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return null;
    user.passwordHash = newPasswordHash;
    await this.persist();
    return user;
  }

  async getAllProjects(): Promise<StoredProject[]> {
    return [...this.data.projects];
  }

  async getAllCheckInsForUser(userId: string): Promise<StoredCheckInRecord[]> {
    return this.data.checkIns
      .filter(c => c.userId === userId)
      .sort((a, b) => (a.date > b.date ? -1 : 1));
  }

  async deleteCheckIn(checkInId: string): Promise<boolean> {
    const idx = this.data.checkIns.findIndex(c => c.id === checkInId);
    if (idx === -1) return false;
    this.data.checkIns.splice(idx, 1);
    await this.persist();
    return true;
  }

  async updateCheckIn(checkInId: string, patch: Partial<StoredCheckInRecord>): Promise<StoredCheckInRecord | null> {
    const item = this.data.checkIns.find(c => c.id === checkInId);
    if (!item) return null;
    if (patch.photos !== undefined) item.photos = patch.photos;
    if (patch.videos !== undefined) item.videos = patch.videos;
    if (patch.audios !== undefined) item.audios = patch.audios;
    if (patch.text !== undefined) item.text = patch.text;
    if (patch.isQualified !== undefined) item.isQualified = patch.isQualified;
    if (patch.date !== undefined) item.date = patch.date;
    await this.persist();
    return item;
  }

  async createCheckInAdmin(data: {
    projectId: string;
    userId: string;
    date: string;
    photos: string[];
    videos: string[];
    audios: { url: string; duration: number }[];
    text: string;
    isQualified?: boolean;
  }): Promise<StoredCheckInRecord> {
    const project = await this.getProjectById(data.projectId);
    const existingIndex = this.data.checkIns.findIndex(
      c => c.projectId === data.projectId && c.userId === data.userId && c.date === data.date
    );

    const record: StoredCheckInRecord = {
      id: existingIndex >= 0 ? this.data.checkIns[existingIndex].id : `chk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      projectId: data.projectId,
      userId: data.userId,
      date: data.date,
      photos: data.photos || [],
      videos: data.videos || [],
      audios: data.audios || [],
      text: data.text || '',
      isQualified: data.isQualified !== undefined ? data.isQualified : true,
      ruleSnapshot: project ? project.rules : {
        requirePhotos: false,
        minPhotos: 0,
        requireVideo: false,
        requireAudio: false,
        requireText: false,
      },
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.data.checkIns[existingIndex] = record;
    } else {
      this.data.checkIns.push(record);
    }
    await this.persist();
    return record;
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const idx = this.data.projects.findIndex(p => p.id === projectId);
    if (idx === -1) return false;
    this.data.projects.splice(idx, 1);
    this.data.checkIns = this.data.checkIns.filter(c => c.projectId !== projectId);
    this.data.comments = this.data.comments.filter(c => c.projectId !== projectId);
    await this.persist();
    return true;
  }

  // --- Notification Configs ---
  private getDefaultNotificationConfigs(): StoredNotificationConfig[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'cfg_daily_uncheck',
        type: 'daily_uncheck_reminder',
        name: '每日晚间未打卡催促',
        description: '每晚定时扫描当天未完成打卡的项目成员，通过微信发送精准催促',
        enabled: true,
        triggerTime: '21:00',
        titleTemplate: '⏰ 每日打卡提醒：今天还有未完成的任务',
        contentTemplate: '【{nickname}】，您参与的项目【{projectTitle}】今天还没有打卡哦，距离今日截止仅剩最后几个小时，快去完成吧！',
        quotaCostNote: '每晚仅针对未打卡成员发送 1 条微信（极度节省额度）',
        createdAt: now,
      },
      {
        id: 'cfg_friend_chat',
        type: 'friend_chat',
        name: '好友私信即时提醒',
        description: '收到好友私聊消息时，即时通过微信服务号发送新消息提醒',
        enabled: false,
        titleTemplate: '💬 收到一条新的好友私聊',
        contentTemplate: '好友【{senderNickname}】给您发了一条私聊：{messagePreview}，快去打卡应用查看回复吧！',
        quotaCostNote: '每收到一条私信发送 1 条微信（建议后期升级高额度套餐后开启）',
        createdAt: now,
      },
      {
        id: 'cfg_new_comment',
        type: 'new_comment',
        name: '打卡日历新互动/评论',
        description: '其他成员在日历或打卡详情中留言时发送通知',
        enabled: false,
        titleTemplate: '📝 打卡日历收到新互动',
        contentTemplate: '【{userNickname}】在【{date}】的打卡日历中发表了评论：{commentPreview}',
        quotaCostNote: '每条新评论发送 1 条微信（可选开启）',
        createdAt: now,
      },
      {
        id: 'cfg_project_finished',
        type: 'project_finished',
        name: '同伴打卡动态播报',
        description: '同一项目的伙伴完成打卡时，向其他成员广播鼓劲',
        enabled: false,
        titleTemplate: '✨ 成员打卡动态',
        contentTemplate: '【{nickname}】刚刚完成了【{projectTitle}】今日打卡！快去日历为他点赞吧！',
        quotaCostNote: '成员每打卡一次发送 1 条微信',
        createdAt: now,
      },
    ];
  }

  async getNotificationConfigs(): Promise<StoredNotificationConfig[]> {
    if (!this.data.notificationConfigs || this.data.notificationConfigs.length === 0) {
      this.data.notificationConfigs = this.getDefaultNotificationConfigs();
      await this.persist();
    }
    return this.data.notificationConfigs;
  }

  async createNotificationConfig(data: Omit<StoredNotificationConfig, 'id' | 'createdAt'>): Promise<StoredNotificationConfig> {
    const config: StoredNotificationConfig = {
      id: `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...data,
      createdAt: new Date().toISOString(),
    };
    if (!this.data.notificationConfigs) {
      this.data.notificationConfigs = this.getDefaultNotificationConfigs();
    }
    this.data.notificationConfigs.push(config);
    await this.persist();
    return config;
  }

  async updateNotificationConfig(id: string, data: Partial<StoredNotificationConfig>): Promise<StoredNotificationConfig | null> {
    if (!this.data.notificationConfigs) {
      this.data.notificationConfigs = this.getDefaultNotificationConfigs();
    }
    const idx = this.data.notificationConfigs.findIndex(c => c.id === id);
    if (idx === -1) return null;
    this.data.notificationConfigs[idx] = {
      ...this.data.notificationConfigs[idx],
      ...data,
      id, // protect id
    };
    await this.persist();
    return this.data.notificationConfigs[idx];
  }

  async deleteNotificationConfig(id: string): Promise<boolean> {
    if (!this.data.notificationConfigs) return false;
    const idx = this.data.notificationConfigs.findIndex(c => c.id === id);
    if (idx === -1) return false;
    this.data.notificationConfigs.splice(idx, 1);
    await this.persist();
    return true;
  }

  async toggleNotificationConfig(id: string, enabled: boolean): Promise<StoredNotificationConfig | null> {
    return this.updateNotificationConfig(id, { enabled });
  }
}

export const db: IDatabaseAdapter = new JsonFileDatabaseAdapter();
