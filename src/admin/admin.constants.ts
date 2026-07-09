// Admin menu button labels have moved to src/i18n/locales/*.ts (admin.*Btn).

export const ADMIN_CB = {
  MENU: 'admin:menu',
  USERS: /^admin:users:(\d+)$/,
  STATS: 'admin:stats',
  LEADERBOARD: 'admin:leaderboard',
  STORIES: 'admin:stories',
  APPROVE: /^admin:approve:(\d+)$/,
  REJECT: /^admin:reject:(\d+)$/,
} as const;
