import { HabitTarget, CheckinRecord, SocialPost, User, AdminStats } from '../types';

export const DEFAULT_TARGETS: HabitTarget[] = [
  { id: '1', name: '晨起早读', icon: '🌅', color: '#f59e0b', description: '坚持每天早晨阅读30分钟', active: true, order: 1 },
  { id: '2', name: '运动健身', icon: '🏃', color: '#10b981', description: '每日有氧运动或力量训练', active: true, order: 2 },
  { id: '3', name: '每日复盘', icon: '📝', color: '#6366f1', description: '记录一天的得失与心得', active: true, order: 3 },
  { id: '4', name: '专注工作', icon: '💻', color: '#8b5cf6', description: '保持深度专注不摸鱼', active: true, order: 4 },
];

export const DEFAULT_POSTS: SocialPost[] = [
  {
    id: 'post_1',
    userId: 'u_user1',
    user: { id: 'u_user1', username: 'user1', name: '打卡先锋', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1', streak: 12 },
    target: DEFAULT_TARGETS[0],
    comment: '今天完成了半小时早读，心情格外舒畅！坚持自律！💪',
    createdAt: new Date().toISOString(),
    likesCount: 5,
    isLiked: false,
    comments: [
      { id: 'c1', userId: 'u_user2', userName: '晨跑小鹿', content: '太棒了，一起加油！', createdAt: new Date().toISOString() }
    ]
  },
  {
    id: 'post_2',
    userId: 'u_user2',
    user: { id: 'u_user2', username: 'user2', name: '晨跑小鹿', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2', streak: 7 },
    target: DEFAULT_TARGETS[1],
    comment: '晨跑 5 公里打卡达成，今天配速很稳！🏃‍♂️',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    likesCount: 8,
    isLiked: true,
    comments: []
  }
];

export const DEFAULT_LEADERBOARD: User[] = [
  { id: 'u_user1', username: 'user1', name: '打卡先锋', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1', streak: 12 },
  { id: 'u_user2', username: 'user2', name: '晨跑小鹿', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2', streak: 7 },
  { id: 'u_user3', username: 'user3', name: '读书伴侣', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user3', streak: 3 },
];

export const DEFAULT_ADMIN_STATS: AdminStats = {
  totalUsers: 18,
  activeUsersToday: 6,
  totalCheckins: 142,
  weeklyCheckinGrowth: 23.5,
  topHabit: '晨起早读'
};
