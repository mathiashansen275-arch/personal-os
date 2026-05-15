import type { EventKind, PersonalOSEvent, PersonalOSTask } from './models';
import { PROTECTED_KINDS } from './models';
import { eventTheme } from './theme';
import { addDays, dateKey, isoWeek, localDateTime, minutesToTime, startOfWeek, timeToMinutes } from './time';

const LEGACY_SCHEDULE_KEY = 'personalOS.schedule.v5';
const LEGACY_TASKS_KEY = 'personalOS.tasks.v1';

type LegacySchedule = {
  custom?: Array<Record<string, unknown>>;
  overrides?: Record<string, Record<string, unknown>>;
  hidden?: string[];
};

type LegacyLectio = {
  school?: Array<Record<string, unknown>>;
};

declare global {
  interface Window {
    LECTIO_DATA?: LegacyLectio;
  }
}

export async function importLegacyData(): Promise<{ events: PersonalOSEvent[]; tasks: PersonalOSTask[]; lectioLoaded: boolean }> {
  const legacySchedule = readJson<LegacySchedule | null>(LEGACY_SCHEDULE_KEY, null);
  const legacyTasks = readJson<Array<Record<string, unknown>> | null>(LEGACY_TASKS_KEY, null);
  const lectio = await loadLectioData();

  return {
    events: [...generatedProtectedEvents(legacySchedule, lectio), ...customLegacyEvents(legacySchedule)].sort(sortEvents),
    tasks: Array.isArray(legacyTasks) ? legacyTasks.map(toTask) : [],
    lectioLoaded: Boolean(lectio?.school?.length),
  };
}

function generatedProtectedEvents(legacy: LegacySchedule | null, lectio: LegacyLectio | null): PersonalOSEvent[] {
  const schoolRows = Array.isArray(lectio?.school)
    ? lectio.school
        .map((row) => ({
          date: extractDate(row.date),
          start: extractTime(row.start),
          end: extractTime(row.end),
          title: String(row.title || row.subject || row.name || 'School'),
        }))
        .filter((row) => row.date && row.start && row.end && timeToMinutes(row.start) < 895)
        .map((row) => ({ ...row, end: timeToMinutes(row.end) > 895 ? '14:55' : row.end }))
    : [];

  const hidden = new Set(legacy?.hidden || []);
  const overrides = legacy?.overrides || {};
  const events: PersonalOSEvent[] = [];
  const firstDay = addDays(startOfWeek(new Date()), -28);

  for (let index = 0; index <= 126; index += 1) {
    const day = addDays(firstDay, index);
    const date = dateKey(day);
    const weekday = (day.getDay() || 7) - 1;
    const week = isoWeek(day);
    const school = schoolRows.filter((row) => row.date === date);
    const base: Array<{ date: string; start: string; end: string; title: string; type: string }> = [];

    if (weekday >= 5 && week % 2 === 0) {
      base.push(block(date, '06:45', '14:15', 'Work', 'work'));
      base.push(block(date, '14:15', '14:45', 'Wind down', 'windDown'));
      base.push(block(date, '21:20', '22:30', 'Evening routine', 'routine'));
    } else {
      if (!school.some((row) => timeToMinutes(row.start) < 465 && timeToMinutes(row.end) > 405)) {
        base.push(block(date, '06:45', '07:45', 'Morning routine', 'routine'));
      }
      base.push(...school.map((row) => block(date, row.start, row.end, row.title, 'school')));
      if (school.length) {
        const lastClassEnd = Math.max(...school.map((row) => timeToMinutes(row.end)));
        const home = Math.min(lastClassEnd + 25, 1275);
        const windEnd = Math.min(home + 20, 1275);
        if (windEnd > home) base.push(block(date, minutesToTime(home), minutesToTime(windEnd), 'Wind down', 'windDown'));
      }
      if (weekday === 2) {
        base.push(block(date, '16:45', '21:30', 'Work', 'work'));
        base.push(block(date, '21:30', '22:30', 'Evening routine', 'routine'));
      } else {
        base.push(block(date, '21:20', '22:30', 'Evening routine', 'routine'));
      }
    }

    for (const item of base) {
      const legacyId = ['sys', item.date, item.start, item.end, item.type, slug(item.title)].join('|');
      if (hidden.has(legacyId)) continue;
      const override = overrides[legacyId] || {};
      const kind = legacyKind(String(override.type || item.type));
      const protectedEvent = PROTECTED_KINDS.includes(kind);
      events.push(makeEvent({
        id: `legacy-${legacyId.replace(/[^a-zA-Z0-9_-]+/g, '-')}`,
        title: String(override.title || item.title),
        start: localDateTime(date, String(override.start || item.start)),
        end: localDateTime(date, String(override.end || item.end)),
        kind,
        protected: protectedEvent,
        movable: !protectedEvent,
        source: item.type === 'school' ? 'school' : 'legacy-import',
      }));
    }
  }

  return events;
}

