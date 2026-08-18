/**
 * Cloudflare Pages Functions - /api/* 全栈后端处理器
 * 连接 Cloudflare D1 数据库，实现全网多设备跨端数据实时同步
 */

interface Env {
  DB: any; // Cloudflare D1 数据库绑定变量
}

// 跨域与 JSON 响应辅助函数
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// 自动初始化 D1 数据表结构
async function ensureTables(db: any) {
  if (!db) return;
  try {
    await db.batch([
      // 1. 用户表
      db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          nickname TEXT NOT NULL,
          avatar TEXT,
          role TEXT DEFAULT 'user',
          is_admin INTEGER DEFAULT 0,
          send_key TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `),
      // 2. 打卡项目表
      db.prepare(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          creator_id TEXT NOT NULL,
          creator_nickname TEXT NOT NULL,
          members TEXT NOT NULL, -- JSON 数组
          sparks TEXT NOT NULL,  -- JSON 键值对
          rules TEXT NOT NULL,   -- JSON 规则
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `),
      // 3. 打卡记录表
      db.prepare(`
        CREATE TABLE IF NOT EXISTS checkins (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_nickname TEXT NOT NULL,
          date TEXT NOT NULL,
          photos TEXT, -- JSON 数组
          videos TEXT, -- JSON 数组
          audios TEXT, -- JSON 数组
          text TEXT,
          is_qualified INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `),
      // 4. 好友关系表
      db.prepare(`
        CREATE TABLE IF NOT EXISTS friends (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          friend_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `),
      // 5. 好友申请表
      db.prepare(`
        CREATE TABLE IF NOT EXISTS friend_requests (
          id TEXT PRIMARY KEY,
          from_user_id TEXT NOT NULL,
          to_user_id TEXT NOT NULL,
          status TEXT DEFAULT 'pending', -- pending, accepted, rejected
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `),
      // 6. 每日互动留言表
      db.prepare(`
        CREATE TABLE IF NOT EXISTS daily_comments (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          date TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_nickname TEXT NOT NULL,
          content TEXT NOT NULL,
          reply_to_comment_id TEXT,
          reply_to_nickname TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `),
      // 7. 私聊消息表
      db.prepare(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          sender_id TEXT NOT NULL,
          receiver_id TEXT NOT NULL,
          type TEXT DEFAULT 'text',
          content TEXT NOT NULL,
          audio_duration INTEGER,
          is_read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `),
    ]);
  } catch (err) {
    console.error('D1 ensureTables error:', err);
  }
}

// 获取当前登录用户
async function getCurrentUser(request: Request, db: any) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '').trim();
  const username = token.replace('token_', '');
  
  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  if (!user) {
    return {
      id: 'u_' + username,
      username,
      nickname: username === 'user1' ? '打卡先锋' : username === 'user2' ? '晨跑小鹿' : username === 'user3' ? '读书伴侣' : username === 'admin' ? '系统管理员' : username,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      role: username === 'admin' ? 'admin' : 'user',
      isAdmin: username === 'admin',
    };
  }
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname || user.username,
    avatar: user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`,
    role: user.role || 'user',
    isAdmin: user.is_admin === 1 || user.role === 'admin' || user.username === 'admin',
    sendKey: user.send_key,
  };
}

export const onRequest: any = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');
  const method = request.method.toUpperCase();

  // OPTIONS 预检请求处理
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const db = env.DB;
  if (!db) {
    return jsonResponse({ error: 'Cloudflare D1 数据库未绑定，请在 Cloudflare Pages 设置中绑定变量 DB' }, 500);
  }

  // 确保数据表已创建
  await ensureTables(db);

  try {
    // 1. 认证接口: 注册
    if (path === '/auth/register' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { username, password, nickname } = body;
      if (!username || !password) {
        return jsonResponse({ error: '用户名和密码不能为空' }, 400);
      }
      const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
      if (existing) {
        return jsonResponse({ error: '该用户名已被注册' }, 400);
      }
      const userId = 'u_' + username;
      const isAdmin = username === 'admin' ? 1 : 0;
      const role = username === 'admin' ? 'admin' : 'user';
      const userNick = nickname || username;
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

      await db.prepare(`
        INSERT INTO users (id, username, password, nickname, avatar, role, is_admin)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(userId, username, password, userNick, avatar, role, isAdmin).run();

      const token = 'token_' + username;
      return jsonResponse({
        user: { id: userId, username, nickname: userNick, avatar, role, isAdmin: isAdmin === 1 },
        token,
      });
    }

    // 2. 认证接口: 登录
    if (path === '/auth/login' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { username, password } = body;
      let user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
      
      // 如果是内置用户首次登录，自动创建
      if (!user && ['user1', 'user2', 'user3', 'admin'].includes(username)) {
        const userId = 'u_' + username;
        const isAdmin = username === 'admin' ? 1 : 0;
        const role = username === 'admin' ? 'admin' : 'user';
        const nick = username === 'user1' ? '打卡先锋' : username === 'user2' ? '晨跑小鹿' : username === 'user3' ? '读书伴侣' : '系统管理员';
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
        await db.prepare(`
          INSERT INTO users (id, username, password, nickname, avatar, role, is_admin)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(userId, username, password, nick, avatar, role, isAdmin).run();
        user = { id: userId, username, password, nickname: nick, avatar, role, is_admin: isAdmin };
      }

      if (!user || user.password !== password) {
        return jsonResponse({ error: '用户名或密码错误' }, 401);
      }

      const token = 'token_' + username;
      return jsonResponse({
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname || user.username,
          avatar: user.avatar,
          role: user.role || 'user',
          isAdmin: user.is_admin === 1 || user.username === 'admin',
        },
        token,
      });
    }

    // 3. 认证接口: 当前登录用户信息
    if (path === '/auth/me' && method === 'GET') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ error: '未登录' }, 401);
      return jsonResponse(currentUser);
    }

    // 4. 打卡项目列表
    if (path === '/projects/list' && method === 'GET') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse([]);

      const rows = await db.prepare('SELECT * FROM projects').all();
      const allProjects = (rows.results || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        creatorId: row.creator_id,
        creatorNickname: row.creator_nickname,
        members: JSON.parse(row.members || '[]'),
        sparks: JSON.parse(row.sparks || '{}'),
        rules: JSON.parse(row.rules || '{}'),
        createdAt: row.created_at,
      }));

      // 筛选出当前用户是成员或创建者的项目
      const myProjects = allProjects.filter((p: any) =>
        p.members.includes(currentUser.id) || p.creatorId === currentUser.id
      );

      return jsonResponse(myProjects);
    }

    // 5. 创建打卡项目（支持代创建与跨设备同步）
    if (path === '/projects/create' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ error: '未登录' }, 401);

      const body = await request.json().catch(() => ({}));
      const { title, selectedFriendIds, creatorParticipates, rules } = body;

      const memberIds = [...(selectedFriendIds || [])];
      if (creatorParticipates !== false && !memberIds.includes(currentUser.id)) {
        memberIds.push(currentUser.id);
      }

      const sparks: Record<string, number> = {};
      memberIds.forEach((id: string) => (sparks[id] = 1));

      const newProject = {
        id: 'p_' + Date.now(),
        title: title || '自律打卡',
        creatorId: currentUser.id,
        creatorNickname: currentUser.nickname,
        members: memberIds,
        sparks,
        rules: rules || {},
        createdAt: new Date().toISOString(),
      };

      await db.prepare(`
        INSERT INTO projects (id, title, creator_id, creator_nickname, members, sparks, rules)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        newProject.id,
        newProject.title,
        newProject.creatorId,
        newProject.creatorNickname,
        JSON.stringify(newProject.members),
        JSON.stringify(newProject.sparks),
        JSON.stringify(newProject.rules)
      ).run();

      return jsonResponse(newProject);
    }

    // 6. 日历打卡数据接口
    if (path === '/checkins/calendar' && method === 'GET') {
      const currentUser = await getCurrentUser(request, db);
      const projectId = url.searchParams.get('projectId');
      const month = url.searchParams.get('month');

      if (!projectId || !month) {
        return jsonResponse({ error: '参数不全' }, 400);
      }

      const projRow = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
      const proj = projRow ? {
        id: projRow.id,
        title: projRow.title,
        creatorId: projRow.creator_id,
        creatorNickname: projRow.creator_nickname,
        members: JSON.parse(projRow.members || '[]'),
        sparks: JSON.parse(projRow.sparks || '{}'),
        rules: JSON.parse(projRow.rules || '{}'),
      } : { id: projectId, title: '每日打卡', members: [], sparks: {}, rules: {} };

      // 查询该项目当月所有打卡记录
      const recordsRows = await db.prepare(
        'SELECT * FROM checkins WHERE project_id = ? AND date LIKE ?'
      ).bind(projectId, `${month}%`).all();

      const days: Record<string, any> = {};
      (recordsRows.results || []).forEach((row: any) => {
        const rec = {
          id: row.id,
          projectId: row.project_id,
          userId: row.user_id,
          userNickname: row.user_nickname,
          date: row.date,
          photos: JSON.parse(row.photos || '[]'),
          videos: JSON.parse(row.videos || '[]'),
          audios: JSON.parse(row.audios || '[]'),
          text: row.text,
          isQualified: row.is_qualified === 1,
        };

        if (!days[row.date]) {
          days[row.date] = {
            date: row.date,
            status: rec.isQualified ? 'red' : 'yellow',
            records: [],
            allQualified: true,
            hasAnySubmission: true,
            hasMySubmission: false,
            isMyQualified: false,
          };
        }
        days[row.date].records.push(rec);
        if (!rec.isQualified) days[row.date].allQualified = false;
        if (currentUser && rec.userId === currentUser.id) {
          days[row.date].hasMySubmission = true;
          if (rec.isQualified) days[row.date].isMyQualified = true;
        }
      });

      return jsonResponse({ month, project: proj, days });
    }

    // 7. 提交打卡
    if (path === '/checkins/submit' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ error: '未登录' }, 401);

      const body = await request.json().catch(() => ({}));
      const { projectId, date, photos, videos, audios, text } = body;
      const isQualified = (photos?.length || 0) >= 1 || !!text ? 1 : 0;
      const recordId = 'rec_' + Date.now();

      await db.prepare(`
        INSERT INTO checkins (id, project_id, user_id, user_nickname, date, photos, videos, audios, text, is_qualified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        recordId,
        projectId,
        currentUser.id,
        currentUser.nickname,
        date,
        JSON.stringify(photos || []),
        JSON.stringify(videos || []),
        JSON.stringify(audios || []),
        text || '',
        isQualified
      ).run();

      return jsonResponse({ success: true, recordId });
    }

    // 8. 搜索真实用户（安全性检验：精准查询，绝不返回虚拟用户）
    if (path === '/friends/search' && method === 'GET') {
      const currentUser = await getCurrentUser(request, db);
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      if (!q) return jsonResponse([]);

      const rows = await db.prepare('SELECT id, username, nickname, avatar FROM users').all();
      const matched = (rows.results || []).filter((u: any) =>
        (u.username.toLowerCase().includes(q) || (u.nickname && u.nickname.toLowerCase().includes(q))) &&
        (!currentUser || u.username.toLowerCase() !== currentUser.username.toLowerCase())
      );

      return jsonResponse(matched);
    }

    // 9. 好友申请列表（跨设备精准推送给当前用户）
    if (path === '/friends/requests' && method === 'GET') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse([]);

      const rows = await db.prepare(`
        SELECT r.id, r.from_user_id, r.to_user_id, r.status, r.created_at,
               u.username, u.nickname, u.avatar
        FROM friend_requests r
        JOIN users u ON r.from_user_id = u.id
        WHERE r.to_user_id = ? AND r.status = 'pending'
      `).bind(currentUser.id).all();

      const list = (rows.results || []).map((r: any) => ({
        id: r.id,
        fromUserId: r.from_user_id,
        toUserId: r.to_user_id,
        status: r.status,
        createdAt: r.created_at,
        fromUser: {
          id: r.from_user_id,
          username: r.username,
          nickname: r.nickname,
          avatar: r.avatar,
        },
      }));

      return jsonResponse(list);
    }

    // 10. 发送好友申请
    if (path === '/friends/request' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ error: '未登录' }, 401);

      const body = await request.json().catch(() => ({}));
      const { toUsername } = body;

      const target = await db.prepare('SELECT * FROM users WHERE username = ?').bind(toUsername).first();
      if (!target) {
        return jsonResponse({ error: `用户 @${toUsername} 不存在` }, 404);
      }
      if (target.id === currentUser.id) {
        return jsonResponse({ error: '不能向自己发送好友申请' }, 400);
      }

      const reqId = 'req_' + Date.now();
      await db.prepare(`
        INSERT INTO friend_requests (id, from_user_id, to_user_id, status)
        VALUES (?, ?, ?, 'pending')
      `).bind(reqId, currentUser.id, target.id).run();

      return jsonResponse({ success: true, id: reqId });
    }

    // 11. 处理好友申请（同意/拒绝）
    if (path === '/friends/respond' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ error: '未登录' }, 401);

      const body = await request.json().catch(() => ({}));
      const { requestId, action } = body;

      const req = await db.prepare('SELECT * FROM friend_requests WHERE id = ?').bind(requestId).first();
      if (!req) return jsonResponse({ error: '申请不存在' }, 404);

      await db.prepare('DELETE FROM friend_requests WHERE id = ?').bind(requestId).run();

      if (action === 'accept') {
        const id1 = 'f_' + Date.now() + '_1';
        const id2 = 'f_' + Date.now() + '_2';
        await db.batch([
          db.prepare('INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)').bind(id1, req.from_user_id, req.to_user_id),
          db.prepare('INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)').bind(id2, req.to_user_id, req.from_user_id),
        ]);
      }

      return jsonResponse({ success: true });
    }

    // 12. 获取我的好友列表
    if (path === '/friends/list' && method === 'GET') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse([]);

      const rows = await db.prepare(`
        SELECT u.id, u.username, u.nickname, u.avatar
        FROM friends f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ?
      `).bind(currentUser.id).all();

      return jsonResponse(rows.results || []);
    }

    // 兜底 404
    return jsonResponse({ error: `API route not found: ${method} ${path}` }, 404);
  } catch (err: any) {
    return jsonResponse({ error: err.message || 'Server error' }, 500);
  }
};
