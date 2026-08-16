/**
 * Cloudflare Pages Functions - /api/* 全栈接口处理器
 * 自动拦截 /api/login, /api/register, /api/checkins, /api/leaderboard 等请求
 * 直接操作 Cloudflare D1 数据库
 */

interface Env {
  DB: any; // Cloudflare D1 数据库绑定
}

// 初始化数据库表结构（如果不存在）
async function ensureTables(db: any) {
  if (!db) return;
  try {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        avatar TEXT,
        streak INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS checkins (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_avatar TEXT,
        target_type TEXT NOT NULL,
        comment TEXT,
        photo TEXT,
        audio_url TEXT,
        ai_praise TEXT,
        timestamp INTEGER NOT NULL,
        location TEXT,
        likes TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`)
    ]);
  } catch (e) {
    console.error('Failed to ensure tables', e);
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 确保数据库初始化
  if (env.DB) {
    await ensureTables(env.DB);
  }

  try {
    // 1. 用户登录 /api/login
    if (pathname === '/api/login' && method === 'POST') {
      const { username, password } = await request.json() as any;
      if (!username) {
        return new Response(JSON.stringify({ error: '请提供用户名' }), { status: 400, headers: corsHeaders });
      }

      if (!env.DB) {
        // 无 D1 绑定时的本地安全备用
        return new Response(JSON.stringify({
          user: {
            id: 'u_' + username,
            username,
            name: username,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
            streak: 1
          }
        }), { headers: corsHeaders });
      }

      const users = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).all();
      if (!users.results || users.results.length === 0) {
        // 自动注册
        const id = 'u_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
        await env.DB.prepare(
          'INSERT INTO users (id, username, password, name, avatar, streak) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, username, password || '123456', username, avatar, 1).run();

        return new Response(JSON.stringify({
          user: { id, username, name: username, avatar, streak: 1 }
        }), { headers: corsHeaders });
      }

      const user = users.results[0];
      if (password && user.password && user.password !== password) {
        return new Response(JSON.stringify({ error: '密码错误' }), { status: 400, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ user }), { headers: corsHeaders });
    }

    // 2. 用户注册 /api/register
    if (pathname === '/api/register' && method === 'POST') {
      const { username, password, name } = await request.json() as any;
      if (!username || !password) {
        return new Response(JSON.stringify({ error: '请填写账号和密码' }), { status: 400, headers: corsHeaders });
      }

      if (env.DB) {
        const existing = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).all();
        if (existing.results && existing.results.length > 0) {
          return new Response(JSON.stringify({ error: '用户名已存在' }), { status: 400, headers: corsHeaders });
        }

        const id = 'u_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
        await env.DB.prepare(
          'INSERT INTO users (id, username, password, name, avatar, streak) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, username, password, name || username, avatar, 1).run();

        return new Response(JSON.stringify({
          user: { id, username, name: name || username, avatar, streak: 1 }
        }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        user: {
          id: 'u_' + username,
          username,
          name: name || username,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
          streak: 1
        }
      }), { headers: corsHeaders });
    }

    // 3. 获取打卡列表 /api/checkins
    if (pathname === '/api/checkins' && method === 'GET') {
      if (env.DB) {
        const rows = await env.DB.prepare('SELECT * FROM checkins ORDER BY timestamp DESC LIMIT 100').all();
        const checkins = (rows.results || []).map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          userName: item.user_name,
          userAvatar: item.user_avatar,
          targetType: item.target_type,
          comment: item.comment,
          photo: item.photo,
          audioUrl: item.audio_url,
          aiPraise: item.ai_praise,
          timestamp: Number(item.timestamp),
          location: item.location,
          likes: item.likes ? JSON.parse(item.likes) : []
        }));
        return new Response(JSON.stringify(checkins), { headers: corsHeaders });
      }
      return new Response(JSON.stringify([]), { headers: corsHeaders });
    }

    // 4. 提交打卡 /api/checkin
    if (pathname === '/api/checkin' && method === 'POST') {
      const data = await request.json() as any;
      const id = 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const praiseList = [
        '坚持就是胜利！今天的付出必将成为未来的骄傲！🌟',
        '自律给你自由，今天又是元气满满的一天！💪',
        '滴水穿石，非一日之功。为你的持之以恒点赞！✨',
        '每一步脚印都算数，向着目标继续前进！🔥'
      ];
      const aiPraise = praiseList[Math.floor(Math.random() * praiseList.length)];

      if (env.DB) {
        await env.DB.prepare(`
          INSERT INTO checkins (
            id, user_id, user_name, user_avatar, target_type, comment, photo, audio_url, ai_praise, timestamp, location, likes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          data.userId,
          data.userName,
          data.userAvatar || '',
          data.targetType,
          data.comment || '',
          data.photo || '',
          data.audioUrl || '',
          aiPraise,
          data.timestamp || Date.now(),
          data.location || '',
          '[]'
        ).run();

        await env.DB.prepare('UPDATE users SET streak = streak + 1 WHERE id = ?').bind(data.userId).run();
      }

      return new Response(JSON.stringify({
        success: true,
        record: {
          id,
          ...data,
          aiPraise,
          likes: []
        }
      }), { headers: corsHeaders });
    }

    // 5. 排行榜 /api/leaderboard
    if (pathname === '/api/leaderboard' && method === 'GET') {
      if (env.DB) {
        const rows = await env.DB.prepare('SELECT id, username, name, avatar, streak FROM users ORDER BY streak DESC LIMIT 50').all();
        return new Response(JSON.stringify(rows.results || []), { headers: corsHeaders });
      }
      return new Response(JSON.stringify([]), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), { status: 500, headers: corsHeaders });
  }
};
