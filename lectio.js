// lectio.js — cached Lectio reader + range sync
require('dotenv').config();
const axios = require("axios");
const cheerio = require("cheerio");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const fs = require("fs");
const path = require("path");

const SCHOOL_ID = process.env.LECTIO_SCHOOL_ID || "95";
const ELEV_ID = process.env.LECTIO_ELEV_ID;
const BASE_URL = `https://www.lectio.dk/lectio/${SCHOOL_ID}`;

const COOKIES_PATH = path.join(__dirname, "lectio-cookies.json");
const CACHE_PATH = path.join(__dirname, "db", "lectio-cache.json");

const DAY_NAMES_DA = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const DAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const STATUS_WORDS = ['ændret!', 'aflyst!', 'changed!', 'cancelled!'];
const DATE_PATTERN = /^\d{1,2}\/\d{1,2}-\d{4}/;
const TIME_PATTERN = /(\d{1,2}:\d{2})\s+til\s+(\d{1,2}:\d{2})|(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/;
const LATEST_SCHOOL_END = "14:55";



const COOKIE_FILE = path.join(__dirname, "lectio-cookies.json");

function makeEmptyJar() {
  return new CookieJar();
}

function loadLectioJar() {
  try {
    if (!fs.existsSync(COOKIE_FILE)) {
      throw new Error("No Lectio cookies found. Run: node lectio-run.js");
    }

    const raw = fs.readFileSync(COOKIE_FILE, "utf8").trim();
    if (!raw) {
      throw new Error("Lectio cookie file is empty. Run: node lectio-run.js");
    }

    const parsed = JSON.parse(raw);

    if (parsed && parsed.cookies) {
      return CookieJar.deserializeSync(parsed);
    }

    const jar = makeEmptyJar();

    for (const cookie of parsed) {
      const protocol = cookie.secure ? "https" : "http";
      const url = `${protocol}://${String(cookie.domain || "").replace(/^\./, "")}${cookie.path || "/"}`;

      const parts = [
        `${cookie.name}=${cookie.value}`,
        `Domain=${cookie.domain}`,
        `Path=${cookie.path || "/"}`
      ];

      if (cookie.httpOnly) parts.push("HttpOnly");
      if (cookie.secure) parts.push("Secure");
      if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`);
      if (!cookie.session && cookie.expires && cookie.expires > 0) {
        parts.push(`Expires=${new Date(cookie.expires * 1000).toUTCString()}`);
      }

      jar.setCookieSync(parts.join("; "), url);
    }

    return jar;
  } catch (err) {
    throw new Error(`Failed to load Lectio cookies: ${err.message}`);
  }
}

function saveLectioJarSafely(jar) {
  const tempPath = `${COOKIES_PATH}.tmp`;
  const serialized = jar.serializeSync();
  fs.writeFileSync(tempPath, JSON.stringify(serialized, null, 2), "utf8");
  fs.renameSync(tempPath, COOKIES_PATH);
}

function summarizeLectioCookies(jar) {
  const cookies = jar.serializeSync().cookies || [];
  return cookies.map((c) => ({
    name: c.key,
    domain: c.domain,
    path: c.path,
    expires: c.expires || null,
    session: !c.expires || c.expires === "Infinity"
  }));
}

function dropSessionCookie(jar) {
  const cookies = jar.serializeSync().cookies || [];
  const keep = cookies.filter((c) => c.key !== "ASP.NET_SessionId");

  const nextJar = makeEmptyJar();

  for (const c of keep) {
    const protocol = c.secure ? "https" : "http";
    const url = `${protocol}://${String(c.domain || "").replace(/^\./, "")}${c.path || "/"}`;

    const parts = [
      `${c.key}=${c.value}`,
      `Domain=${c.domain}`,
      `Path=${c.path || "/"}`
    ];

    if (c.httpOnly) parts.push("HttpOnly");
    if (c.secure) parts.push("Secure");
    if (c.sameSite) parts.push(`SameSite=${c.sameSite}`);
    if (c.expires && c.expires !== "Infinity") {
      parts.push(`Expires=${new Date(c.expires).toUTCString()}`);
    }

    nextJar.setCookieSync(parts.join("; "), url);
  }

  return nextJar;
}

function makeLectioClient(jar) {
  return wrapper(axios.create({
    jar,
    withCredentials: true,
    timeout: 30000,
    maxRedirects: 10,
    validateStatus: () => true,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"
    }
  }));
}

function detectLectioLoggedOut(status, finalUrl, html) {
  const text = String(html || "");
  const url = String(finalUrl || "");

  if (status === 401 || status === 403) return true;
  if (/login|unilogin|brokerauth|openid-connect/i.test(url)) return true;
  if (/log ind|login|unilogin/i.test(text) && !/skema|lektion|hold/i.test(text)) return true;

  return false;
}
function absolutizeLectioUrl(href) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("#")) return null;
  return new URL(href, BASE_URL + "/").toString();
}

