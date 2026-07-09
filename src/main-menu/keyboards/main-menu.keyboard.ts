import { Keyboard } from 'grammy';
import { MAIN_MENU } from '../main-menu.constants';

export function mainMenuKeyboard(isAdmin = false): Keyboard {
  const kb = new Keyboard()
    .text(MAIN_MENU.LOCATION)
    .row()
    .text(MAIN_MENU.BALANCE)
    .text(MAIN_MENU.RATING)
    .row()
    .text(MAIN_MENU.REFERRAL)
    .text(MAIN_MENU.STORY);

  if (isAdmin) kb.row().text(MAIN_MENU.ADMIN_PANEL);

  return kb.resized(true).persistent(true);
}
