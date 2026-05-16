import { create } from 'zustand';
import type { PersonalOSEvent, PersonalOSTask, ToolResult, UndoSnapshot } from './models';
import { importLegacyData } from './legacyImport';
import { createEvent, deleteEvent, fillGaps, moveEvent, resizeEvent, validateSchedule } from './scheduler';
import { dateKey } from './time';

const EVENTS_KEY = 'personalOS.v2.events';
const TASKS_KEY = 'personalOS.v2.tasks';
const UNDO_KEY = 'personalOS.v2.undo';
const META_KEY = 'personalOS.v2.meta';

type FillGapsArgs = {
  date: string;
  start: string;
  end: string;
  includePast: boolean;
};

type V2Meta = {
  importedAt?: string;
  lectioLoaded?: boolean;
};

type V2Store = {
  events: PersonalOSEvent[];
  tasks: PersonalOSTask[];
  undo: UndoSnapshot[];
  selectedEventId?: string;
  status: string;
  lectioSynced: boolean;
  lectioStatus: string;
  isReady: boolean;
  initialize: () => Promise<void>;
  forceLegacyImport: () => Promise<ToolResult>;
  selectEvent: (id?: string) => void;
  saveTask: (task: PersonalOSTask) => void;
  addTask: () => void;
  deleteTask: (id: string) => ToolResult;
  createEventTool: (event: Omit<PersonalOSEvent, 'id'> & { id?: string; includePast?: boolean }) => ToolResult;
  deleteEventTool: (id: string) => ToolResult;
  deleteWorkEventsTool: (dates: string[]) => ToolResult;
  moveEventTool: (id: string, start: string, end: string, includePast?: boolean) => ToolResult;
  resizeEventTool: (id: string, end: string, start?: string, includePast?: boolean) => ToolResult;
  fillGapsTool: (args: FillGapsArgs) => ToolResult;
  undoTool: () => ToolResult;
};

const savedMeta = readJson<V2Meta>(META_KEY, {});

