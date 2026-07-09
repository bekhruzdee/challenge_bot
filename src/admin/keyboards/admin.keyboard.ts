import { InlineKeyboard } from 'grammy';
import { ADMIN_MENU } from '../admin.constants';

export function adminMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(ADMIN_MENU.USERS, 'admin:users:1')
    .text(ADMIN_MENU.STATS, 'admin:stats')
    .row()
    .text(ADMIN_MENU.LEADERBOARD, 'admin:leaderboard')
    .text(ADMIN_MENU.STORIES, 'admin:stories');
}

export function usersPageKeyboard(
  page: number,
  totalPages: number,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (page > 1) kb.text('◀️ Oldingi', `admin:users:${page - 1}`);
  if (page < totalPages) kb.text('Keyingi ▶️', `admin:users:${page + 1}`);
  kb.row().text('🔙 Orqaga', 'admin:menu');
  return kb;
}

export function backKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('🔙 Orqaga', 'admin:menu');
}

export function storyActionKeyboard(storyId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Tasdiqlash', `admin:approve:${storyId}`)
    .text('❌ Rad etish', `admin:reject:${storyId}`);
}