function cleanAttachmentTitle(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^[•\-–—\s]+/, "")
    .trim();
}

function collectContentAnchors($, root) {
  const attachments = [];
  const seen = new Set();

  const containers = [
    "#s_m_Content_Content_tocAndToolbar_inlineHomeworkDiv",
    "#homeworkContentContainer",
    ".lc-display-fragment",
    ".ls-paper"
  ];

  for (const containerSelector of containers) {
    const $container = $(root).find(containerSelector).first();
    if (!$container.length) continue;

    $container.find("article a[href], h1 a[href], h2 a[href], h3 a[href], a.lc-display-nakedlink[href], a[target='_blank'][href]").each((_, el) => {
      const $a = $(el);
      const href = ($a.attr("href") || "").trim();
      const text = cleanAttachmentTitle($a.text());

      if (!href) return;
      if (/^javascript:/i.test(href)) return;

      const absolute = absolutizeLectioUrl(href);
      if (!absolute) return;

      if (/macom\.dk/i.test(absolute)) return;
      if (/lectio\.dk\/lectio\//i.test(absolute) && !/GetDocument|Download|attachment|bilag|dokument/i.test(absolute)) return;

      const looksUseful =
        /^https?:\/\//i.test(absolute) ||
        /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|png|jpg|jpeg|webp)(\?|#|$)/i.test(absolute) ||
        /thinkib|youtube|youtu\.be|drive\.google|docs\.google|onedrive|sharepoint|dropbox/i.test(absolute);

      if (!looksUseful) return;
      if (seen.has(absolute)) return;

      seen.add(absolute);
      attachments.push({
        title: text || "Download",
        url: absolute
      });
    });

    if (attachments.length) {
      return attachments;
    }
  }

  return attachments;
}

async function fetchLessonAttachments(client, lessonHref) {
  try {
    if (!lessonHref) return [];

    const absoluteUrl = lessonHref.startsWith("http")
      ? lessonHref
      : new URL(lessonHref, BASE_URL + "/").toString();

    const res = await client.get(absoluteUrl);
    const finalUrl = String(res?.request?.res?.responseUrl || res?.request?.path || "");
    const html = String(res?.data || "");

    if (detectLectioLoggedOut(res.status, finalUrl, html)) {
      return [];
    }

    const $ = cheerio.load(html);

    if (
      absoluteUrl.includes("aktivitetforside2.aspx") &&
      (
        html.includes("download") ||
        html.includes("Download") ||
        html.includes(".pdf") ||
        html.includes(".png") ||
        html.includes(".doc") ||
        html.includes(".docx") ||
        html.includes("Teaterfestival") ||
        html.includes("Tree Diagrams") ||
        html.includes("lc-display-fragment") ||
        html.includes("lc-display-nakedlink")
      )
    ) {
      console.log("[LECTIO ATTACH DEBUG] activity url:");
      console.log(absoluteUrl);

      console.log("[LECTIO ATTACH DEBUG] first 6000 chars:");
      console.log(html.slice(0, 6000));
    }

    const directContentAttachments = collectContentAnchors($, $.root());
    if (directContentAttachments.length) {
      console.log("[LECTIO ATTACH DEBUG] found content attachments:", directContentAttachments);
      return directContentAttachments;
    }

    const attachments = [];
    const seen = new Set();

    $("a[href], area[href]").each((_, el) => {
      const $a = $(el);
      const href = ($a.attr("href") || "").trim();
      const text = cleanAttachmentTitle($a.text());

      if (!href) return;
      if (/^javascript:/i.test(href)) return;

      const absolute = absolutizeLectioUrl(href);
      if (!absolute) return;

      const looksLikeAttachment =
        /dokument|document|download|hent|attachment|bilag|GetDocument|Download/i.test(absolute) ||
        /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|png|jpg|jpeg)(\?|#|$)/i.test(absolute) ||
        /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|png|jpg|jpeg)$/i.test(text) ||
        /thinkib|drive\.google|docs\.google|onedrive|sharepoint|dropbox/i.test(absolute);

      if (!looksLikeAttachment) return;
      if (seen.has(absolute)) return;

      seen.add(absolute);
      attachments.push({
        title: text || "Download",
        url: absolute
      });
    });

    const overviewLink = attachments.find((a) => /DokumentOversigt\.aspx/i.test(a.url));
    if (overviewLink) {
      const overviewAttachments = await fetchDocumentOverviewAttachments(client, overviewLink.url);
      if (overviewAttachments.length) {
        console.log("[LECTIO ATTACH DEBUG] using overview attachments:", overviewAttachments);
        return overviewAttachments;
      }
    }

    const cleaned = attachments.filter((a) => !a.url.includes("#ACH"));
    console.log("[LECTIO ATTACH DEBUG] found attachments:", cleaned);
    return cleaned;
  } catch (err) {
    console.error("[lectio attachments] failed:", err.message);
    return [];
  }
}

