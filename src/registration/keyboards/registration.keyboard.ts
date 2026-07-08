import { InlineKeyboard, Keyboard } from 'grammy';
import { REGIONS } from '../registration.constants';

export function rulesKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('▶️ Boshlash', 'reg:start');
}

export function notSubscribedKeyboard(channelLink: string): InlineKeyboard {
  return new InlineKeyboard()
    .url("📢 Obuna bo'lish", channelLink)
    .row()
    .text('Tekshirish ✅', 'reg:check_sub');
}

export function contactKeyboard(): Keyboard {
  return new Keyboard()
    .requestContact('📱 Telefon raqamni yuborish')
    .resized(true)
    .oneTime(true);
}

export function regionKeyboard(): Keyboard {
  const kb = new Keyboard().resized(true).oneTime(true);
  for (let i = 0; i < REGIONS.length; i += 2) {
    kb.text(REGIONS[i]);
    if (REGIONS[i + 1]) kb.text(REGIONS[i + 1]);
    kb.row();
  }
  return kb;
}
