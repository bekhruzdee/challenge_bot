import { Translations } from '../types/translations.interface';

export const uz = {
  common: {
    points: 'ball',
  },

  registration: {
    rules: `\
🏆 *Challenge Bot — Musobaqa qoidalari*

• Har kuni yangi topshiriq e'lon qilinadi
• Topshiriqni bajarib, natijangizni yuboring
• Eng faol ishtirokchilar reytingga kiradi
• G'oliblar maxsus mukofotlar bilan taqdirlanadi

Davom etish uchun quyidagi tugmani bosing.`,
    startBtn: '▶️ Boshlash',
    subscribeBtn: "📢 Obuna bo'lish",
    checkBtn: 'Tekshirish ✅',
    checkingAnswer: 'Tekshirilmoqda...',
    notSubscribed:
      "❌ Siz hali kanalga obuna bo'lmadingiz.\n\nKanalga o'tib, obuna bo'ling va «Tekshirish ✅» tugmasini bosing.",
    instagramPrompt:
      "📸 Instagram sahifamizga obuna bo'ling va obuna bo'lganingizni tasdiqlovchi skrinshot yuboring",
    instagramBtn: '📸 Instagramga o\'tish',
    instagramPending: '⏳ Skrinshot admin tomonidan tekshirilmoqda, kuting...',
    instagramPhotoReceived: '⏳ Skrinshot qabul qilindi! Admin tasdiqlashini kuting...',
    instagramApproved:
      "✅ Instagram obunangiz tasdiqlandi! Endi ro'yxatdan o'tishingiz mumkin.",
    instagramRejected:
      "❌ Instagram obunangiz tasdiqlanmadi. Iltimos, to'g'ri skrinshot yuboring 📸",
    contactBtn: '📱 Telefon raqamni yuborish',
    askFirstName: '👤 Ismingizni kiriting:',
    askLastName: '👤 Familiyangizni kiriting:',
    askPhone: '📱 Telefon raqamingizni yuboring:',
    wrongPhoneBtn: '⚠️ Iltimos, «Telefon raqamni yuborish» tugmasini bosing.',
    wrongPhone: "⚠️ Iltimos, o'z telefon raqamingizni yuboring.",
    askRegion: '📍 Viloyatingizni tanlang:',
    wrongRegion: '⚠️ Iltimos, quyidagi viloyatlardan birini tanlang:',
    success: "🎉 Ro'yxatdan muvaffaqiyatli o'tdingiz!\n\n📋 Asosiy menyu:",
    langChanged: "✅ Til o'zgartirildi.\n\n📋 Asosiy menyu:",
    regions: {
      toshkent_city: 'Toshkent shahri',
      toshkent_region: 'Toshkent viloyati',
      andijon_region: 'Andijon viloyati',
      fargona_region: "Farg'ona viloyati",
      namangan_region: 'Namangan viloyati',
      samarqand_region: 'Samarqand viloyati',
      buxoro_region: 'Buxoro viloyati',
      navoiy_region: 'Navoiy viloyati',
      qashqadaryo_region: 'Qashqadaryo viloyati',
      surxondaryo_region: 'Surxondaryo viloyati',
      jizzax_region: 'Jizzax viloyati',
      sirdaryo_region: 'Sirdaryo viloyati',
      xorazm_region: 'Xorazm viloyati',
      karakalpakstan: "Qoraqalpog'iston Respublikasi",
    },
  },

  mainMenu: {
    locationBtn: '📍 Lokatsiya yuborish',
    balanceBtn: '💰 Mening balansim',
    ratingBtn: '🏆 Reyting',
    referralBtn: "👥 Do'st taklif qilish",
    storyBtn: '📸 Storis yuborish (Screenshot)',
    adminPanelBtn: "👑 Admin paneli",
    changeLangBtn: "🌐 Tilni o'zgartirish",
    userNotFound: "⚠️ Foydalanuvchi topilmadi. /start buyrug'ini bosing.",
    locationInstruction:
      '📍 *Jonli joylashuvni ulashing*\n\n' +
      'Qadamlarni hisoblash uchun *Live Location* yuboring:\n\n' +
      '1. Xabar maydonidagi *📎* tugmasini bosing\n' +
      '2. *Lokatsiya* ni tanlang\n' +
      '3. *Jonli joylashuvni ulashish* ni tanlang\n' +
      '4. Ulashish vaqtini tanlang va yuboring\n\n' +
      '⚠️ Oddiy bir martalik lokatsiya qabul qilinmaydi.',
    staticLocationWarning:
      '⚠️ *Oddiy lokatsiya qabul qilinmadi.*\n\n' +
      'Qadamlarni hisoblash uchun *Telegram Live Location* ni yuboring:\n\n' +
      '📎 → Lokatsiya → *"Jonli joylashuvni ulashish"* (Share My Live Location)',
    trackingStarted:
      '✅ *Jonli joylashuv qabul qilindi.*\n' +
      '🚶 Tracking boshlandi. Yurishni boshlashingiz mumkin.',
    progressSteps: '🚶 *Qadamlar:*',
    progressDistance: '📏 *Masofa:*',
    progressRemaining: '⏳ *Qolgan:*',
    progressStepsUnit: 'qadam',
    progressStatusDone: '🔴 Maqsad bajarildi!',
    progressStatusInProgress: '🟢 Jarayonda',
    progressGoalJustReached: (stats: string) =>
      `🎉 *Tabriklaymiz! Kunlik maqsad bajarildi!*\n\n${stats}\n\n🏆 *+100 ball oldiniz!*`,
    progressAlreadyDone: (stats: string) =>
      `✅ *Maqsad allaqachon bajarilgan!*\n\n${stats}`,
    progressUpdated: (stats: string) =>
      `📍 *Lokatsiya yanglilandi*\n\n${stats}`,
    balanceTitle: '💰 *Mening balansim*',
    balanceTotalPoints: (pts: string) => `🏅 Umumiy ball: *${pts}*`,
    balanceRankLabel: (rank: number) => `🏆 Reyting: *#${rank}*`,
    balanceTodayTitle: '📍 *Bugungi natija:*',
    balanceTodaySteps: (steps: string, goal: string) =>
      `🚶 Qadamlar: ${steps} / ${goal}`,
    balanceTodayDist: (km: string) => `📏 Masofa: ${km} km`,
    balanceTodayGoalDone: '✅ Maqsad bajarildi!',
    balanceNoLocation: 'Hali lokatsiya yuborilmagan',
    ratingTitle: '🏆 *TOP-10 Reyting*',
    ratingEmpty: "Hali hech kim ro'yxatda yo'q.",
    ratingAnon: 'Foydalanuvchi',
    ratingMyRank: (rank: number, pts: string) =>
      `📊 *Sizning o'rningiz:* #${rank} — ${pts} ball`,
    referralTitle: "👥 Do'stlarni taklif qilish",
    referralLinkLabel: '🔗 Sizning havolangiz:',
    referralFriendsLabel: (n: number) =>
      `👫 Taklif qilgan do'stlar: <b>${n}</b>`,
    referralPointsLabel: (pts: number) =>
      `💰 Referral ballari: <b>${pts} ball</b>`,
    referralBonusNote: (perUser: number) =>
      `<i>Har bir ro'yxatdan o'tgan do'stingiz uchun +${perUser} ball!</i>`,
    referralNoBotUsername: "(BOT_USERNAME .env faylida o'rnatilmagan)",
    speedTooFastWarning: (speedKmh: string) =>
      `⚠️ Siz ${speedKmh} km/soat tezlikda harakatlanmoqdasiz. Bu tezlikdagi harakat qadam sifatida hisoblanmaydi — iltimos, piyoda yuring.`,
  },

  story: {
    prompt:
      '📸 *Storis yuborish (Screenshot)*\n\n' +
      'Storis skrinshoti (screenshot) yuboring.\n' +
      "Admin tasdiqlashidan so'ng *+15 ball* olasiz!\n\n" +
      '📎 Skrinshot yuboring (ixtiyoriy sarlavha bilan).',
    alreadyBonused: '✅ Siz allaqachon storis bonusini oldingiz.',
    pending: "⏳ Sizning storisingiz ko'rib chiqilmoqda. Iltimos, kuting.",
    submitted:
      '✅ *Storisingiz yuborildi!*\n\n' +
      "Admin ko'rib chiqqandan so'ng sizga *+15 ball* beriladi.",
    cooldown: (hours: number) =>
      `⏳ Keyingi storyni yuborish uchun ${hours} soat kutishingiz kerak.`,
  },

  admin: {
    panelTitle: "👑 *Admin Panel*\n\nBo'limni tanlang:",
    usersBtn: '👥 Foydalanuvchilar',
    statsBtn: '📊 Statistika',
    leaderboardBtn: '🏆 Reyting',
    storiesBtn: '📸 Storis tasdiqlash',
    instagramBtn: '📸 Instagram obunalar',
    backBtn: '🔙 Orqaga',
    prevBtn: '◀️ Oldingi',
    nextBtn: 'Keyingi ▶️',
    approveBtn: '✅ Tasdiqlash',
    rejectBtn: '❌ Rad etish',
    usersHeader: (total: number) =>
      `👥 *Foydalanuvchilar* — jami ${total.toLocaleString()} ta`,
    usersEntryLine: (index: number, name: string, pts: string) =>
      `${index}. ${name} — ${pts} ball`,
    usersPage: (page: number, totalPages: number) =>
      `\n📄 Sahifa ${page}/${Math.max(1, totalPages)}`,
    statsTitle: '📊 *Statistika*',
    statsTotalUsers: (n: number) =>
      `👥 Jami foydalanuvchilar: *${n.toLocaleString()}*`,
    statsActiveToday: (n: number) => `✅ Bugun faol: *${n.toLocaleString()}*`,
    statsTotalDist: (km: string) => `📏 Umumiy masofa: *${km} km*`,
    statsTotalSteps: (n: number) =>
      `🚶 Umumiy qadamlar: *${n.toLocaleString()}*`,
    statsTotalPoints: (n: number) => `💰 Umumiy ball: *${n.toLocaleString()}*`,
    leaderboardTitle: '🏆 *Reyting (TOP-20)*',
    leaderboardEmpty: "Hali hech kim yo'q.",
    leaderboardEntry: (prefix: string, name: string, pts: string) =>
      `${prefix} ${name} — ${pts} ball`,
    storiesTitle: '📸 *Storis tasdiqlash*',
    storiesEmpty: "Ko'rib chiqiladigan storis yo'q.",
    storiesPending: (n: number) => `${n} ta storis kutmoqda:`,
    storyCaption: (name: string, captionLine: string, id: number) =>
      `👤 *${name}*${captionLine}\n🆔 Storis #${id}`,
    instagramTitle: '📸 *Instagram obunalar*',
    instagramEmpty: "Kutayotgan so'rovlar yo'q ✅",
    instagramPendingCount: (n: number) => `📸 ${n} ta so'rov kutmoqda:`,
    instagramCaption: (name: string, id: number) =>
      `👤 *${name}*\n🆔 Tasdiqlash #${id}\nHolat: ⏳ Kutmoqda`,
    instagramApproveSuccess: '✅ Tasdiqlandi',
    instagramRejectSuccess: '❌ Rad etildi',
    alreadyProcessed: "⚠️ Bu storis allaqachon ko'rib chiqilgan.",
    approveSuccess: '✅ Storis tasdiqlandi. Foydalanuvchiga +15 ball berildi.',
    rejectSuccess: '❌ Storis rad etildi.',
    userApproved:
      "✅ *Storisingiz tasdiqlandi!*\n\nHisobingizga *+15 ball* qo'shildi.",
    userRejected:
      "❌ *Storisingiz rad etildi.*\n\nQayta urinib ko'rishingiz mumkin.",
  },
} satisfies Translations;
