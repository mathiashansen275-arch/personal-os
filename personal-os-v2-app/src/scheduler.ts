import type { PersonalOSEvent, PersonalOSTask, ToolResult } from './models';
import { PROTECTED_KINDS } from './models';
import { addMinutes, dateKey, durationMinutes, localDateTime, toLocalIso } from './time';

type EngineState = { events: PersonalOSEvent[]; tasks: PersonalOSTask[] };
type EngineMutation = EngineState & ToolResult;

type FillGapsInput = {
  date: string;
  start: string;
  end: string;
  includePast: boolean;
};

export function eventsOverlap(a: Pick<PersonalOSEvent, 'start' | 'end'>, b: Pick<PersonalOSEvent, 'start' | 'end'>): boolean {
  return new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end);
}

export function validateSchedule(events: PersonalOSEvent[]): ToolResult {
  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      if (eventsOverlap(events[i], events[j])) {
        return { ok: false, reason: `Overlap between ${events[i].title} and ${events[j].title}` };
      }
    }
  }
  return { ok: true };
}

export function canPlaceEvent(
  events: PersonalOSEvent[],
  candidate: PersonalOSEvent,
  ignoredIds: string[] = [],
  includePast = false,
): ToolResult {
  if (new Date(candidate.start) >= new Date(candidate.end)) return { ok: false, reason: 'Start must be before end.' };
  if (!includePast && new Date(candidate.end) < new Date()) return { ok: false, reason: 'Cannot schedule into the past.' };

  const ignored = new Set(ignoredIds);
  const overlap = events.find((event) => !ignored.has(event.id) && eventsOverlap(event, candidate));
  if (overlap) return { ok: false, reason: `Would overlap ${overlap.title}.` };
  return { ok: true };
}

export function createEvent(
  state: EngineState,
  input: Omit<PersonalOSEvent, 'id'> & { id?: string; includePast?: boolean },
): EngineMutation {
  const protectedKind = PROTECTED_KINDS.includes(input.kind);
  const event: PersonalOSEvent = {
    ...input,
    id: input.id ?? newId('event'),
    protected: input.protected || protectedKind,
    movable: input.movable && !input.protected && !protectedKind,
  };
  const allowed = canPlaceEvent(state.events, event, [], input.includePast);
  if (!allowed.ok) return { ...state, ...allowed };
  return { ...state, events: [...state.events, event].sort(byStart), ok: true, changedEventCount: 1 };
}

export function deleteEvent(state: EngineState, id: string): EngineMutation {
  const event = state.events.find((item) => item.id === id);
  if (!event) return { ...state, ok: false, reason: 'Event not found.' };
  if (event.protected) return { ...state, ok: false, reason: 'Protected events cannot be deleted.' };
  return {
    events: state.events.filter((item) => item.id !== id),
    tasks: state.tasks.map((task) => ({ ...task, scheduledEventIds: task.scheduledEventIds.filter((eventId) => eventId !== id) })),
    ok: true,
    changedEventCount: 1,
  };
}

export function moveEvent(state: EngineState, id: string, start: string, end: string, includePast?: boolean): EngineMutation {
  return changeMovableEvent(state, id, includePast, (event) => ({ ...event, start, end }));
}

export function resizeEvent(state: EngineState, id: string, end: string, start?: string, includePast?: boolean): EngineMutation {
  return changeMovableEvent(state, id, includePast, (event) => ({ ...event, start: start ?? event.start, end }));
}