async function fetchDocumentOverviewAttachments(client, overviewUrl) {
  try {
    const absoluteUrl = overviewUrl.startsWith("http")
      ? overviewUrl
      : new URL(overviewUrl, BASE_URL + "/").toString();

    const res = await client.get(absoluteUrl);
    const finalUrl = String(res?.request?.res?.responseUrl || res?.request?.path || "");
    const html = String(res?.data || "");

    console.log("[LECTIO DOC OVERVIEW DEBUG] overview url:");
    console.log(absoluteUrl);

    console.log("[LECTIO DOC OVERVIEW DEBUG] first 8000 chars:");
    console.log(html.slice(0, 8000));

    console.log("[LECTIO DOC OVERVIEW DEBUG] has ACH:", html.includes("ACH"));
    console.log("[LECTIO DOC OVERVIEW DEBUG] has png:", html.includes(".png"));
    console.log("[LECTIO DOC OVERVIEW DEBUG] has pdf:", html.includes(".pdf"));
    console.log("[LECTIO DOC OVERVIEW DEBUG] has Teaterfestival:", html.includes("Teaterfestival"));

    if (detectLectioLoggedOut(res.status, finalUrl, html)) {
      return [];
    }

    const $ = cheerio.load(html);

    const contentAttachments = collectContentAnchors($, $.root());
    if (contentAttachments.length) {
      console.log("[LECTIO DOC OVERVIEW DEBUG] found content files:", contentAttachments);
      return contentAttachments;
    }

    const attachments = [];
    const seen = new Set();

    $("a[href], area[href]").each((_, el) => {
      const $a = $(el);
      const href = ($a.attr("href") || "").trim();
      const text = cleanAttachmentTitle($a.text());

      if (!href) return;
      if (href.startsWith("#")) return;
      if (/^javascript:/i.test(href)) return;

      const absolute = absolutizeLectioUrl(href);
      if (!absolute) return;

      const looksLikeRealDocument =
        /dokument|document|download|hent|attachment|bilag|GetDocument|Download/i.test(absolute) ||
        /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|png|jpg|jpeg)(\?|#|$)/i.test(absolute) ||
        /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|png|jpg|jpeg)$/i.test(text) ||
        /thinkib|drive\.google|docs\.google|onedrive|sharepoint|dropbox/i.test(absolute);

      if (!looksLikeRealDocument) return;
      if (absolute.includes("DokumentOversigt.aspx")) return;
      if (seen.has(absolute)) return;

      seen.add(absolute);
      attachments.push({
        title: text || "Download",
        url: absolute
      });
    });

    console.log("[LECTIO DOC OVERVIEW DEBUG] found real files:", attachments);
    return attachments;
  } catch (err) {
    console.error("[lectio doc overview] failed:", err.message);
    return [];
  }
}

