import { Translations } from '../types/translations.interface';

export const ru = {
  common: {
    points: 'очков',
  },

  registration: {
    rules: `\
🏆 *Challenge Bot — Правила соревнования*

• Каждый день публикуется новое задание
• Выполните задание и отправьте результат
• Самые активные участники попадают в рейтинг
• Победители получают специальные призы

Нажмите кнопку ниже, чтобы продолжить.`,
    startBtn: '▶️ Начать',
    subscribeBtn: '📢 Подписаться',
    checkBtn: 'Проверить ✅',
    checkingAnswer: 'Проверяем...',
    notSubscribed:
      '❌ Вы ещё не подписаны на канал.\n\nПерейдите на канал, подпишитесь и нажмите «Проверить ✅».',
    contactBtn: '📱 Отправить номер телефона',
    askFirstName: '👤 Введите ваше имя:',
    askLastName: '👤 Введите вашу фамилию:',
    askPhone: '📱 Отправьте ваш номер телефона:',
    wrongPhoneBtn: '⚠️ Пожалуйста, нажмите кнопку «Отправить номер телефона».',
    wrongPhone: '⚠️ Пожалуйста, отправьте свой собственный номер телефона.',
    askRegion: '📍 Выберите ваш регион:',
    wrongRegion: '⚠️ Пожалуйста, выберите один из предложенных регионов:',
    success: '🎉 Вы успешно зарегистрировались!\n\n📋 Главное меню:',
    langChanged: '✅ Язык изменён.\n\n📋 Главное меню:',
    regions: {
      toshkent_city: 'г. Ташкент',
      toshkent_region: 'Ташкентская область',
      andijon_region: 'Андижанская область',
      fargona_region: 'Ферганская область',
      namangan_region: 'Наманганская область',
      samarqand_region: 'Самаркандская область',
      buxoro_region: 'Бухарская область',
      navoiy_region: 'Навоийская область',
      qashqadaryo_region: 'Кашкадарьинская область',
      surxondaryo_region: 'Сурхандарьинская область',
      jizzax_region: 'Джизакская область',
      sirdaryo_region: 'Сырдарьинская область',
      xorazm_region: 'Хорезмская область',
      karakalpakstan: 'Республика Каракалпакстан',
    },
  },

  mainMenu: {
    locationBtn: '📍 Отправить локацию',
    balanceBtn: '💰 Мой баланс',
    ratingBtn: '🏆 Рейтинг',
    referralBtn: '👥 Пригласить друга',
    storyBtn: '📸 Отправить историю',
    adminPanelBtn: '👑 Admin Panel',
    changeLangBtn: "🌐 Tilni o'zgartirish / Изменить язык",
    userNotFound: '⚠️ Пользователь не найден. Нажмите /start.',
    locationInstruction:
      '📍 *Поделитесь живой локацией*\n\n' +
      'Отправьте *Live Location* для подсчёта шагов:\n\n' +
      '1. Нажмите кнопку *📎* в поле ввода\n' +
      '2. Выберите *Геопозиция*\n' +
      '3. Выберите *Транслировать геопозицию*\n' +
      '4. Выберите время и отправьте\n\n' +
      '⚠️ Обычная разовая геопозиция не принимается.',
    staticLocationWarning:
      '⚠️ *Обычная геопозиция не принята.*\n\n' +
      'Для подсчёта шагов отправьте *Telegram Live Location*:\n\n' +
      '📎 → Геопозиция → *«Транслировать геопозицию»* (Share My Live Location)',
    trackingStarted:
      '✅ *Живая локация принята.*\n' +
      '🚶 Трекинг начат. Можете начинать движение.',
    progressSteps: '🚶 *Шаги:*',
    progressDistance: '📏 *Расстояние:*',
    progressRemaining: '⏳ *Осталось:*',
    progressStepsUnit: 'шагов',
    progressStatusDone: '🔴 Цель выполнена!',
    progressStatusInProgress: '🟢 В процессе',
    progressGoalJustReached: (stats: string) =>
      `🎉 *Поздравляем! Ежедневная цель выполнена!*\n\n${stats}\n\n🏆 *+100 очков получено!*`,
    progressAlreadyDone: (stats: string) =>
      `✅ *Цель уже выполнена!*\n\n${stats}`,
    progressUpdated: (stats: string) => `📍 *Локация обновлена*\n\n${stats}`,
    balanceTitle: '💰 *Мой баланс*',
    balanceTotalPoints: (pts: string) => `🏅 Всего очков: *${pts}*`,
    balanceRankLabel: (rank: number) => `🏆 Рейтинг: *#${rank}*`,
    balanceTodayTitle: '📍 *Результат сегодня:*',
    balanceTodaySteps: (steps: string, goal: string) =>
      `🚶 Шаги: ${steps} / ${goal}`,
    balanceTodayDist: (km: string) => `📏 Расстояние: ${km} км`,
    balanceTodayGoalDone: '✅ Цель выполнена!',
    balanceNoLocation: 'Локация ещё не отправлена',
    ratingTitle: '🏆 *ТОП-10 Рейтинг*',
    ratingEmpty: 'В рейтинге пока никого нет.',
    ratingAnon: 'Пользователь',
    ratingMyRank: (rank: number, pts: string) =>
      `📊 *Ваше место:* #${rank} — ${pts} очков`,
    referralTitle: '👥 Пригласить друзей',
    referralLinkLabel: '🔗 Ваша ссылка:',
    referralFriendsLabel: (n: number) => `👫 Приглашённые друзья: <b>${n}</b>`,
    referralPointsLabel: (pts: number) =>
      `💰 Реферальные очки: <b>${pts} очков</b>`,
    referralBonusNote: (perUser: number) =>
      `<i>+${perUser} очков за каждого зарегистрированного друга!</i>`,
    referralNoBotUsername: '(BOT_USERNAME не установлен в .env)',
  },

  story: {
    prompt:
      '📸 *Отправить историю*\n\n' +
      'Отправьте фото об активности за день.\n' +
      'После подтверждения администратора вы получите *+30 очков*!\n\n' +
      '📎 Отправьте фото (с подписью по желанию).',
    alreadyBonused: '✅ Вы уже получили бонус за историю.',
    pending: '⏳ Ваша история проверяется. Пожалуйста, подождите.',
    submitted:
      '✅ *История отправлена!*\n\n' +
      'После проверки администратором вам будет начислено *+30 очков*.',
  },

  admin: {
    panelTitle: '👑 *Admin Panel*\n\nВыберите раздел:',
    usersBtn: '👥 Пользователи',
    statsBtn: '📊 Статистика',
    leaderboardBtn: '🏆 Рейтинг',
    storiesBtn: '📸 Проверка историй',
    backBtn: '🔙 Назад',
    prevBtn: '◀️ Предыдущая',
    nextBtn: 'Следующая ▶️',
    approveBtn: '✅ Подтвердить',
    rejectBtn: '❌ Отклонить',
    usersHeader: (total: number) =>
      `👥 *Пользователи* — всего ${total.toLocaleString()}`,
    usersEntryLine: (index: number, name: string, pts: string) =>
      `${index}. ${name} — ${pts} очков`,
    usersPage: (page: number, totalPages: number) =>
      `\n📄 Страница ${page}/${Math.max(1, totalPages)}`,
    statsTitle: '📊 *Статистика*',
    statsTotalUsers: (n: number) =>
      `👥 Всего пользователей: *${n.toLocaleString()}*`,
    statsActiveToday: (n: number) =>
      `✅ Активны сегодня: *${n.toLocaleString()}*`,
    statsTotalDist: (km: string) => `📏 Общее расстояние: *${km} км*`,
    statsTotalSteps: (n: number) => `🚶 Всего шагов: *${n.toLocaleString()}*`,
    statsTotalPoints: (n: number) => `💰 Всего очков: *${n.toLocaleString()}*`,
    leaderboardTitle: '🏆 *Рейтинг (ТОП-20)*',
    leaderboardEmpty: 'Пока никого нет.',
    leaderboardEntry: (prefix: string, name: string, pts: string) =>
      `${prefix} ${name} — ${pts} очков`,
    storiesTitle: '📸 *Проверка историй*',
    storiesEmpty: 'Нет историй для проверки.',
    storiesPending: (n: number) => `${n} историй ожидают:`,
    storyCaption: (name: string, captionLine: string, id: number) =>
      `👤 *${name}*${captionLine}\n🆔 История #${id}`,
    alreadyProcessed: '⚠️ Эта история уже была проверена.',
    approveSuccess:
      '✅ История подтверждена. Пользователю начислено +30 очков.',
    rejectSuccess: '❌ История отклонена.',
    userApproved:
      '✅ *Ваша история подтверждена!*\n\nНа ваш счёт начислено *+30 очков*.',
    userRejected:
      '❌ *Ваша история отклонена.*\n\nВы можете попробовать ещё раз.',
  },
} satisfies Translations;
