export type RegionKey =
  | 'toshkent_city'
  | 'toshkent_region'
  | 'andijon_region'
  | 'fargona_region'
  | 'namangan_region'
  | 'samarqand_region'
  | 'buxoro_region'
  | 'navoiy_region'
  | 'qashqadaryo_region'
  | 'surxondaryo_region'
  | 'jizzax_region'
  | 'sirdaryo_region'
  | 'xorazm_region'
  | 'karakalpakstan';

export interface Translations {
  common: {
    points: string;
  };

  registration: {
    rules: string;
    startBtn: string;
    subscribeBtn: string;
    checkBtn: string;
    checkingAnswer: string;
    notSubscribed: string;
    instagramPrompt: string;
    instagramBtn: string;
    instagramPending: string;
    instagramPhotoReceived: string;
    instagramApproved: string;
    instagramRejected: string;
    contactBtn: string;
    askFirstName: string;
    askLastName: string;
    askPhone: string;
    wrongPhoneBtn: string;
    wrongPhone: string;
    askRegion: string;
    wrongRegion: string;
    success: string;
    langChanged: string;
    regions: Record<RegionKey, string>;
  };

  mainMenu: {
    locationBtn: string;
    balanceBtn: string;
    ratingBtn: string;
    referralBtn: string;
    storyBtn: string;
    adminPanelBtn: string;
    changeLangBtn: string;
    userNotFound: string;
    locationInstruction: string;
    staticLocationWarning: string;
    trackingStarted: string;
    progressSteps: string;
    progressDistance: string;
    progressRemaining: string;
    progressStepsUnit: string;
    progressStatusDone: string;
    progressStatusInProgress: string;
    progressGoalJustReached: (stats: string) => string;
    progressAlreadyDone: (stats: string) => string;
    progressUpdated: (stats: string) => string;
    balanceTitle: string;
    balanceTotalPoints: (pts: string) => string;
    balanceRankLabel: (rank: number) => string;
    balanceTodayTitle: string;
    balanceTodaySteps: (steps: string, goal: string) => string;
    balanceTodayDist: (km: string) => string;
    balanceTodayGoalDone: string;
    balanceNoLocation: string;
    ratingTitle: string;
    ratingEmpty: string;
    ratingAnon: string;
    ratingMyRank: (rank: number, pts: string) => string;
    referralTitle: string;
    referralLinkLabel: string;
    referralFriendsLabel: (n: number) => string;
    referralPointsLabel: (pts: number) => string;
    referralBonusNote: (perUser: number) => string;
    referralNoBotUsername: string;
    speedTooFastWarning: (speedKmh: string) => string;
  };

  story: {
    prompt: string;
    alreadyBonused: string;
    pending: string;
    submitted: string;
    cooldown: (hours: number) => string;
  };

  admin: {
    panelTitle: string;
    usersBtn: string;
    statsBtn: string;
    leaderboardBtn: string;
    storiesBtn: string;
    instagramBtn: string;
    backBtn: string;
    prevBtn: string;
    nextBtn: string;
    approveBtn: string;
    rejectBtn: string;
    usersHeader: (total: number) => string;
    usersEntryLine: (index: number, name: string, pts: string) => string;
    usersPage: (page: number, totalPages: number) => string;
    statsTitle: string;
    statsTotalUsers: (n: number) => string;
    statsActiveToday: (n: number) => string;
    statsTotalDist: (km: string) => string;
    statsTotalSteps: (n: number) => string;
    statsTotalPoints: (n: number) => string;
    leaderboardTitle: string;
    leaderboardEmpty: string;
    leaderboardEntry: (prefix: string, name: string, pts: string) => string;
    storiesTitle: string;
    storiesEmpty: string;
    storiesPending: (n: number) => string;
    storyCaption: (name: string, captionLine: string, id: number) => string;
    instagramTitle: string;
    instagramEmpty: string;
    instagramPendingCount: (n: number) => string;
    instagramCaption: (name: string, id: number) => string;
    instagramApproveSuccess: string;
    instagramRejectSuccess: string;
    alreadyProcessed: string;
    approveSuccess: string;
    rejectSuccess: string;
    userApproved: string;
    userRejected: string;
    broadcastBtn: string;
    broadcastPrompt: string;
    broadcastConfirmText: string;
    broadcastSending: string;
    broadcastDone: (sent: number, failed: number) => string;
    broadcastCancelled: string;
    broadcastNotFound: string;
  };
}
