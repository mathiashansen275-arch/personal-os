// lectio-export-os.js
// Put this file in the SAME folder as your existing lectio.js and lectio-run.js.
// It does not replace or change lectio-run.js.
// It runs your existing lectio sync, reads db/lectio-cache.json, and writes lectio.json
// in the exact format the Personal OS dashboard expects.

const fs = require('fs');
const path = require('path');
const lectio = require('./lectio');

const CACHE_PATH = path.join(__dirname, 'db', 'lectio-cache.json');

// CHANGE THIS if your personal-os repo is somewhere else on the server/computer.
// The output file must end up in the GitHub repo root next to index.html.
const OUTPUT_PATH = process.env.PERSONAL_OS_LECTIO_JSON || path.join(__dirname, 'lectio.json');

const LATEST_SCHOOL_END = '14:55';

function timeToMinutes(value) {
  if (!value || !/^\d{1,2}:\d{2}$/.test(String(value))) return null;
  const [h, m] = String(value).split(':').map(Number);
  return h * 60 + m;
}

function clampSchoolEnd(end) {
  if (!end) return end;
  return timeToMinutes(end) > timeToMinutes(LATEST_SCHOOL_END) ? LATEST_SCHOOL_END : end;
}

function cleanTitle(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,?\s*lektiehj[æa]lp(er)?(?:\s+\d{1,2}\s*-\s*\d{1,2})?$/i, '')
    .trim();
}

function lessonHasRealHomework(lesson) {
  if (!lesson || lesson.cancelled || lesson.isAllDay) return false;

  if (Array.isArray(lesson.homeworkTitles) && lesson.homeworkTitles.length > 0) return true;
  if (Array.isArray(lesson.homeworkLinks) && lesson.homeworkLinks.length > 0) return true;

  // Fallback only if your parser leaves actual homework in note.
  // This avoids normal lesson descriptions becoming homework.
  const note = String(lesson.note || '').toLowerCase();
  return /\b(lektie|lektier|homework|aflever|read|solve|exercise|exercises|prepare)\b/i.test(note);
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) {
    throw new Error(`Missing ${CACHE_PATH}. Run: node lectio.js regular 8`);
  }

  const raw = fs.readFileSync(CACHE_PATH, 'utf8').trim();
  if (!raw) throw new Error(`${CACHE_PATH} is empty`);
  return JSON.parse(raw);
}

function buildPersonalOsJson(cache) {
  const school = [];
  const homeworkMap = new Map();

  for (const [date, lessons] of Object.entries(cache.dates || {})) {
    for (const lesson of lessons || []) {
      if (!lesson || lesson.cancelled || lesson.isAllDay) continue;
      if (!lesson.start || !lesson.end) continue;
      if (timeToMinutes(lesson.start) == null || timeToMinutes(lesson.start) >= timeToMinutes(LATEST_SCHOOL_END)) continue;

      const title = cleanTitle(lesson.subject || lesson.hold || lesson.title || 'School');
      if (!title) continue;

      school.push({
        date,
        start: lesson.start,
        end: clampSchoolEnd(lesson.end),
        title
      });

      // If Lectio marks real homework on a lesson, the date is the lesson date.
      // The dashboard schedules it the day before because it checks tomorrow's homework.
      if (lessonHasRealHomework(lesson)) {
        const subject = cleanTitle(lesson.hold || lesson.subject || title);
        const key = `${date}|${subject}`;
        homeworkMap.set(key, { date, subject });
      }
    }
  }

  school.sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  const homework = [...homeworkMap.values()].sort((a, b) => `${a.date} ${a.subject}`.localeCompare(`${b.date} ${b.subject}`));

  return {
    syncedAt: cache.generatedAt || new Date().toISOString(),
    source: 'lectio.js cache',
    school,
    homework
  };
}

async function main() {
  const weeksAhead = Number(process.argv[2] || 8);

  console.log(`[personal-os] syncing Lectio ${weeksAhead} weeks ahead...`);
  const syncResult = await lectio.syncLectioRange({ weeksAhead, mode: 'personal-os-export' });

  if (!syncResult || syncResult.error || !syncResult.ok) {
    throw new Error(syncResult?.error || 'Lectio sync failed');
  }

  const cache = loadCache();
  const output = buildPersonalOsJson(cache);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

  console.log(`[personal-os] wrote ${OUTPUT_PATH}`);
  console.log(`[personal-os] school items: ${output.school.length}`);
  console.log(`[personal-os] homework subjects: ${output.homework.length}`);
}

main().catch((err) => {
  console.error('[personal-os] export failed:', err.message);
  process.exit(1);
});
