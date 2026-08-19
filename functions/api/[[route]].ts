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

// 自动初始化 D1 数据表结构与高品质演示种子数据注入
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
      // 6. 每日互动留言表 (表名与 schema.sql 对齐为 comments)
      db.prepare(`
        CREATE TABLE IF NOT EXISTS comments (
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
      // 7. 好友私信消息表 (表名与 schema.sql 对齐为 messages)
      db.prepare(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          sender_id TEXT NOT NULL,
          receiver_id TEXT NOT NULL,
          type TEXT DEFAULT 'text',
          content TEXT NOT NULL,
          audio_duration REAL,
          is_read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `),
      // 8. 微信消息推送配置表 (列与 schema.sql 及 AdminNotificationManager 的表单精准对齐)
      db.prepare(`
        CREATE TABLE IF NOT EXISTS notification_configs (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          enabled INTEGER DEFAULT 1,
          trigger_time TEXT,
          title_template TEXT,
          content_template TEXT,
          quota_cost_note TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `),
    ]);

    // 种子数据：如果用户表为空，自动在 D1 数据库中预填入 user1, user2, user3, admin 这4个默认用户
    const hasUsers = await db.prepare('SELECT id FROM users LIMIT 1').first();
    if (!hasUsers) {
      await db.prepare(`
        INSERT OR IGNORE INTO users (id, username, password, nickname, avatar, role, is_admin)
        VALUES 
        ('u_user1', 'user1', '123456', '打卡先锋', 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1', 'user', 0),
        ('u_user2', 'user2', '123456', '晨跑小鹿', 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2', 'user', 0),
        ('u_user3', 'user3', '123456', '读书伴侣', 'https://api.dicebear.com/7.x/avataaars/svg?seed=user3', 'user', 0),
        ('u_admin', 'admin', '123456', '系统管理员', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', 'admin', 1)
      `).run();
    }

    // 种子数据：如果系统配置表为空，自动在 D1 中预先埋入“每日未打卡提醒”模板，让管理员后台管理消息提醒区域不为空、云同步立刻可见
    const hasConfig = await db.prepare('SELECT id FROM notification_configs WHERE type = ?').bind('daily_uncheck_reminder').first();
    if (!hasConfig) {
      const cfgId = 'cfg_default_reminder';
      const createdAt = new Date().toISOString();
      await db.prepare(`
        INSERT INTO notification_configs (id, type, name, description, enabled, trigger_time, title_template, content_template, quota_cost_note, created_at)
        VALUES (?, 'daily_uncheck_reminder', '每日未打卡提醒', '自动检索并推送每日打卡催促通知', 1, '21:00', '⏰ 每日打卡提醒', '您参与的项目今天还没有打卡哦，快去完成吧！', '微信实机督促通道', ?)
      `).bind(cfgId, createdAt).run();
    }

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
    if (['user1', 'user2', 'user3', 'admin'].includes(username)) {
      const userId = 'u_' + username;
      const isAdmin = username === 'admin' ? 1 : 0;
      const role = username === 'admin' ? 'admin' : 'user';
      const nick = username === 'user1' ? '打卡先锋' : username === 'user2' ? '晨跑小鹿' : username === 'user3' ? '读书伴侣' : '系统管理员';
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
      await db.prepare(`
        INSERT OR IGNORE INTO users (id, username, password, nickname, avatar, role, is_admin)
        VALUES (?, ?, '123456', ?, ?, ?, ?)
      `).bind(userId, username, nick, avatar, role, isAdmin).run();
      
      return {
        id: userId,
        username,
        nickname: nick,
        avatar,
        role,
        isAdmin: isAdmin === 1,
        sendKey: null,
      };
    }
    return null;
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

    // 4. 用户微服务：保存 ServerChan SendKey 到云端 D1
    if (path === '/user/sendkey' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ error: '未登录' }, 401);

      const body = await request.json().catch(() => ({}));
      const { sendKey } = body;

      await db.prepare('UPDATE users SET send_key = ? WHERE id = ?').bind(sendKey, currentUser.id).run();
      return jsonResponse({ success: true, serverchanSendKey: sendKey });
    }

    // 5. 微信推送：实机测试微信消息推送
    if (path === '/push/test' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ error: '未登录' }, 401);

      const body = await request.json().catch(() => ({}));
      const { sendKey } = body;
      const actualKey = sendKey || currentUser.sendKey;

      if (!actualKey) {
        return jsonResponse({ error: '未检测到绑定的 SendKey，请先输入并保存' }, 400);
      }

      const titleMsg = '打卡契约系统测试推送';
      const despMsg = `亲爱的 ${currentUser.nickname}，这是一条来自您打卡系统后台的实机微信推送测试！恭喜您微信绑定配置成功！`;
      const serverChanUrl = `https://sctapi.ftqq.com/${actualKey}.send?title=${encodeURIComponent(titleMsg)}&desp=${encodeURIComponent(despMsg)}`;

      try {
        const pushRes = await fetch(serverChanUrl);
        const pushData: any = await pushRes.json().catch(() => ({}));
        const success = pushRes.ok && (pushData.code === 0 || pushData.data?.error === 'SUCCESS' || pushData.errno === 0);
        if (success) {
          return jsonResponse({ success: true, message: '测试微信推送触发成功，请查看微信！' });
        } else {
          return jsonResponse({ error: `ServerChan 返回错误: ${JSON.stringify(pushData)}` }, 500);
        }
      } catch (err: any) {
        return jsonResponse({ error: `触发实机微信推送失败: ${err.message}` }, 500);
      }
    }

    // 6. 打卡项目列表：查询云端项目
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

      const myProjects = allProjects.filter((p: any) =>
        p.members.includes(currentUser.id) || p.creatorId === currentUser.id
      );

      return jsonResponse(myProjects);
    }

    // 7. 创建打卡项目：支持代创建与跨设备同步
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

    // 8. 日历打卡数据：获取单个项目指定月份的所有打卡数据
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

    // 9. 提交打卡：写入云端记录并在响应中返回 record 数据
    if (path === '/checkins/submit' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ error: '未登录' }, 401);

      const body = await request.json().catch(() => ({}));
      const { projectId, date, photos, videos, audios, text } = body;
      const isQualified = (photos?.length || 0) >= 1 || !!text ? 1 : 0;
      const recordId = 'rec_' + Date.now();
      const createdAt = new Date().toISOString();

      await db.prepare(`
        INSERT INTO checkins (id, project_id, user_id, user_nickname, date, photos, videos, audios, text, is_qualified, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        isQualified,
        createdAt
      ).run();

      return jsonResponse({
        success: true,
        recordId,
        record: {
          id: recordId,
          projectId,
          userId: currentUser.id,
          userNickname: currentUser.nickname,
          userAvatar: currentUser.avatar,
          date,
          photos: photos || [],
          videos: videos || [],
          audios: audios || [],
          text: text || '',
          isQualified: isQualified === 1,
          createdAt
        }
      });
    }

    // 10. 日历打卡日详情：获取指定打卡项目、日期的打卡流水和互动评论 (全新上线，解决 CheckInDrawer 崩溃根源)
    if (path === '/checkins/day-detail' && method === 'GET') {
      const projectId = url.searchParams.get('projectId');
      const date = url.searchParams.get('date');
      if (!projectId || !date) return jsonResponse({ error: '参数不全' }, 400);

      // 查询当日打卡流水，LEFT JOIN 动态解析出用户的实时头像，防崩溃
      const recRows = await db.prepare(`
        SELECT c.*, u.avatar as user_avatar, u.nickname as live_nickname
        FROM checkins c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.project_id = ? AND c.date = ?
      `).bind(projectId, date).all();

      const records = (recRows.results || []).map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
        userId: row.user_id,
        userNickname: row.live_nickname || row.user_nickname,
        userAvatar: row.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.user_id}`,
        date: row.date,
        photos: JSON.parse(row.photos || '[]'),
        videos: JSON.parse(row.videos || '[]'),
        audios: JSON.parse(row.audios || '[]'),
        text: row.text,
        isQualified: row.is_qualified === 1,
        createdAt: row.created_at,
      }));

      // 查询当日专属全员综合评论
      const comRows = await db.prepare(`
        SELECT c.*, u.avatar as user_avatar, u.nickname as live_nickname
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.project_id = ? AND c.date = ?
        ORDER BY c.created_at ASC
      `).bind(projectId, date).all();

      const comments = (comRows.results || []).map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
        date: row.date,
        userId: row.user_id,
        userNickname: row.live_nickname || row.user_nickname,
        userAvatar: row.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.user_id}`,
        content: row.content,
        replyToCommentId: row.reply_to_comment_id,
        replyToNickname: row.reply_to_nickname,
        createdAt: row.created_at,
      }));

      return jsonResponse({ date, records, comments });
    }

    // 11. 搜索真实用户：精准校验 D1 用户真实性
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

    // 12. 好友申请列表：精准获取 pending 状态的申请
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

    // 13. 发送好友申请：如果目标未注册则返回 404
    if (path === '/friends/request' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ error: '未登录' }, 401);

      const body = await request.json().catch(() => ({}));
      const { toUsername } = body;

      const target = await db.prepare('SELECT * FROM users WHERE username = ?').bind(toUsername).first();
      if (!target) {
        return jsonResponse({ error: `用户 @${toUsername} 不存在，请核对账号` }, 404);
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

    // 14. 处理好友申请：同意后在 friends 表写入双向好友关系
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

    // 15. 获取好友列表：获取双向好友
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

    // 16. 每日互动留言列表：获取某项目某日期的留言列表 (与 schema.sql 的 comments 表完全同步)
    if (path === '/comments/list' && method === 'GET') {
      const projectId = url.searchParams.get('projectId');
      const date = url.searchParams.get('date');
      if (!projectId || !date) return jsonResponse([]);

      const rows = await db.prepare(`
        SELECT c.*, u.nickname as live_nickname, u.avatar as user_avatar
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.project_id = ? AND c.date = ?
        ORDER BY c.created_at ASC
      `).bind(projectId, date).all();

      const list = (rows.results || []).map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
        date: row.date,
        userId: row.user_id,
        userNickname: row.live_nickname || row.user_nickname || '用户',
        userAvatar: row.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.user_id}`,
        content: row.content,
        replyToCommentId: row.reply_to_comment_id,
        replyToNickname: row.reply_to_nickname,
        createdAt: row.created_at
      }));

      return jsonResponse(list);
    }

    // 17. 每日互动留言：创建新留言
    if (path === '/comments/create' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ error: '未登录' }, 401);

      const body = await request.json().catch(() => ({}));
      const { projectId, date, content, replyToCommentId, replyToNickname } = body;

      const id = 'cm_' + Date.now();
      const createdAt = new Date().toISOString();

      await db.prepare(`
        INSERT INTO comments (id, project_id, date, user_id, user_nickname, content, reply_to_comment_id, reply_to_nickname, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, projectId, date, currentUser.id, currentUser.nickname, content || '', replyToCommentId || null, replyToNickname || null, createdAt).run();

      return jsonResponse({
        id,
        projectId,
        date,
        userId: currentUser.id,
        userNickname: currentUser.nickname,
        userAvatar: currentUser.avatar,
        content,
        replyToCommentId,
        replyToNickname,
        createdAt
      });
    }

    // 18. 站内私信私聊：获取私聊历史记录 (对齐并从 messages 表拉取，解决私聊 404 错误)
    if (path.startsWith('/messages/') && !path.endsWith('/send') && !path.endsWith('/read') && method === 'GET') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ error: '未登录' }, 401);

      const friendId = path.split('/')[2];
      const rows = await db.prepare(`
        SELECT * FROM messages
        WHERE (sender_id = ? AND receiver_id = ?)
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at ASC
      `).bind(currentUser.id, friendId, friendId, currentUser.id).all();

      const list = (rows.results || []).map((row: any) => ({
        id: row.id,
        senderId: row.sender_id,
        receiverId: row.receiver_id,
        type: row.type,
        content: row.content,
        audioDuration: row.audio_duration,
        isRead: row.is_read === 1,
        createdAt: row.created_at,
      }));

      return jsonResponse(list);
    }

    // 19. 站内私信私聊：发送新私聊消息
    if (path === '/messages/send' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ error: '未登录' }, 401);

      const body = await request.json().catch(() => ({}));
      const { receiverId, type, content, audioDuration } = body;

      const msgId = 'msg_' + Date.now();
      const createdAt = new Date().toISOString();

      await db.prepare(`
        INSERT INTO messages (id, sender_id, receiver_id, type, content, audio_duration, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `).bind(msgId, currentUser.id, receiverId, type || 'text', content || '', audioDuration || null, createdAt).run();

      return jsonResponse({
        id: msgId,
        senderId: currentUser.id,
        receiverId,
        type,
        content,
        audioDuration,
        isRead: false,
        createdAt,
      });
    }

    // 20. 站内私信私聊：标记消息为已读 (已读后红点才会消失)
    if (path === '/messages/read' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ error: '未登录' }, 401);

      const body = await request.json().catch(() => ({}));
      const { friendId } = body;

      await db.prepare(`
        UPDATE messages
        SET is_read = 1
        WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
      `).bind(friendId, currentUser.id).run();

      return jsonResponse({ success: true });
    }

    // 21. 站内私信私聊：实时统计当前用户的未读私聊红点数
    if (path === '/notifications/badge' && method === 'GET') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser) return jsonResponse({ unreadCount: 0 });

      const row = await db.prepare('SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0').bind(currentUser.id).first();
      const unreadCount = row ? row.count : 0;
      return jsonResponse({ unreadCount });
    }

    // 22. 【管理后台云接口】：获取注册总用户、打卡数、关联项目
    if (path === '/admin/users' && method === 'GET') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser || !currentUser.isAdmin) return jsonResponse({ error: '无权操作' }, 403);

      const rows = await db.prepare(`
        SELECT u.id, u.username, u.nickname, u.avatar, u.password, u.created_at, u.role, u.is_admin,
               (SELECT COUNT(*) FROM checkins WHERE user_id = u.id) as checkInCount,
               (SELECT COUNT(*) FROM projects WHERE creator_id = u.id OR members LIKE '%' || u.id || '%') as projectCount
        FROM users u
      `).all();

      const list = (rows.results || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        avatar: u.avatar,
        password: u.password,
        createdAt: u.created_at,
        role: u.role,
        isAdmin: u.is_admin === 1,
        checkInCount: u.checkInCount,
        projectCount: u.projectCount,
      }));

      return jsonResponse(list);
    }

    // 23. 【管理后台云接口】：修改指定用户密码
    if (path.startsWith('/admin/users/') && path.endsWith('/password') && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser || !currentUser.isAdmin) return jsonResponse({ error: '无权操作' }, 403);

      const targetUserId = path.split('/')[3];
      const body = await request.json().catch(() => ({}));
      const { password } = body;

      await db.prepare('UPDATE users SET password = ? WHERE id = ?').bind(password, targetUserId).run();
      return jsonResponse({ success: true });
    }

    // 24. 【管理后台云接口】：进入指定用户的深层多媒体与打卡详情
    if (path.startsWith('/admin/users/') && path.endsWith('/detail') && method === 'GET') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser || !currentUser.isAdmin) return jsonResponse({ error: '无权操作' }, 403);

      const targetUserId = path.split('/')[3];
      const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(targetUserId).first();
      if (!user) return jsonResponse({ error: '目标用户不存在' }, 404);

      const projRows = await db.prepare('SELECT * FROM projects').all();
      const allProjects = (projRows.results || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        creatorId: row.creator_id,
        creatorNickname: row.creator_nickname,
        members: JSON.parse(row.members || '[]'),
        sparks: JSON.parse(row.sparks || '{}'),
        rules: JSON.parse(row.rules || '{}'),
        createdAt: row.created_at,
      }));

      const userProjects = allProjects.filter((p: any) =>
        p.members.includes(targetUserId) || p.creatorId === targetUserId
      );

      const checkinRows = await db.prepare('SELECT * FROM checkins WHERE user_id = ? ORDER BY date DESC').bind(targetUserId).all();
      const userCheckIns = (checkinRows.results || []).map((row: any) => {
        const proj = allProjects.find((p: any) => p.id === row.project_id);
        return {
          id: row.id,
          projectId: row.project_id,
          projectTitle: proj ? proj.title : '已删打卡项目',
          userId: row.user_id,
          userNickname: row.user_nickname,
          date: row.date,
          photos: JSON.parse(row.photos || '[]'),
          videos: JSON.parse(row.videos || '[]'),
          audios: JSON.parse(row.audios || '[]'),
          text: row.text,
          isQualified: row.is_qualified === 1,
          createdAt: row.created_at,
        };
      });

      return jsonResponse({
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
          password: user.password,
          createdAt: user.created_at,
        },
        projects: userProjects,
        allProjects,
        checkIns: userCheckIns,
      });
    }

    // 25. 【管理后台云接口】：管理员新增/补录打卡记录
    if (path === '/admin/checkins' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser || !currentUser.isAdmin) return jsonResponse({ error: '无权操作' }, 403);

      const body = await request.json().catch(() => ({}));
      const { projectId, userId, date, photos, videos, audios, text, isQualified } = body;

      const targetUser = await db.prepare('SELECT nickname FROM users WHERE id = ?').bind(userId).first();
      if (!targetUser) return jsonResponse({ error: '目标用户不存在' }, 404);

      const recordId = 'rec_admin_' + Date.now();
      const isQual = isQualified !== false ? 1 : 0;

      await db.prepare(`
        INSERT INTO checkins (id, project_id, user_id, user_nickname, date, photos, videos, audios, text, is_qualified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        recordId,
        projectId,
        userId,
        targetUser.nickname,
        date,
        JSON.stringify(photos || []),
        JSON.stringify(videos || []),
        JSON.stringify(audios || []),
        text || '',
        isQual
      ).run();

      return jsonResponse({ success: true, record: { id: recordId } });
    }

    // 26. 【管理后台云接口】：管理员修改指定打卡记录
    if (path.startsWith('/admin/checkins/') && method === 'PUT') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser || !currentUser.isAdmin) return jsonResponse({ error: '无权操作' }, 403);

      const checkInId = path.split('/')[3];
      const body = await request.json().catch(() => ({}));
      const { photos, videos, audios, text, isQualified, date } = body;
      const isQual = isQualified !== false ? 1 : 0;

      await db.prepare(`
        UPDATE checkins
        SET photos = ?, videos = ?, audios = ?, text = ?, is_qualified = ?, date = COALESCE(?, date)
        WHERE id = ?
      `).bind(
        JSON.stringify(photos || []),
        JSON.stringify(videos || []),
        JSON.stringify(audios || []),
        text || '',
        isQual,
        date || null,
        checkInId
      ).run();

      return jsonResponse({ success: true });
    }

    // 27. 【管理后台云接口】：管理员删除指定打卡记录
    if (path.startsWith('/admin/checkins/') && method === 'DELETE') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser || !currentUser.isAdmin) return jsonResponse({ error: '无权操作' }, 403);

      const checkInId = path.split('/')[3];
      await db.prepare('DELETE FROM checkins WHERE id = ?').bind(checkInId).run();
      return jsonResponse({ success: true });
    }

    // 28. 【管理后台云接口】：管理员删除指定打卡项目
    if (path.startsWith('/admin/projects/') && method === 'DELETE') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser || !currentUser.isAdmin) return jsonResponse({ error: '无权操作' }, 403);

      const projectId = path.split('/')[3];
      await db.batch([
        db.prepare('DELETE FROM projects WHERE id = ?').bind(projectId),
        db.prepare('DELETE FROM checkins WHERE project_id = ?').bind(projectId)
      ]);

      return jsonResponse({ success: true });
    }

    // 29. 【管理后台云接口】：获取云端配置的提醒通知配置 (精确匹配前端 NotificationConfig 字段)
    if (path === '/admin/notifications/configs' && method === 'GET') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser || !currentUser.isAdmin) return jsonResponse({ error: '无权操作' }, 403);

      const rows = await db.prepare('SELECT * FROM notification_configs ORDER BY created_at DESC').all();
      const list = (rows.results || []).map((row: any) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        description: row.description || '',
        enabled: row.enabled === 1,
        triggerTime: row.trigger_time || '21:00',
        titleTemplate: row.title_template || '',
        contentTemplate: row.content_template || '',
        quotaCostNote: row.quota_cost_note || '',
        createdAt: row.created_at
      }));

      return jsonResponse(list);
    }

    // 30. 【管理后台云接口】：创建新提醒通知配置 (精准对齐 AdminNotificationManager 字段)
    if (path === '/admin/notifications/configs' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser || !currentUser.isAdmin) return jsonResponse({ error: '无权操作' }, 403);

      const body = await request.json().catch(() => ({}));
      const { type, name, description, enabled, triggerTime, titleTemplate, contentTemplate, quotaCostNote } = body;
      const id = 'cfg_' + Date.now();
      const createdAt = new Date().toISOString();

      await db.prepare(`
        INSERT INTO notification_configs (id, type, name, description, enabled, trigger_time, title_template, content_template, quota_cost_note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        type || 'custom',
        name || '',
        description || '',
        enabled !== false ? 1 : 0,
        triggerTime || '21:00',
        titleTemplate || '',
        contentTemplate || '',
        quotaCostNote || '',
        createdAt
      ).run();

      return jsonResponse({
        success: true,
        config: {
          id,
          type,
          name,
          description,
          enabled: enabled !== false,
          triggerTime,
          titleTemplate,
          contentTemplate,
          quotaCostNote,
          createdAt
        }
      });
    }

    // 31. 【管理后台云接口】：编辑更新指定提醒通知配置
    if (path.startsWith('/admin/notifications/configs/') && !path.endsWith('/toggle') && method === 'PUT') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser || !currentUser.isAdmin) return jsonResponse({ error: '无权操作' }, 403);

      const cfgId = path.split('/')[4];
      const body = await request.json().catch(() => ({}));
      const { type, name, description, enabled, triggerTime, titleTemplate, contentTemplate, quotaCostNote } = body;

      await db.prepare(`
        UPDATE notification_configs
        SET type = ?, name = ?, description = ?, enabled = ?, trigger_time = ?, title_template = ?, content_template = ?, quota_cost_note = ?
        WHERE id = ?
      `).bind(
        type,
        name,
        description || '',
        enabled !== false ? 1 : 0,
        triggerTime || '21:00',
        titleTemplate || '',
        contentTemplate || '',
        quotaCostNote || '',
        cfgId
      ).run();

      return jsonResponse({
        success: true,
        config: {
          id: cfgId,
          type,
          name,
          description,
          enabled: enabled !== false,
          triggerTime,
          titleTemplate,
          contentTemplate,
          quotaCostNote
        }
      });
    }

    // 32. 【管理后台云接口】：一键开关指定通知提醒配置
    if (path.startsWith('/admin/notifications/configs/') && path.endsWith('/toggle') && method === 'PATCH') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser || !currentUser.isAdmin) return jsonResponse({ error: '无权操作' }, 403);

      const cfgId = path.split('/')[4];
      const body = await request.json().catch(() => ({}));
      const { enabled } = body;

      await db.prepare(`
        UPDATE notification_configs
        SET enabled = ?
        WHERE id = ?
      `).bind(enabled !== false ? 1 : 0, cfgId).run();

      return jsonResponse({ success: true });
    }

    // 33. 【管理后台云接口】：删除指定通知提醒配置
    if (path.startsWith('/admin/notifications/configs/') && method === 'DELETE') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser || !currentUser.isAdmin) return jsonResponse({ error: '无权操作' }, 403);

      const cfgId = path.split('/')[4];
      await db.prepare('DELETE FROM notification_configs WHERE id = ?').bind(cfgId).run();
      return jsonResponse({ success: true });
    }

    // 34. 【微信督促引擎】：一键微信督促推送，遍历当天未打卡项目成员批量精准推送 (实现纯手写提醒内容的“所见即所得”原文本推送)
    if (path === '/admin/notifications/trigger-reminder' && method === 'POST') {
      const currentUser = await getCurrentUser(request, db);
      if (!currentUser || !currentUser.isAdmin) return jsonResponse({ error: '无权操作' }, 403);

      const usersWithKeys = await db.prepare('SELECT id, nickname, send_key FROM users WHERE send_key IS NOT NULL AND send_key != ""').all();
      const usersMap = new Map((usersWithKeys.results || []).map((u: any) => [u.id, u]));

      const projRows = await db.prepare('SELECT * FROM projects').all();
      const projects = (projRows.results || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        members: JSON.parse(row.members || '[]'),
        rules: JSON.parse(row.rules || '{}'),
      })).filter(p => p.rules.reminderEnabled);

      const tzOffset = 8 * 60 * 60 * 1000;
      const bjTime = new Date(Date.now() + tzOffset);
      const todayStr = bjTime.toISOString().slice(0, 10);

      const checkinRows = await db.prepare('SELECT project_id, user_id FROM checkins WHERE date = ? AND is_qualified = 1').bind(todayStr).all();
      const checkinSet = new Set((checkinRows.results || []).map((r: any) => `${r.project_id}_${r.user_id}`));

      let sentCount = 0;
      let skippedNoKeyCount = 0;
      const details: any[] = [];

      for (const proj of projects) {
        for (const memberId of proj.members) {
          if (checkinSet.has(`${proj.id}_${memberId}`)) {
            continue;
          }
          const userObj = usersMap.get(memberId);
          if (!userObj || !userObj.send_key) {
            skippedNoKeyCount++;
            continue;
          }

          const sendKey = userObj.send_key;
          
          // 纯文字“所见即所得”设计：直接调用项目创建者在前端手打的自定义督促文案，坚决不作任何占位符转义
          const customMsg = proj.rules?.reminderMessage;
          const despMsg = customMsg && customMsg.trim() ? customMsg.trim() : `亲爱的 ${userObj.nickname}，您今天尚未在项目【${proj.title}】中打卡，请点击打卡网页及时完成您今天的记录哦！`;

          const titleMsg = `微信每日打卡督促：${proj.title}`;
          const serverChanUrl = `https://sctapi.ftqq.com/${sendKey}.send?title=${encodeURIComponent(titleMsg)}&desp=${encodeURIComponent(despMsg)}`;

          try {
            const pushRes = await fetch(serverChanUrl);
            const pushData: any = await pushRes.json().catch(() => ({}));
            const success = pushRes.ok && (pushData.code === 0 || pushData.data?.error === 'SUCCESS' || pushData.errno === 0);
            if (success) sentCount++;
            details.push({ nickname: userObj.nickname, projectTitle: proj.title, success });
          } catch (err) {
            details.push({ nickname: userObj.nickname, projectTitle: proj.title, success: false });
          }
        }
      }

      return jsonResponse({ success: true, sentCount, skippedNoKeyCount, details });
    }

    // 兜底 404
    return jsonResponse({ error: `API route not found: ${method} ${path}` }, 404);
  } catch (err: any) {
    return jsonResponse({ error: err.message || 'Server error' }, 500);
  }
};
