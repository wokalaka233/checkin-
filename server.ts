import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/storage.ts';
import { NotificationService } from './server/push.ts';

async function startServer() {
  await db.init();
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Helper middleware for mock/token auth
  const getUserId = (req: express.Request): string | null => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    return (req.headers['x-user-id'] as string) || null;
  };

  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: '未登录' });
    }
    (req as any).userId = userId;
    next();
  };

  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = getUserId(req);
    if (userId !== 'admin') {
      return res.status(403).json({ error: '无权限访问管理员接口' });
    }
    (req as any).userId = 'admin';
    next();
  };

  // Hardcoded Admin User Definition (not saved in database)
  const ADMIN_USER = {
    id: 'admin',
    username: 'admin',
    nickname: '超级管理者',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    createdAt: '2026-01-01T00:00:00.000Z',
    isAdmin: true,
    role: 'admin',
  };

  // --- Auth Routes ---
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password, nickname } = req.body;
      if (!username || !password || !nickname) {
        return res.status(400).json({ error: '请完整填写账号、密码和昵称' });
      }
      if (username.trim().toLowerCase() === 'admin') {
        return res.status(400).json({ error: '该账号不可注册' });
      }
      const existing = await db.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ error: '该账号已存在' });
      }

      // Generate a default pleasant avatar
      const defaultAvatars = [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
      ];
      const avatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];

      const user = await db.createUser({
        username,
        passwordHash: password,
        nickname,
        avatar,
      });

      res.json({
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
          createdAt: user.createdAt,
        },
        token: user.id,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || '注册失败' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: '请输入账号和密码' });
      }

      // Hardcoded Admin authentication check (not in database)
      if (username.trim() === 'admin' && password === '12345') {
        return res.json({
          user: ADMIN_USER,
          token: 'admin',
        });
      }

      const user = await db.getUserByUsername(username);
      if (!user || user.passwordHash !== password) {
        return res.status(400).json({ error: '账号或密码错误' });
      }
      res.json({
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
          createdAt: user.createdAt,
        },
        token: user.id,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || '登录失败' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      if (userId === 'admin') {
        return res.json(ADMIN_USER);
      }
      const user = await db.getUserById(userId);
      if (!user) {
        return res.status(401).json({ error: '用户不存在或已失效' });
      }
      res.json({
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        serverchanSendKey: user.serverchanSendKey || '',
        createdAt: user.createdAt,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- WeChat Notification & SendKey Routes ---
  app.post('/api/user/sendkey', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { sendKey } = req.body;
      const updatedUser = await db.updateUserSendKey(userId, sendKey || '');
      res.json({
        success: true,
        serverchanSendKey: updatedUser.serverchanSendKey || '',
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/push/test', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { sendKey } = req.body;
      const user = await db.getUserById(userId);
      const targetKey = (sendKey && sendKey.trim()) || user?.serverchanSendKey;

      if (!targetKey) {
        return res.status(400).json({ error: '请先填写或绑定 Server酱 SendKey' });
      }

      const success = await NotificationService.sendServerChan(targetKey, {
        title: '🔔 微信打卡应用推送测试成功！',
        desp: `### 恭喜！微信通道配置正常\n- **账号**：${user?.nickname || '测试成员'}\n- **状态**：微信提醒服务已成功激活\n- **时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n日后未完成打卡或收到私信时，将自动通过本通道提醒您！`,
      });

      if (success) {
        res.json({ success: true, message: '测试消息已成功送达微信服务号！' });
      } else {
        res.status(400).json({ error: '微信推送失败，请检查 SendKey 是否填写正确。' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Friends Routes ---
  app.get('/api/friends/list', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const friends = await db.getFriends(userId);
      
      // Calculate unread counts for each friend
      const results = [];
      for (const f of friends) {
        const msgs = await db.getMessages(f.id, userId);
        const unreadCount = msgs.filter(m => m.senderId === f.id && !m.isRead).length;
        const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
        results.push({
          id: f.id,
          username: f.username,
          nickname: f.nickname,
          avatar: f.avatar,
          createdAt: f.createdAt,
          unreadCount,
          lastMessage,
        });
      }
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/friends/requests', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const requests = await db.getFriendRequests(userId);
      res.json(requests);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/friends/request', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { toUsername } = req.body;
      if (!toUsername) {
        return res.status(400).json({ error: '请输入目标账号' });
      }
      const reqRecord = await db.sendFriendRequest(userId, toUsername);
      res.json(reqRecord);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/friends/respond', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { requestId, action } = req.body;
      if (!requestId || !action) {
        return res.status(400).json({ error: '参数不完整' });
      }
      const success = await db.respondFriendRequest(requestId, userId, action);
      res.json({ success });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/friends/search', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const q = (req.query.q as string) || '';
      const users = await db.searchUsers(q, userId);
      res.json(users.map(u => ({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        avatar: u.avatar,
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Projects Routes ---
  app.get('/api/projects/list', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const projects = await db.getProjectsForUser(userId);
      
      const enriched = await Promise.all(
        projects.map(async p => {
          const creator = await db.getUserById(p.creatorId);
          const memberUsers = await Promise.all(
            p.members.map(async mid => {
              const u = await db.getUserById(mid);
              return u ? { id: u.id, username: u.username, nickname: u.nickname, avatar: u.avatar, createdAt: u.createdAt } : null;
            })
          );

          const isRekindling = !!(p.removedMembers && p.removedMembers[userId]);
          const rekindleInfo = isRekindling ? p.removedMembers[userId] : undefined;

          return {
            ...p,
            creatorNickname: creator?.nickname || '未知',
            memberUsers: memberUsers.filter(Boolean),
            currentUserSpark: p.sparks[userId] || 0,
            rekindleStatus: isRekindling
              ? {
                  isRekindling: true,
                  progress: rekindleInfo?.rekindleStreak || 0,
                  lockedSparks: rekindleInfo?.lockedSparks || 0,
                }
              : undefined,
          };
        })
      );

      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/projects/create', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { title, isProxy, selectedFriendIds, creatorParticipates, rules } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({ error: '请输入打卡项目名称' });
      }

      let members: string[] = [];
      if (isProxy) {
        if (!selectedFriendIds || selectedFriendIds.length === 0) {
          return res.status(400).json({ error: '代创建必须选择至少一位好友' });
        }
        members = [...selectedFriendIds];
        if (creatorParticipates && !members.includes(userId)) {
          members.unshift(userId);
        }
      } else {
        // My own habit project
        members = [userId];
      }

      const defaultRules = {
        requirePhotos: false,
        minPhotos: 1,
        requireVideo: false,
        requireAudio: false,
        requireText: false,
        ...rules,
      };

      const project = await db.createProject({
        title: title.trim(),
        creatorId: userId,
        members,
        rules: defaultRules,
      });

      res.json(project);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/projects/:id/rule', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { rules } = req.body;
      const updated = await db.updateProjectRules(req.params.id, userId, rules);
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/projects/:id/remove-member', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { memberId } = req.body;
      const updated = await db.removeMemberFromProject(req.params.id, userId, memberId);
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/projects/:id/add-member', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { memberId } = req.body;
      const updated = await db.addMemberToProject(req.params.id, userId, memberId);
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Calendar & Check-in Routes ---
  app.get('/api/checkins/calendar', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const projectId = req.query.projectId as string;
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7); // 'YYYY-MM'

      if (!projectId) {
        return res.status(400).json({ error: '缺少 projectId' });
      }

      const project = await db.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      const records = await db.getCheckInsForProject(projectId, month);
      
      // Group by date
      const daysMap: Record<string, {
        date: string;
        records: any[];
      }> = {};

      for (const r of records) {
        if (!daysMap[r.date]) {
          daysMap[r.date] = { date: r.date, records: [] };
        }
        const user = await db.getUserById(r.userId);
        daysMap[r.date].records.push({
          ...r,
          userNickname: user?.nickname || '成员',
          userAvatar: user?.avatar || '',
        });
      }

      const activeMembersCount = project.members.length;

      // Construct summaries
      const summaries: Record<string, any> = {};
      for (const [date, info] of Object.entries(daysMap)) {
        const qualifiedCount = info.records.filter(r => r.isQualified).length;
        const totalSubmissions = info.records.length;
        const myRecord = info.records.find(r => r.userId === userId);

        let status: 'red' | 'yellow' | 'gray' = 'gray';
        if (qualifiedCount === activeMembersCount && activeMembersCount > 0) {
          status = 'red'; // 全员达标
        } else if (totalSubmissions > 0) {
          status = 'yellow'; // 部分打卡但未达标
        } else {
          status = 'gray'; // 缺勤
        }

        summaries[date] = {
          date,
          status,
          records: info.records,
          allQualified: qualifiedCount === activeMembersCount && activeMembersCount > 0,
          hasAnySubmission: totalSubmissions > 0,
          hasMySubmission: !!myRecord,
          isMyQualified: !!myRecord?.isQualified,
        };
      }

      res.json({
        month,
        project,
        days: summaries,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/checkins/submit', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { projectId, date, photos, videos, audios, text } = req.body;
      if (!projectId || !date) {
        return res.status(400).json({ error: '缺少打卡项目或日期' });
      }

      const result = await db.submitCheckIn({
        projectId,
        userId,
        date,
        photos: photos || [],
        videos: videos || [],
        audios: audios || [],
        text: text || '',
      });

      const user = await db.getUserById(userId);
      res.json({
        record: {
          ...result.record,
          userNickname: user?.nickname || '我',
          userAvatar: user?.avatar || '',
        },
        sparkUpdate: result.sparkUpdate,
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/checkins/day-detail', requireAuth, async (req, res) => {
    try {
      const { projectId, date } = req.query as { projectId: string; date: string };
      if (!projectId || !date) {
        return res.status(400).json({ error: '参数不完整' });
      }

      const allRecords = await db.getCheckInsForProject(projectId);
      const dayRecords = allRecords.filter(r => r.date === date);

      const enrichedRecords = await Promise.all(
        dayRecords.map(async r => {
          const user = await db.getUserById(r.userId);
          return {
            ...r,
            userNickname: user?.nickname || '未知用户',
            userAvatar: user?.avatar || '',
          };
        })
      );

      const comments = await db.getCommentsForDate(projectId, date);

      res.json({
        date,
        records: enrichedRecords,
        comments,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Comments Routes ---
  app.get('/api/comments/list', requireAuth, async (req, res) => {
    try {
      const { projectId, date } = req.query as { projectId: string; date: string };
      if (!projectId || !date) {
        return res.status(400).json({ error: '参数不完整' });
      }
      const comments = await db.getCommentsForDate(projectId, date);
      res.json(comments);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/comments/create', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { projectId, date, content, replyToCommentId, replyToNickname } = req.body;
      if (!projectId || !date || !content || !content.trim()) {
        return res.status(400).json({ error: '评论内容不能为空' });
      }

      const comment = await db.addComment({
        projectId,
        date,
        userId,
        content,
        replyToCommentId,
        replyToNickname,
      });

      res.json(comment);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Chat Messages Routes ---
  app.get('/api/messages/:friendId', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const friendId = req.params.friendId;
      const messages = await db.getMessages(userId, friendId);
      
      // Auto mark read for messages sent to current user
      await db.markMessagesRead(friendId, userId);

      res.json(messages);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/messages/send', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { receiverId, type, content, audioDuration } = req.body;
      if (!receiverId || !type || !content) {
        return res.status(400).json({ error: '消息格式不完整' });
      }

      const msg = await db.sendMessage({
        senderId: userId,
        receiverId,
        type,
        content,
        audioDuration,
      });

      res.json(msg);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/messages/read', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { friendId } = req.body;
      if (friendId) {
        await db.markMessagesRead(friendId, userId);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/notifications/badge', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const unreadCount = await db.getUnreadCount(userId);
      res.json({ unreadCount });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Admin Master Management Routes (Highest Authority) ---
  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const allUsers = await db.getAllUsers();
      const allProjects = await db.getAllProjects();
      
      const userSummaries = await Promise.all(
        allUsers.map(async (u) => {
          const userProjects = allProjects.filter((p) => p.members.includes(u.id));
          const userCheckIns = await db.getAllCheckInsForUser(u.id);
          const latestCheckIn = userCheckIns[0];

          return {
            id: u.id,
            username: u.username,
            nickname: u.nickname,
            avatar: u.avatar,
            createdAt: u.createdAt,
            password: u.passwordHash,
            projectCount: userProjects.length,
            checkInCount: userCheckIns.length,
            lastCheckInDate: latestCheckIn ? latestCheckIn.date : null,
          };
        })
      );

      res.json(userSummaries);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/users/:userId/password', requireAdmin, async (req, res) => {
    try {
      const targetUserId = req.params.userId;
      const { password } = req.body;
      if (!password || !password.trim()) {
        return res.status(400).json({ error: '新密码不能为空' });
      }

      const updated = await db.updateUserPassword(targetUserId, password.trim());
      if (!updated) {
        return res.status(404).json({ error: '用户不存在' });
      }

      res.json({
        success: true,
        user: {
          id: updated.id,
          username: updated.username,
          nickname: updated.nickname,
          password: updated.passwordHash,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/users/:userId/detail', requireAdmin, async (req, res) => {
    try {
      const targetUserId = req.params.userId;
      const targetUser = await db.getUserById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: '用户未找到' });
      }

      const allProjects = await db.getAllProjects();
      const userProjects = allProjects.filter((p) => p.members.includes(targetUserId));
      const userCheckIns = await db.getAllCheckInsForUser(targetUserId);

      const checkInsWithTitle = userCheckIns.map((chk) => {
        const proj = allProjects.find((p) => p.id === chk.projectId);
        return {
          ...chk,
          projectTitle: proj ? proj.title : '未知项目',
        };
      });

      res.json({
        user: {
          id: targetUser.id,
          username: targetUser.username,
          nickname: targetUser.nickname,
          avatar: targetUser.avatar,
          createdAt: targetUser.createdAt,
          password: targetUser.passwordHash,
        },
        projects: userProjects,
        allProjects,
        checkIns: checkInsWithTitle,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin Check-in CRUD
  app.post('/api/admin/checkins', requireAdmin, async (req, res) => {
    try {
      const { projectId, userId, date, photos, videos, audios, text, isQualified } = req.body;
      if (!projectId || !userId || !date) {
        return res.status(400).json({ error: '缺少项目ID、用户ID或打卡日期' });
      }

      const record = await db.createCheckInAdmin({
        projectId,
        userId,
        date,
        photos: photos || [],
        videos: videos || [],
        audios: audios || [],
        text: text || '',
        isQualified: isQualified !== undefined ? isQualified : true,
      });

      res.json({ success: true, record });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/admin/checkins/:checkInId', requireAdmin, async (req, res) => {
    try {
      const checkInId = req.params.checkInId;
      const { photos, videos, audios, text, isQualified, date } = req.body;

      const updated = await db.updateCheckIn(checkInId, {
        photos,
        videos,
        audios,
        text,
        isQualified,
        date,
      });

      if (!updated) {
        return res.status(404).json({ error: '打卡记录未找到' });
      }

      res.json({ success: true, record: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/admin/checkins/:checkInId', requireAdmin, async (req, res) => {
    try {
      const checkInId = req.params.checkInId;
      const ok = await db.deleteCheckIn(checkInId);
      if (!ok) {
        return res.status(404).json({ error: '打卡记录不存在或已被删除' });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/admin/projects/:projectId', requireAdmin, async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const ok = await db.deleteProject(projectId);
      if (!ok) {
        return res.status(404).json({ error: '项目未找到' });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Admin Notification Configs Management ---
  app.get('/api/admin/notifications/configs', requireAdmin, async (req, res) => {
    try {
      const configs = await db.getNotificationConfigs();
      res.json(configs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/notifications/configs', requireAdmin, async (req, res) => {
    try {
      const { type, name, description, enabled, triggerTime, titleTemplate, contentTemplate, quotaCostNote } = req.body;
      if (!name || !titleTemplate || !contentTemplate) {
        return res.status(400).json({ error: '请填写完整的通知名称与模版内容' });
      }
      const config = await db.createNotificationConfig({
        type: type || 'custom',
        name,
        description: description || '',
        enabled: enabled !== undefined ? Boolean(enabled) : false,
        triggerTime: triggerTime || '21:00',
        titleTemplate,
        contentTemplate,
        quotaCostNote: quotaCostNote || '按触发人数扣除额度',
      });
      res.json({ success: true, config });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/admin/notifications/configs/:id', requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const updated = await db.updateNotificationConfig(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: '未找到该通知配置' });
      }
      res.json({ success: true, config: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/admin/notifications/configs/:id/toggle', requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const { enabled } = req.body;
      const updated = await db.toggleNotificationConfig(id, Boolean(enabled));
      if (!updated) {
        return res.status(404).json({ error: '未找到该通知配置' });
      }
      res.json({ success: true, config: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/admin/notifications/configs/:id', requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const ok = await db.deleteNotificationConfig(id);
      if (!ok) {
        return res.status(404).json({ error: '未找到该通知配置或已被删除' });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin Batch Trigger: Send Daily Uncompleted Checkin Reminder
  app.post('/api/admin/notifications/trigger-reminder', requireAdmin, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const allProjects = await db.getAllProjects();
      const allUsers = await db.getAllUsers();
      const configs = await db.getNotificationConfigs();
      const uncheckConfig = configs.find(c => c.type === 'daily_uncheck_reminder');

      if (uncheckConfig && !uncheckConfig.enabled) {
        return res.status(400).json({ error: '该通知当前处于【已关闭】状态，请先在配置中开启后再执行！' });
      }

      // Collect members who haven't checked in today across all projects
      let sentCount = 0;
      let skippedNoKeyCount = 0;
      const pushResults: { nickname: string; projectTitle: string; success: boolean }[] = [];

      for (const project of allProjects) {
        const checkIns = await db.getCheckInsForProject(project.id, today.slice(0, 7));
        const todayCheckInUserIds = new Set(
          checkIns.filter(c => c.date === today && c.isQualified).map(c => c.userId)
        );

        for (const memberId of project.members) {
          if (!todayCheckInUserIds.has(memberId)) {
            const member = allUsers.find(u => u.id === memberId);
            if (!member) continue;

            if (!member.serverchanSendKey || member.serverchanSendKey.trim() === '') {
              skippedNoKeyCount++;
              continue;
            }

            const title = (uncheckConfig?.titleTemplate || '⏰ 每日打卡提醒')
              .replace('{nickname}', member.nickname)
              .replace('{projectTitle}', project.title);

            const desp = (uncheckConfig?.contentTemplate || '尊敬的 {nickname}，您参与的项目【{projectTitle}】今天还没有打卡哦，快去完成吧！')
              .replace('{nickname}', member.nickname)
              .replace('{projectTitle}', project.title);

            const ok = await NotificationService.sendServerChan(member.serverchanSendKey, {
              title,
              desp: `### ${title}\n\n${desp}\n\n- **日期**：${today}\n- **状态**：尚未打卡\n- **耗费额度**：1条\n\n[点击前往打卡小程序](https://ais-pre-n27a7kyjmmki3rgrbllhiu-365092299483.asia-east1.run.app)`,
            });

            if (ok) sentCount++;
            pushResults.push({
              nickname: member.nickname,
              projectTitle: project.title,
              success: ok,
            });
          }
        }
      }

      res.json({
        success: true,
        sentCount,
        skippedNoKeyCount,
        details: pushResults,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Vite Dev & Production Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
