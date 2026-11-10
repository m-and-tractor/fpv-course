/* Site configuration (no secrets here).
   COURSE_VIDEO_BASE — where lesson videos live. After Cloudflare R2 is set up: 'https://<r2 public address>/'.
   COURSE_VIDEOS — videos that are already uploaded (file names without .mp4). Lessons whose video is not listed show "Відео додається".
   COURSE_REVIEW — true while the course is being reviewed: all lessons and tests are open. */
window.COURSE_VIDEO_BASE = '../media/';
window.COURSE_VIDEOS = [];
window.COURSE_REVIEW = true;
