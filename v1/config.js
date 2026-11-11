/* Site configuration. Only public values here — never the Supabase secret key or R2 keys.
   COURSE_SB_URL / COURSE_SB_KEY — Supabase project and its public (publishable) key: accounts, groups, progress.
   COURSE_VIDEO_BASE — Cloudflare R2 public address for lesson videos.
   COURSE_VIDEOS — videos already uploaded (file names without .mp4); other lessons show "Відео додається".
   COURSE_REVIEW — true while the course is being reviewed: all lessons and tests are open. */
window.COURSE_SB_URL = 'https://vecyoytevyusfuitexjm.supabase.co';
window.COURSE_SB_KEY = 'sb_publishable_ROrjuejpmX0CXcEa0LBGUg_Kai6i9j6';
window.COURSE_VIDEO_BASE = 'https://pub-7dd876ed7c2e4b9ea10736f2080edefd.r2.dev/';
window.COURSE_VIDEOS = ['intro-i02', 'm01-l01', 'm01-l02', 'm01-l03', 'm01-l04', 'm01-l05', 'm01-l06', 'm01-l07', 'm01-l08', 'm01-l09', 'm01-l10', 'm01-l12', 'm02-l01', 'm02-l02'];
window.COURSE_REVIEW = true;
window.COURSE_VIDEO_SIZES = {"intro-i02": [37847101, 17200049], "m01-l01": [11958576, 5170384], "m01-l02": [23547935, 11413211], "m01-l03": [22603459, 10800030], "m01-l04": [12883233, 6438463], "m01-l05": [70759743, 33803938], "m01-l06": [41439027, 19694744], "m01-l07": [152111001, 78744440], "m01-l08": [32617775, 15926660], "m01-l09": [28341602, 13669772], "m01-l10": [45372437, 20354854], "m01-l12": [150008903, 64795441], "m02-l01": [12263579, 6914084], "m02-l02": [10595702, 5702955]};  // bytes: [720p, 480p] — for the offline download menu