function ensureDirs() {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
}

function isoDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getMonday(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getIsoWeekInfo(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);

  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

  return {
    week,
    year: d.getFullYear()
  };
}

function getWeekString(date) {
  const info = getIsoWeekInfo(date);
  return `${String(info.week).padStart(2, "0")}${info.year}`;
}


function loadCache() {
  ensureDirs();
  if (!fs.existsSync(CACHE_PATH)) {
    return {
      generatedAt: null,
      lastMode: null,
      weeksAheadSynced: 0,
      dates: {}
    };
  }

  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {
      generatedAt: null,
      lastMode: null,
      weeksAheadSynced: 0,
      dates: {}
    };
  }
}

function saveCache(cache) {
  ensureDirs();
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

function timeToMinutes(value) {
  if (!value || !/^\d{1,2}:\d{2}$/.test(String(value))) return null;
  const [h, m] = String(value).split(':').map(Number);
  return (h * 60) + m;
}

function isLectureHelper(subject = "", note = "") {
  const text = `${subject} ${note}`.toLowerCase();
  return (
    text.includes('lektiehjælp') ||
    text.includes('lektiehjaelp') ||
    text.includes('lektiehjælper') ||
    text.includes('lektiehjaelper')
  );
}

function shouldIncludeLesson(lesson) {
  if (!lesson) return false;
  if (lesson.isAllDay) return false;
  if (!lesson.start) return false;

  const startMin = timeToMinutes(lesson.start);
  const maxMin = timeToMinutes(LATEST_SCHOOL_END);

  if (startMin == null || maxMin == null) return false;
  if (startMin >= maxMin) return false;

  return true;
}

function decorateLesson(lesson) {
  const lectureHelper = isLectureHelper(lesson.subject, lesson.note);
  return {
    ...lesson,
    isLectureHelper: lectureHelper
  };
}

function normalizeLessons(lessons = []) {
  return lessons
    .filter(shouldIncludeLesson)
    .map(decorateLesson)
    .sort((a, b) => {
      const aTime = a.start || "99:99";
      const bTime = b.start || "99:99";
      return aTime.localeCompare(bTime);
    });
}

function cleanHoldValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const firstPart = raw.split(',')[0].trim();

  if (
    /^\d+[a-zæøå]?\s+[A-Za-zæøå]{2,8}(?:\/[A-Za-z0-9]{1,6})+$/i.test(firstPart) ||
    /^[A-Za-z0-9]+\s+[A-Za-zæøå]{2,8}(?:\/[A-Za-z0-9]{1,6})+$/i.test(firstPart)
  ) {
    return firstPart;
  }

  return raw
    .replace(/\s*,?\s*lektiehj[æa]lper(?:\s+\d{1,2}\s*-\s*\d{1,2})?$/i, '')
    .replace(/\s*,?\s*lektiehj[æa]lp(?:\s+\d{1,2}\s*-\s*\d{1,2})?$/i, '')
    .trim() || null;
}

