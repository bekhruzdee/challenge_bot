import { InlineKeyboard, Keyboard } from 'grammy';
import { Translations } from '../../i18n/types/translations.interface';

export function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🇺🇿 O'zbekcha", 'lang:uz')
    .text('🇷🇺 Русский', 'lang:ru');
}

export function rulesKeyboard(t: Translations): InlineKeyboard {
  return new InlineKeyboard().text(t.registration.startBtn, 'reg:start');
}

export function notSubscribedKeyboard(
  t: Translations,
  channelLink: string,
): InlineKeyboard {
  return new InlineKeyboard()
    .url(t.registration.subscribeBtn, channelLink)
    .row()
    .text(t.registration.checkBtn, 'reg:check_sub');
}

export function contactKeyboard(t: Translations): Keyboard {
  return new Keyboard()
    .requestContact(t.registration.contactBtn)
    .resized(true)
    .oneTime(true);
}

export function regionKeyboard(t: Translations): Keyboard {
  const names = Object.values(t.registration.regions);
  const kb = new Keyboard().resized(true).oneTime(true);
  for (let i = 0; i < names.length; i += 2) {
    kb.text(names[i]);
    if (names[i + 1]) kb.text(names[i + 1]);
    kb.row();
  }
  return kb;
}
