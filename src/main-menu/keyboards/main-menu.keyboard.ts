import { Keyboard } from 'grammy';
import { Translations } from '../../i18n/types/translations.interface';

export function mainMenuKeyboard(t: Translations, isAdmin = false): Keyboard {
  const m = t.mainMenu;
  const kb = new Keyboard()
    .text(m.locationBtn)
    .row()
    .text(m.balanceBtn)
    .text(m.ratingBtn)
    .row()
    .text(m.referralBtn)
    .text(m.storyBtn);

  if (isAdmin) kb.row().text(m.adminPanelBtn);

  kb.row().text(m.changeLangBtn);

  return kb.resized(true).persistent(true);
}