function parseTooltip(tooltip) {
  if (!tooltip) return null;

  const raw = tooltip;
  const lines = tooltip.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  let subject = null;
  let start = null;
  let end = null;
  let teacher = null;
  let room = null;
  let hold = null;
  let isAllDay = false;

  let inContentBlock = false;
  let currentSection = null;

  const noteLines = [];
  const homeworkTitles = [];
  const moreTitles = [];
  const preContentLines = [];

  const cleanLine = (line) => line.replace(/\s*\[\.\.\.\]\s*/g, '').replace(/\s+/g, ' ').trim();

  const isLikelyHoldLine = (line) => {
    const t = cleanLine(line);
    if (!t) return false;

    return (
      /^\d+[a-zæøå]?\s+[A-Za-zæøå]{2,8}(?:\/[A-Za-z0-9]{1,6})+$/i.test(t) ||
      /^[A-Za-z0-9]+\s+[A-Za-zæøå]{2,8}(?:\/[A-Za-z0-9]{1,6})+$/i.test(t) ||
      /^[0-9][a-zæøå]\s+[a-zæøå]{2,8}\/(hl|sl|ai|aasl|abinitio|stx|hf|ib)$/i.test(t)
    );
  };

  const looksLikeMetaLine = (line) => {
    const low = line.toLowerCase();
    if (!line) return true;
    if (STATUS_WORDS.includes(low)) return true;
    if (DATE_PATTERN.test(line) && line.length < 15) return true;
    if (TIME_PATTERN.test(line)) return true;
    if (low.includes('hele dagen')) return true;
    if (low.startsWith('hold:')) return true;
    if (low.startsWith('lærer:') || low.startsWith('lærere:')) return true;
    if (low.startsWith('lokale:')) return true;
    if (low.startsWith('elev:')) return true;
    if (low.startsWith('note:')) return true;
    if (low.startsWith('lektier:')) return true;
    if (low.startsWith('øvrigt indhold:')) return true;
    return false;
  };

  const looksLikeNoteText = (line) => {
    const t = cleanLine(line);
    const low = t.toLowerCase();
    if (!t) return false;
    if (isLikelyHoldLine(t)) return false;
    if (/^[-•]/.test(t)) return true;
    if (t.length > 55) return true;
    if (/[.!?:"“”]/.test(t)) return true;
    if (/please|read|watch|work on your own|task\s*\d+|answer|discuss|give a brief|explain|we will|you can work|remember to|until page|youtube/i.test(low)) return true;
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLow = line.toLowerCase();

    if (STATUS_WORDS.includes(lineLow)) continue;

    const timeMatch = line.match(TIME_PATTERN);
    if (timeMatch) {
      start = timeMatch[1] || timeMatch[3];
      end = timeMatch[2] || timeMatch[4];
      continue;
    }

    if (lineLow.includes('hele dagen')) {
      isAllDay = true;
      continue;
    }

    if (DATE_PATTERN.test(line) && line.length < 15) continue;

    if (lineLow.startsWith('hold:')) {
     hold = cleanHoldValue(cleanLine(line.replace(/^hold:\s*/i, '')));
      continue;
    }

    if (lineLow.startsWith('lærer:') || lineLow.startsWith('lærere:')) {
      const initials = line.match(/\(([A-ZÆØÅ]{2,4})\)/g);
      if (initials) teacher = initials.map(x => x.slice(1, -1)).join(', ');
      continue;
    }

    if (lineLow.startsWith('lokale:')) {
      room = cleanLine(line.replace(/^lokale:\s*/i, ''));
      continue;
    }

    if (lineLow.startsWith('elev:')) continue;

    if (
      lineLow.startsWith('note:') ||
      lineLow.startsWith('lektier:') ||
      lineLow.startsWith('øvrigt indhold:')
    ) {
      inContentBlock = true;

      if (lineLow.startsWith('lektier:')) {
        currentSection = 'homework';
      } else if (lineLow.startsWith('øvrigt indhold:')) {
        currentSection = 'more';
      } else {
        currentSection = 'note';
      }

      const rest = cleanLine(line.replace(/^(note:|lektier:|øvrigt indhold:)\s*/i, ''));
      if (rest) {
        if (currentSection === 'homework') homeworkTitles.push(rest);
        else if (currentSection === 'more') moreTitles.push(rest);
        else noteLines.push(rest);
      }
      continue;
    }

    if (!inContentBlock && !looksLikeMetaLine(line)) {
      preContentLines.push(cleanLine(line));
      continue;
    }

    if (inContentBlock) {
      const cleaned = cleanLine(line);
      if (!cleaned) continue;

      if (/^lektier:?$/i.test(cleaned)) {
        currentSection = 'homework';
        continue;
      }

      if (/^øvrigt indhold:?$/i.test(cleaned)) {
        currentSection = 'more';
        continue;
      }

      if (/^-\s*/.test(cleaned)) {
        const item = cleaned.replace(/^-\s*/, '').trim();
        if (currentSection === 'homework') homeworkTitles.push(item);
        else if (currentSection === 'more') moreTitles.push(item);
        else noteLines.push(item);
        continue;
      }

      if (currentSection === 'homework') homeworkTitles.push(cleaned);
      else if (currentSection === 'more') moreTitles.push(cleaned);
      else noteLines.push(cleaned);
    }
  }

  const cleanedPreContent = preContentLines.filter(Boolean);

  if (!hold) {
    hold = cleanedPreContent.find(isLikelyHoldLine) || null;
  }

  const subjectCandidates = cleanedPreContent.filter(line => {
    if (!line) return false;
    if (hold && line.toLowerCase() === hold.toLowerCase()) return false;
    if (isLikelyHoldLine(line)) return false;
    return true;
  });

  subject =
    subjectCandidates.find(line => !looksLikeNoteText(line)) ||
    subjectCandidates.find(line => line.length <= 40) ||
    null;

  if (!subject && hold) {
    subject = hold;
  }

  if (!subject) return null;

  const note = noteLines.join(' ').replace(/\s+/g, ' ').trim() || null;

  return {
    subject,
    hold,
    start,
    end,
    teacher,
    room,
    note,
    homeworkTitles,
    moreTitles,
    isAllDay,
    raw: raw.slice(0, 1200)
  };
}

function normalizeLinkTitle(title) {
  return String(title || '')
    .replace(/\s*\[\.\.\.\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function classifyAttachments(attachments = [], parsed = {}) {
  const homeworkSet = new Set((parsed.homeworkTitles || []).map(normalizeLinkTitle));
  const moreSet = new Set((parsed.moreTitles || []).map(normalizeLinkTitle));

  const homeworkLinks = [];
  const moreLinks = [];
  const unknownLinks = [];

  for (const attachment of attachments) {
    const normalized = normalizeLinkTitle(attachment.title);

    if (!normalized) {
      unknownLinks.push(attachment);
      continue;
    }

    if (homeworkSet.has(normalized)) {
      homeworkLinks.push(attachment);
      continue;
    }

    if (moreSet.has(normalized)) {
      moreLinks.push(attachment);
      continue;
    }

    unknownLinks.push(attachment);
  }

  if (!homeworkLinks.length && !moreLinks.length && unknownLinks.length) {
    moreLinks.push(...unknownLinks);
    unknownLinks.length = 0;
  }

  return {
    homeworkLinks,
    moreLinks,
    unknownLinks
  };
}

async function fetchWeek(client, targetDate) {
  const week = getWeekString(targetDate);
  const url = `${BASE_URL}/SkemaNy.aspx?type=elev&elevid=${ELEV_ID}&week=${week}`;
  const res = await client.get(url);

  const finalUrl = String(res?.request?.res?.responseUrl || res?.request?.path || "");
  const html = String(res?.data || "");

  if (detectLectioLoggedOut(res.status, finalUrl, html)) {
    return {
      ok: false,
      authExpired: true,
      error: "Lectio session expired"
    };
  }

  const $ = cheerio.load(html);
  const byDate = {};

  $(".s2skemabrik").each((_, el) => {
    const $el = $(el);
    const tooltip = $el.attr("data-tooltip") || "";
        if (
      tooltip.includes(".png") ||
      tooltip.includes(".pdf") ||
      tooltip.includes(".doc") ||
      tooltip.includes(".docx") ||
      tooltip.includes("[...]")
    ) {
      console.log("[LECTIO DEBUG] tooltip raw:");
      console.log(tooltip);

      console.log("[LECTIO DEBUG] lesson html:");
      console.log($el.html());

      console.log("[LECTIO DEBUG] lesson outer html:");
      console.log($.html($el));
    }
    if (!tooltip) return;

    const parsed = parseTooltip(tooltip);
    if (!parsed) return;
        const lessonHref = ($el.attr("href") || "").trim();
    

    const isCancelled =
      tooltip.toLowerCase().startsWith("aflyst") ||
      $el.hasClass("s2cancelled") ||
      $el.find(".s2cancelled").length > 0;

    const dateMatch = tooltip.match(/(\d{1,2})\/(\d{1,2})-(\d{4})/);
    if (!dateMatch) return;

    const dateKey = `${dateMatch[3]}-${String(dateMatch[2]).padStart(2, "0")}-${String(dateMatch[1]).padStart(2, "0")}`;
    if (!byDate[dateKey]) byDate[dateKey] = [];

   byDate[dateKey].push({
  date: dateKey,
  subject: parsed.subject,
  hold: parsed.hold || null,
  start: parsed.start || null,
  end: parsed.end || null,
  teacher: parsed.teacher || null,
  room: parsed.room || null,
  note: parsed.note || null,
  homeworkTitles: parsed.homeworkTitles || [],
  moreTitles: parsed.moreTitles || [],
  isAllDay: !!parsed.isAllDay,
  cancelled: !!isCancelled,
  lessonHref
});
  });

  for (const dateKey of Object.keys(byDate)) {
    const seen = new Set();

    byDate[dateKey] = byDate[dateKey]
      .filter((l) => {
        const key = [
          l.date,
          l.subject,
          l.start || "",
          l.end || "",
          l.room || "",
          l.cancelled ? "1" : "0"
        ].join("|");

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const aTime = a.start || "99:99";
        const bTime = b.start || "99:99";
        return aTime.localeCompare(bTime);
      });
  }

  const monday = getMonday(targetDate);
  for (let i = 0; i < 7; i++) {
    const dateKey = isoDate(addDays(monday, i));
    if (!byDate[dateKey]) byDate[dateKey] = [];
  }

  for (const dateKey of Object.keys(byDate)) {
    for (const lesson of byDate[dateKey]) {
    const maybeHasAttachment =
  lesson.lessonHref &&
  (
    (Array.isArray(lesson.homeworkTitles) && lesson.homeworkTitles.length > 0) ||
    (Array.isArray(lesson.moreTitles) && lesson.moreTitles.length > 0)
  );

if (!maybeHasAttachment) {
  lesson.attachments = [];
  lesson.homeworkLinks = [];
  lesson.moreLinks = [];
  lesson.unknownLinks = [];
  delete lesson.lessonHref;
  delete lesson.homeworkTitles;
  delete lesson.moreTitles;
  continue;
}

     const fetchedAttachments = await fetchLessonAttachments(client, lesson.lessonHref);
const classified = classifyAttachments(fetchedAttachments, lesson);

lesson.attachments = fetchedAttachments;
lesson.homeworkLinks = classified.homeworkLinks;
lesson.moreLinks = classified.moreLinks;
lesson.unknownLinks = classified.unknownLinks;

delete lesson.lessonHref;
delete lesson.homeworkTitles;
delete lesson.moreTitles;
    }
  }

  return {
    ok: true,
    authExpired: false,
    byDate
  };
}


async function syncLectioRange({ weeksAhead = 8, mode = "regular" } = {}) {
  if (!ELEV_ID) {
    return { error: "Missing LECTIO_ELEV_ID in .env" };
  }

  try {
    let jar = loadLectioJar();
    let client = makeLectioClient(jar);
    const cache = loadCache();
    const baseMonday = getMonday(new Date());

    console.log("[lectio] cookie summary before sync:", summarizeLectioCookies(jar));

    for (let weekOffset = 0; weekOffset <= weeksAhead; weekOffset++) {
      const targetDate = addDays(baseMonday, weekOffset * 7);

      let result = await fetchWeek(client, targetDate);

      if (result.authExpired) {
        console.warn("[lectio] session expired, trying recovery");

        const recoveredJar = dropSessionCookie(jar);
        const recoveredClient = makeLectioClient(recoveredJar);

        result = await fetchWeek(recoveredClient, targetDate);

        if (result.ok) {
          console.log("[lectio] recovery succeeded with persistent cookies");
          jar = recoveredJar;
          client = recoveredClient;
          saveLectioJarSafely(jar);
        } else {
          return {
            error: "Lectio login expired. Run: node lectio-run.js",
            needsLogin: true
          };
        }
      }

      for (const [dateKey, lessons] of Object.entries(result.byDate)) {
        cache.dates[dateKey] = lessons;
      }
    }

    cache.generatedAt = new Date().toISOString();
    cache.lastMode = mode;
    cache.weeksAheadSynced = Math.max(cache.weeksAheadSynced || 0, weeksAhead);

    saveCache(cache);
    saveLectioJarSafely(jar);

    return {
      ok: true,
      generatedAt: cache.generatedAt,
      weeksAheadSynced: cache.weeksAheadSynced,
      dateCount: Object.keys(cache.dates).length
    };
  } catch (err) {
    return { error: err.message };
  }
}

function buildDayResponse(dateKey, rawLessons) {
  const lessons = normalizeLessons(rawLessons || []);
  const cancelled = lessons.filter(l => l.cancelled);
  const active = lessons.filter(l => !l.cancelled);

  return {
    date: dateKey,
    weekday: DAY_NAMES_DA[new Date(dateKey).getDay()],
    total: lessons.length,
    active,
    cancelled,
    lessons,
    summary:
      lessons.length === 0
        ? "Ingen timer"
        : `${active.length} timer${cancelled.length ? ` (${cancelled.length} aflyst)` : ""}`
  };
}

async function getDaySchedule(dateInput) {
  const cache = loadCache();
  const dateKey = dateInput ? isoDate(dateInput) : isoDate(new Date());
  const lessons = cache.dates?.[dateKey] || [];

  return {
    ...buildDayResponse(dateKey, lessons),
    fetchedAt: cache.generatedAt || null
  };
}

async function getTodaySchedule() {
  return getDaySchedule(new Date());
}

async function getWeekScheduleByOffset(offset = 0) {
  const cache = loadCache();
  const monday = addDays(getMonday(new Date()), offset * 7);
  const week = {};

  [0, 1, 2, 3, 4, 5, 6].forEach((i) => {
    const dateObj = addDays(monday, i);
    const dateKey = isoDate(dateObj);
    const dow = dateObj.getDay();
    week[DAY_SHORT[dow]] = normalizeLessons(cache.dates?.[dateKey] || []);
  });

  const weekInfo = getIsoWeekInfo(monday);

  return {
    week,
    offset,
    weekStart: isoDate(monday),
    weekEnd: isoDate(addDays(monday, 6)),
    weekNumber: weekInfo.week,
    fetchedAt: cache.generatedAt || null
  };
}

async function getWeekSchedule() {
  return getWeekScheduleByOffset(0);
}

async function getCacheStatus() {
  const cache = loadCache();
  return {
    fetchedAt: cache.generatedAt || null,
    weeksAheadSynced: cache.weeksAheadSynced || 0,
    dateCount: Object.keys(cache.dates || {}).length,
    lastMode: cache.lastMode || null
  };
}

async function getBriefingBlock() {
  const schedule = await getTodaySchedule();
  if (schedule.error) return `LECTIO: ${schedule.error}`;
  if (schedule.lessons.length === 0) return "LECTIO: Ingen timer i dag";

  const lines = [`LECTIO: ${schedule.summary}`];

  for (const l of schedule.active) {
    lines.push(`  ${l.start || 'Hele dagen'}${l.end ? '–' + l.end : ''} ${l.subject}${l.room ? ` (${l.room})` : ''}`);
  }

  for (const l of schedule.cancelled) {
    lines.push(`  [AFLYST] ${l.start || ''}${l.end ? '–' + l.end : ''} ${l.subject}`);
  }

  return lines.join("\n");
}

function getLectioConnectionStatus() {
  const cache = loadCache();

  const fetchedAt = cache.generatedAt || null;
  const hasData = !!(cache.dates && Object.keys(cache.dates).length > 0);

  let cookieSummary = [];
  let cookieLoadError = null;

  try {
    const jar = loadLectioJar();
    cookieSummary = summarizeLectioCookies(jar);
  } catch (e) {
    cookieLoadError = e.message;
  }

  return {
    ok: hasData && !cookieLoadError,
    syncing: false,
    fetchedAt,
    lastSuccessfulSync: fetchedAt,
    needsLogin: !!cookieLoadError,
    weeksAheadSynced: cache.weeksAheadSynced || 0,
    cookieSummary,
    error: cookieLoadError || (hasData ? null : "No Lectio cache yet")
  };
}

module.exports = {
  syncLectioRange,
  getTodaySchedule,
  getDaySchedule,
  getWeekSchedule,
  getWeekScheduleByOffset,
  getCacheStatus,
  getBriefingBlock,
  getLectioConnectionStatus
};

if (require.main === module) {
  const mode = process.argv[2] || "regular";
  const weeksAhead = Number(process.argv[3] || (mode === "backfill" ? 50 : 8));

  syncLectioRange({ weeksAhead, mode })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.error ? 1 : 0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
