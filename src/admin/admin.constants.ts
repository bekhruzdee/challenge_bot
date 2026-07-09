export const ADMIN_MENU = {
  USERS: '👥 Foydalanuvchilar',
  STATS: '📊 Statistika',
  LEADERBOARD: '🏆 Reyting',
  STORIES: '📸 Hikoya tasdiqlash',
} as const;

export const ADMIN_CB = {
  MENU: 'admin:menu',
  USERS: /^admin:users:(\d+)$/,
  STATS: 'admin:stats',
  LEADERBOARD: 'admin:leaderboard',
  STORIES: 'admin:stories',
  APPROVE: /^admin:approve:(\d+)$/,
  REJECT: /^admin:reject:(\d+)$/,
} as const;