export const useV2Store = create<V2Store>((set, get) => ({
  events: readJson<PersonalOSEvent[]>(EVENTS_KEY, []),
  tasks: readJson<PersonalOSTask[]>(TASKS_KEY, []),
  undo: readJson<UndoSnapshot[]>(UNDO_KEY, []),
  selectedEventId: undefined,
  status: 'Loading v2 storage...',
  lectioSynced: Boolean(savedMeta.lectioLoaded),
  lectioStatus: savedMeta.lectioLoaded ? 'Lectio synced' : 'Lectio not synced',
  isReady: false,

  initialize: async () => {
    const currentEvents = readJson<PersonalOSEvent[]>(EVENTS_KEY, []);
    const currentTasks = readJson<PersonalOSTask[]>(TASKS_KEY, []);
    const meta = readJson<V2Meta>(META_KEY, {});
    if (currentEvents.length || currentTasks.length) {
      set({
        events: currentEvents,
        tasks: currentTasks,
        undo: readJson<UndoSnapshot[]>(UNDO_KEY, []),
        status: 'Loaded v2 state.',
        lectioSynced: Boolean(meta.lectioLoaded),
        lectioStatus: meta.lectioLoaded ? 'Lectio synced' : 'Lectio not synced',
        isReady: true,
      });
      return;
    }

    const imported = await importLegacyData();
    const nextMeta = { importedAt: new Date().toISOString(), lectioLoaded: imported.lectioLoaded };
    persist(imported.events, imported.tasks, get().undo);
    writeJson(META_KEY, nextMeta);
    set({
      events: imported.events,
      tasks: imported.tasks,
      status: 'Imported legacy state into v2 keys.',
      lectioSynced: imported.lectioLoaded,
      lectioStatus: imported.lectioLoaded ? 'Lectio synced' : 'Lectio not synced',
      isReady: true,
    });
  },

  forceLegacyImport: async () => {
    const imported = await importLegacyData();
    pushUndo('forceLegacyImport', get());
    const nextMeta = { importedAt: new Date().toISOString(), lectioLoaded: imported.lectioLoaded };
    persist(imported.events, imported.tasks, get().undo);
    writeJson(META_KEY, nextMeta);
    set({
      events: imported.events,
      tasks: imported.tasks,
      selectedEventId: undefined,
      status: 'Re-imported legacy data into v2 keys.',
      lectioSynced: imported.lectioLoaded,
      lectioStatus: imported.lectioLoaded ? 'Lectio synced' : 'Lectio not synced',
    });
    return { ok: true, changedEventCount: imported.events.length };
  },

  selectEvent: (id) => set({ selectedEventId: id }),

  saveTask: (task) => {
    const tasks = get().tasks.map((item) => (item.id === task.id ? task : item));
    persist(get().events, tasks, get().undo);
    set({ tasks });
  },

  addTask: () => {
    const task: PersonalOSTask = {
      id: newId('task'),
      text: 'New task',
      done: false,
      priority: 3,
      kind: 'personal',
      scheduledEventIds: [],
    };
    const tasks = [...get().tasks, task];
    persist(get().events, tasks, get().undo);
    set({ tasks });
  },

  deleteTask: (id) => {
    const task = get().tasks.find((item) => item.id === id);
    if (!task) return { ok: false, reason: 'Task not found.' };
    pushUndo('deleteTask', get());
    const scheduled = new Set(task.scheduledEventIds);
    const events = get().events.filter((event) => !scheduled.has(event.id) || event.protected);
    const tasks = get().tasks.filter((item) => item.id !== id);
    persist(events, tasks, get().undo);
    set({ events, tasks });
    return { ok: true, changedEventCount: task.scheduledEventIds.length };
  },

  createEventTool: (event) => mutateWithUndo('createEvent', get, set, (state) => createEvent(state, event)),
  deleteEventTool: (id) => mutateWithUndo('deleteEvent', get, set, (state) => deleteEvent(state, id)),
  deleteWorkEventsTool: (dates) => {
    const dateSet = new Set(dates);
    const matching = get().events.filter((event) => event.kind === 'work' && dateSet.has(dateKey(event.start)));
    if (!matching.length) return { ok: false, reason: 'No matching work blocks found.' };
    pushUndo('deleteWorkEvents', get());
    const ids = new Set(matching.map((event) => event.id));
    const events = get().events.filter((event) => !ids.has(event.id));
    persist(events, get().tasks, get().undo);
    set({ events, selectedEventId: undefined });
    return { ok: true, changedEventCount: matching.length };
  },
  moveEventTool: (id, start, end, includePast) => mutateWithUndo('moveEvent', get, set, (state) => moveEvent(state, id, start, end, includePast)),
  resizeEventTool: (id, end, start, includePast) => mutateWithUndo('resizeEvent', get, set, (state) => resizeEvent(state, id, end, start, includePast)),
  fillGapsTool: (args) => mutateWithUndo('fillGaps', get, set, (state) => fillGaps(state, args)),

  undoTool: () => {
    const undo = [...get().undo];
    const snapshot = undo.pop();
    if (!snapshot) return { ok: false, reason: 'Nothing to undo.' };
    persist(snapshot.events, snapshot.tasks, undo);
    set({ events: snapshot.events, tasks: snapshot.tasks, undo, selectedEventId: undefined });
    return { ok: true };
  },
}));

function mutateWithUndo(
  reason: string,
  get: () => V2Store,
  set: (partial: Partial<V2Store>) => void,
  mutate: (state: { events: PersonalOSEvent[]; tasks: PersonalOSTask[] }) => { events: PersonalOSEvent[]; tasks: PersonalOSTask[] } & ToolResult,
): ToolResult {
  const state = get();
  const result = mutate({ events: state.events, tasks: state.tasks });
  if (!result.ok) return result;
  const valid = validateSchedule(result.events);
  if (!valid.ok) return valid;
  pushUndo(reason, state);
  persist(result.events, result.tasks, get().undo);
  set({ events: result.events, tasks: result.tasks, selectedEventId: undefined });
  return result;
}

function pushUndo(reason: string, state: Pick<V2Store, 'events' | 'tasks' | 'undo'>): void {
  const nextUndo = [...state.undo, { reason, createdAt: new Date().toISOString(), events: state.events, tasks: state.tasks }].slice(-30);
  writeJson(UNDO_KEY, nextUndo);
  useV2Store.setState({ undo: nextUndo });
}

function persist(events: PersonalOSEvent[], tasks: PersonalOSTask[], undo: UndoSnapshot[]): void {
  writeJson(EVENTS_KEY, events);
  writeJson(TASKS_KEY, tasks);
  writeJson(UNDO_KEY, undo);
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
