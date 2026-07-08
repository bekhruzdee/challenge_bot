import { Keyboard } from 'grammy';
import { MAIN_MENU } from '../main-menu.constants';

export function mainMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text(MAIN_MENU.LOCATION)
    .row()
    .text(MAIN_MENU.BALANCE)
    .text(MAIN_MENU.RATING)
    .row()
    .text(MAIN_MENU.REFERRAL)
    .resized(true)
    .persistent(true);
}