export function fillGaps(state: EngineState, input: FillGapsInput): EngineMutation {
  if (!input.date) return { ...state, ok: false, reason: 'Date is required.' };

  const existingMovable = state.events.filter(
    (event) => !event.protected && event.movable && ['task', 'agency', 'personal', 'goal'].includes(event.kind) && dateKey(event.start) === input.date,
  );
  const fixedEvents = state.events.filter((event) => !existingMovable.some((movable) => movable.id === event.id));
  const nextTasks = state.tasks.map((task) => ({ ...task, scheduledEventIds: [...task.scheduledEventIds] }));
  const addedEvents: PersonalOSEvent[] = [];
  const skipped: string[] = [];
  let changedEventCount = 0;
  let scheduledTaskCount = 0;

  const taskCandidates = nextTasks
    .filter((task) => !task.done && task.scheduledEventIds.length === 0)
    .sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3));

  for (const event of existingMovable) {
    const minutes = durationMinutes(event.start, event.end);
    const gap = findFreeGaps([...fixedEvents, ...addedEvents], input.date, input.start, input.end, input.includePast).find(
      (slot) => slot.end.getTime() - slot.start.getTime() >= minutes * 60_000,
    );
    if (!gap) {
      skipped.push(event.title);
      fixedEvents.push(event);
      continue;
    }
    addedEvents.push({ ...event, start: toLocalIso(gap.start), end: toLocalIso(addMinutes(gap.start, minutes)) });
    changedEventCount += 1;
  }

  for (const task of taskCandidates) {
    const minutes = task.estimatedMinutes ?? estimateTaskMinutes(task.text);
    const gap = findFreeGaps([...fixedEvents, ...addedEvents], input.date, input.start, input.end, input.includePast).find(
      (slot) => slot.end.getTime() - slot.start.getTime() >= minutes * 60_000,
    );
    if (!gap) {
      skipped.push(task.text);
      continue;
    }
    const event: PersonalOSEvent = {
      id: newId('task-event'),
      title: task.text,
      start: toLocalIso(gap.start),
      end: toLocalIso(addMinutes(gap.start, minutes)),
      kind: task.kind === 'agency' ? 'agency' : task.kind === 'goal' ? 'goal' : 'personal',
      movable: true,
      protected: false,
      taskIds: [task.id],
      taskTexts: [task.text],
      source: 'manual',
    };
    addedEvents.push(event);
    task.scheduledEventIds = [event.id];
    changedEventCount += 1;
    scheduledTaskCount += 1;
  }

  const events = [...fixedEvents, ...addedEvents].sort(byStart);
  const valid = validateSchedule(events);
  if (!valid.ok) return { ...state, ...valid };

  return {
    events,
    tasks: nextTasks,
    ok: changedEventCount > 0,
    reason: changedEventCount > 0 ? undefined : 'No eligible task or movable event fit into a safe gap.',
    changedEventCount,
    scheduledTaskCount,
    skipped,
  };
}

export function estimateTaskMinutes(text: string): number {
  const parenMatches = [...text.matchAll(/\(([^)]*)\)/g)].map((match) => match[1]);
  for (const content of parenMatches.reverse()) {
    const minutes = parseDurationText(content);
    if (minutes) return minutes;
  }
  return parseDurationText(text) ?? 60;
}

function parseDurationText(text: string): number | null {
  const normalized = text.toLowerCase().replace(/,/g, '.');
  const hourMinute = normalized.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\s*(?:(\d+)\s*(?:m|min|mins|minute|minutes))?/);
  if (hourMinute) {
    const hours = Number(hourMinute[1]);
    const minutes = hourMinute[2] ? Number(hourMinute[2]) : 0;
    return clampDuration(Math.round(hours * 60 + minutes));
  }
  const minute = normalized.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/);
  if (minute) return clampDuration(Number(minute[1]));
  return null;
}

function clampDuration(minutes: number): number {
  if (!Number.isFinite(minutes)) return 60;
  return Math.max(5, Math.min(720, minutes));
}

export function findFreeGaps(events: PersonalOSEvent[], date: string, start: string, end: string, includePast: boolean) {
  let cursor = new Date(localDateTime(date, start));
  const windowEnd = new Date(localDateTime(date, end));
  const now = new Date();
  if (!includePast && dateKey(now) === date && now > cursor) cursor = now;

  const busy = events
    .filter((event) => dateKey(event.start) === date)
    .map((event) => ({ start: new Date(event.start), end: new Date(event.end) }))
    .filter((slot) => slot.end > cursor && slot.start < windowEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const gaps: Array<{ start: Date; end: Date }> = [];
  for (const slot of busy) {
    if (slot.start > cursor) gaps.push({ start: new Date(cursor), end: new Date(slot.start) });
    if (slot.end > cursor) cursor = slot.end;
  }
  if (cursor < windowEnd) gaps.push({ start: new Date(cursor), end: new Date(windowEnd) });
  return gaps;
}

function changeMovableEvent(
  state: EngineState,
  id: string,
  includePast: boolean | undefined,
  mapper: (event: PersonalOSEvent) => PersonalOSEvent,
): EngineMutation {
  const event = state.events.find((item) => item.id === id);
  if (!event) return { ...state, ok: false, reason: 'Event not found.' };
  if (event.protected || !event.movable) return { ...state, ok: false, reason: 'Event is protected.' };
  const nextEvent = mapper(event);
  const allowed = canPlaceEvent(state.events, nextEvent, [id], includePast);
  if (!allowed.ok) return { ...state, ...allowed };
  return { ...state, events: state.events.map((item) => (item.id === id ? nextEvent : item)).sort(byStart), ok: true, changedEventCount: 1 };
}

function byStart(a: PersonalOSEvent, b: PersonalOSEvent): number {
  return new Date(a.start).getTime() - new Date(b.start).getTime();
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
