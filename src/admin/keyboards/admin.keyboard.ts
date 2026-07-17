import { InlineKeyboard } from 'grammy';
import { Translations } from '../../i18n/types/translations.interface';

export function adminMenuKeyboard(t: Translations): InlineKeyboard {
  const a = t.admin;
  return new InlineKeyboard()
    .text(a.usersBtn, 'admin:users:1')
    .text(a.statsBtn, 'admin:stats')
    .row()
    .text(a.leaderboardBtn, 'admin:leaderboard')
    .text(a.storiesBtn, 'admin:stories')
    .row()
    .text(a.instagramBtn, 'admin:instagram');
}

export function usersPageKeyboard(
  page: number,
  totalPages: number,
  t: Translations,
): InlineKeyboard {
  const a = t.admin;
  const kb = new InlineKeyboard();
  if (page > 1) kb.text(a.prevBtn, `admin:users:${page - 1}`);
  if (page < totalPages) kb.text(a.nextBtn, `admin:users:${page + 1}`);
  kb.row().text(a.backBtn, 'admin:menu');
  return kb;
}

export function backKeyboard(t: Translations): InlineKeyboard {
  return new InlineKeyboard().text(t.admin.backBtn, 'admin:menu');
}

export function storyActionKeyboard(
  storyId: number,
  t: Translations,
): InlineKeyboard {
  const a = t.admin;
  return new InlineKeyboard()
    .text(a.approveBtn, `admin:approve:${storyId}`)
    .text(a.rejectBtn, `admin:reject:${storyId}`);
}

export function instagramActionKeyboard(
  verificationId: number,
  t: Translations,
): InlineKeyboard {
  const a = t.admin;
  return new InlineKeyboard()
    .text(a.approveBtn, `admin:ig_approve:${verificationId}`)
    .text(a.rejectBtn, `admin:ig_reject:${verificationId}`);
}
