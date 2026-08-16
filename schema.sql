-- ==========================================
-- 微信打卡应用 Cloudflare D1 数据库建表脚本
-- 数据库名称: daka-db
-- 数据库 ID: 6924b928-9984-4dd8-ab00-9ea22d4c71c6
-- ==========================================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar TEXT NOT NULL,
  serverchan_sendkey TEXT,
  created_at TEXT NOT NULL
);

-- 2. 好友申请表
CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id) REFERENCES users(id)
);

-- 3. 好友关系表
CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  user1_id TEXT NOT NULL,
  user2_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user1_id) REFERENCES users(id),
  FOREIGN KEY (user2_id) REFERENCES users(id)
);

-- 4. 打卡项目表
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  members_json TEXT NOT NULL,          -- JSON string of string[]
  sparks_json TEXT NOT NULL,           -- JSON string of Record<string, number>
  removed_members_json TEXT NOT NULL,  -- JSON string of Record<string, RekindleData>
  rules_json TEXT NOT NULL,            -- JSON string of CheckInRule
  created_at TEXT NOT NULL,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- 5. 打卡记录表 (包含原图/音视频与规则快照)
CREATE TABLE IF NOT EXISTS check_ins (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,                  -- 'YYYY-MM-DD'
  photos_json TEXT NOT NULL,           -- JSON string of string[]
  videos_json TEXT NOT NULL,           -- JSON string of string[]
  audios_json TEXT NOT NULL,           -- JSON string of {url, duration}[]
  text TEXT NOT NULL,
  is_qualified INTEGER NOT NULL DEFAULT 1,
  rule_snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. 评论互动表
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  reply_to_comment_id TEXT,
  reply_to_nickname TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 7. 好友私信消息表
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',   -- 'text' | 'image' | 'audio'
  content TEXT NOT NULL,
  audio_duration REAL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- 8. 管理员全局推送/通知配置表
CREATE TABLE IF NOT EXISTS notification_configs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  trigger_time TEXT,
  title_template TEXT NOT NULL,
  content_template TEXT NOT NULL,
  quota_cost_note TEXT,
  created_at TEXT NOT NULL
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_check_ins_project_date ON check_ins(project_id, date);
CREATE INDEX IF NOT EXISTS idx_check_ins_user_date ON check_ins(user_id, date);
CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_comments_project_date ON comments(project_id, date);