function customLegacyEvents(legacy: LegacySchedule | null): PersonalOSEvent[] {
  if (!Array.isArray(legacy?.custom)) return [];
  return legacy.custom.map((item) => {
    const date = String(item.date || extractDate(item.start) || dateKey(new Date()));
    const kind = legacyKind(String(item.type || item.kind || 'task'));
    const protectedEvent = PROTECTED_KINDS.includes(kind);
    return makeEvent({
      id: `legacy-custom-${String(item.id || randomId())}`,
      title: String(item.title || 'Imported block'),
      start: String(item.start || '').includes('T') ? String(item.start) : localDateTime(date, String(item.start || '09:00')),
      end: String(item.end || '').includes('T') ? String(item.end) : localDateTime(date, String(item.end || '10:00')),
      kind,
      protected: protectedEvent,
      movable: !protectedEvent,
      source: 'legacy-import',
      taskTexts: protectedEvent ? undefined : [String(item.title || 'Imported block')],
    });
  });
}

function toTask(item: Record<string, unknown>): PersonalOSTask {
  return {
    id: `legacy-task-${String(item.id || randomId())}`,
    text: String(item.text || item.title || item.name || 'Imported task'),
    done: Boolean(item.done || item.completed),
    priority: Number(item.priority || 3),
    estimatedMinutes: Number(item.estimatedMinutes || item.minutes || 60),
    kind: String(item.area || item.kind || '').toLowerCase().includes('agency') ? 'agency' : 'personal',
    scheduledEventIds: Array.isArray(item.scheduledEventIds) ? item.scheduledEventIds.map(String) : [],
  };
}

function makeEvent(event: PersonalOSEvent): PersonalOSEvent {
  return { ...event, color: event.color || eventTheme[event.kind] };
}

function block(date: string, start: string, end: string, title: string, type: string) {
  return { date, start, end, title, type };
}

function legacyKind(value: string): EventKind {
  const lower = value.toLowerCase();
  if (lower === 'school') return 'school';
  if (lower === 'work') return 'work';
  if (lower === 'routine' || lower === 'evening') return 'routine';
  if (lower === 'wind' || lower === 'winddown') return 'windDown';
  if (lower === 'trip' || lower === 'travel') return 'trip';
  if (lower === 'personal') return 'personal';
  if (lower === 'focus' || lower === 'deep') return 'agency';
  return 'task';
}

function loadLectioData(): Promise<LegacyLectio | null> {
  if (window.LECTIO_DATA) return Promise.resolve(window.LECTIO_DATA);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = '../lectio-data.js?v=' + Date.now();
    script.onload = () => resolve(window.LECTIO_DATA || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

function extractDate(value: unknown): string {
  const match = String(value || '').match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? '' : dateKey(date);
}

function extractTime(value: unknown): string {
  const match = String(value || '').match(/\b\d{1,2}:\d{2}\b/);
  return match ? match[0].padStart(5, '0') : '';
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48);
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function sortEvents(a: PersonalOSEvent, b: PersonalOSEvent): number {
  return new Date(a.start).getTime() - new Date(b.start).getTime();
}

function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
