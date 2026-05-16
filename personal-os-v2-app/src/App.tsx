import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventContentArg, EventInput } from '@fullcalendar/core';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { eventLabel, eventTheme } from './theme';
import type { EventKind, PersonalOSEvent, PersonalOSTask } from './models';
import { PROTECTED_KINDS } from './models';
import { canPlaceEvent } from './scheduler';
import { dateKey, formatClock, toLocalIso } from './time';
import { useV2Store } from './store';

const todayKey = dateKey(new Date());
type Tab = 'schedule' | 'tasks' | 'ai';
type ChatMessage = { role: 'user' | 'assistant'; text: string };

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const initialize = useV2Store((state) => state.initialize);
  const isReady = useV2Store((state) => state.isReady);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <div className="shell">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="workspace">
        {!isReady && <div className="card">Loading Personal OS V2...</div>}
        {isReady && activeTab === 'schedule' && <SchedulePage />}
        {isReady && activeTab === 'tasks' && <TasksPage />}
        {isReady && activeTab === 'ai' && <AiPage />}
      </main>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab }: { activeTab: Tab; setActiveTab: (tab: Tab) => void }) {
  const events = useV2Store((state) => state.events);
  const tasks = useV2Store((state) => state.tasks);
  const undo = useV2Store((state) => state.undo);
  const status = useV2Store((state) => state.status);
  const lectioSynced = useV2Store((state) => state.lectioSynced);
  const lectioStatus = useV2Store((state) => state.lectioStatus);

  return (
    <aside className="side">
      <div className="brand">
        <h1>Personal OS V2</h1>
        <p>Clean React/TypeScript foundation. Production stays untouched until v2 is proven.</p>
      </div>
      <nav className="tabs">
        <button className={activeTab === 'schedule' ? 'active' : ''} onClick={() => setActiveTab('schedule')}>Schedule</button>
        <button className={activeTab === 'tasks' ? 'active' : ''} onClick={() => setActiveTab('tasks')}>To do list</button>
        <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')}>AI tools</button>
      </nav>
      <div className="status">
        <strong>{events.length} events - {tasks.length} tasks</strong>
        <span>{status}</span>
        <span>{undo.length} undo snapshot(s)</span>
        <span className={lectioSynced ? 'syncLine syncedLine' : 'syncLine unsyncedLine'}>{lectioStatus}</span>
        <div>
          <span className="pill">No overlap</span>
          <span className="pill">Protected blocks</span>
          <span className={lectioSynced ? 'pill syncedPill' : 'pill unsyncedPill'}>{lectioSynced ? 'Lectio synced' : 'Lectio unsynced'}</span>
        </div>
      </div>
    </aside>
  );
}

function SchedulePage() {
  const events = useV2Store((state) => state.events);
  const moveEventTool = useV2Store((state) => state.moveEventTool);
  const resizeEventTool = useV2Store((state) => state.resizeEventTool);
  const forceLegacyImport = useV2Store((state) => state.forceLegacyImport);
  const undoTool = useV2Store((state) => state.undoTool);
  const [message, setMessage] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const calendarEvents: EventInput[] = useMemo(() => events.map((event) => toCalendarEvent(event, nowTick)), [events, nowTick]);
  const showResult = (result: { ok: boolean; reason?: string; changedEventCount?: number }) => {
    setMessage(result.ok ? `${result.changedEventCount ?? 0} event(s) changed.` : result.reason ?? 'No changes made.');
  };

  return (
    <section className="card schedulePage">
      <header className="pageHead">
        <div>
          <h2>Schedule V2</h2>
          <p>FullCalendar event engine, deterministic scheduler tools, protected-block validation.</p>
        </div>
        <div className="actions">
          <button onClick={() => void forceLegacyImport().then(showResult)}>Re-import legacy</button>
          <button className="good" onClick={() => showResult(undoTool())}>Undo</button>
        </div>
      </header>
      {message && <div className="notice">{message}</div>}
      <div className="scheduleGrid scheduleGridWithAi">
        <div className="calendarWrap">
          <FullCalendar
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            firstDay={1}
            allDaySlot={false}
            nowIndicator={false}
            height="auto"
            slotMinTime="06:00:00"
            slotMaxTime="23:00:00"
            slotDuration="00:15:00"
            snapDuration="00:05:00"
            expandRows
            editable
            eventOverlap={false}
            eventAllow={(dropInfo, draggedEvent) => {
              if (!draggedEvent || !dropInfo.end) return false;
              const existing = events.find((event) => event.id === draggedEvent.id);
              if (!existing) return false;
              return canPlaceEvent(events, { ...existing, start: toLocalIso(dropInfo.start), end: toLocalIso(dropInfo.end) }, [existing.id], false).ok;
            }}
            events={calendarEvents}
            eventContent={renderEventContent}
            eventDrop={(info) => {
              if (!info.event.start || !info.event.end) {
                info.revert();
                return;
              }
              const result = moveEventTool(info.event.id, toLocalIso(info.event.start), toLocalIso(info.event.end), false);
              if (!result.ok) info.revert();
              showResult(result);
            }}
            eventResize={(info) => {
              if (!info.event.start || !info.event.end) {
                info.revert();
                return;
              }
              const result = resizeEventTool(info.event.id, toLocalIso(info.event.end), toLocalIso(info.event.start), false);
              if (!result.ok) info.revert();
              showResult(result);
            }}
            eventDidMount={(info) => updateProgress(info.el, info.event.start, info.event.end)}
            eventClassNames={(arg) => [`event-${String(arg.event.extendedProps.kind)}`, timePhase(arg.event.start, arg.event.end), arg.event.extendedProps.protected ? 'isProtected' : 'isMovable']}
          />
        </div>
        <AssistantPanel />
      </div>
    </section>
  );
}

function AssistantPanel() {
  const events = useV2Store((state) => state.events);
  const tasks = useV2Store((state) => state.tasks);
  const fillGapsTool = useV2Store((state) => state.fillGapsTool);
  const undoTool = useV2Store((state) => state.undoTool);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Ask me to plan, move, remove, or schedule tasks. I can only change the schedule through validated tools.' },
  ]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setMessages((current) => [...current, { role: 'user', text }]);

    const localToolResult = tryLocalTool(text, fillGapsTool, undoTool);
    if (localToolResult) {
      setMessages((current) => [...current, { role: 'assistant', text: localToolResult }]);
      setBusy(false);
      return;
    }

    try {
      const response = await fetch('/api/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: {
            events: events.slice(0, 120),
            tasks: tasks.slice(0, 80),
            rules: { noOverlap: true, protectedKinds: PROTECTED_KINDS, mutationMode: 'validated-tools-only' },
          },
        }),
      });
      if (!response.ok) throw new Error('DeepSeek endpoint unavailable.');
      const data = (await response.json()) as { reply?: string; content?: string; message?: string };
      setMessages((current) => [...current, { role: 'assistant', text: data.reply || data.content || data.message || 'No changes made.' }]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', text: 'AI backend is not available in this v2 deployment yet. No changes made.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="assistantPanel">
      <div className="assistantHeader">
        <h3>AI Assistant</h3>
        <p>Schedule changes must go through deterministic tools.</p>
      </div>
      <div className="assistantMessages">
        {messages.map((message, index) => (
          <div className={`assistantMessage ${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>
        ))}
      </div>
      <form className="assistantComposer" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask the assistant..." />
        <button className="primary" disabled={busy || !input.trim()}>{busy ? '...' : 'Send'}</button>
      </form>
    </aside>
  );
}

function tryLocalTool(
  text: string,
  fillGapsTool: (args: { date: string; start: string; end: string; includePast: boolean }) => { ok: boolean; reason?: string; changedEventCount?: number; scheduledTaskCount?: number },
  undoTool: () => { ok: boolean; reason?: string },
): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('undo')) {
    const result = undoTool();
    return result.ok ? 'Undone.' : result.reason ?? 'Nothing to undo.';
  }
  if (lower.includes('update') || lower.includes('fill') || lower.includes('schedule tasks')) {
    const result = fillGapsTool({ date: todayKey, start: '06:45', end: '22:30', includePast: false });
    return result.ok ? `${result.changedEventCount ?? 0} event(s) changed. ${result.scheduledTaskCount ?? 0} task(s) scheduled.` : result.reason ?? 'No changes made.';
  }
  return null;
}

function TasksPage() {
  const tasks = useV2Store((state) => state.tasks);
  const addTask = useV2Store((state) => state.addTask);
  const saveTask = useV2Store((state) => state.saveTask);
  const deleteTask = useV2Store((state) => state.deleteTask);
  const fillGapsTool = useV2Store((state) => state.fillGapsTool);
  const [fill, setFill] = useState({ date: todayKey, start: '06:45', end: '22:30', includePast: false });
  const [message, setMessage] = useState('');
  const columns = useMemo<ColumnDef<PersonalOSTask>[]>(() => [
    { accessorKey: 'done', header: 'Done', cell: ({ row }) => <input className="taskCheck" type="checkbox" checked={row.original.done} onChange={(event) => saveTask({ ...row.original, done: event.target.checked })} /> },
    { accessorKey: 'text', header: 'Task', cell: ({ row }) => <input className="taskText" value={row.original.text} onChange={(event) => saveTask({ ...row.original, text: event.target.value })} /> },
    { accessorKey: 'estimatedMinutes', header: 'Min', cell: ({ row }) => <input type="number" min={5} step={5} value={row.original.estimatedMinutes ?? 60} onChange={(event) => saveTask({ ...row.original, estimatedMinutes: Number(event.target.value) })} /> },
    { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <input type="number" min={1} max={5} value={row.original.priority ?? 3} onChange={(event) => saveTask({ ...row.original, priority: Number(event.target.value) })} /> },
    { accessorKey: 'kind', header: 'Kind', cell: ({ row }) => <select value={row.original.kind ?? 'personal'} onChange={(event) => saveTask({ ...row.original, kind: event.target.value as PersonalOSTask['kind'] })}><option value="personal">Personal</option><option value="agency">Agency</option><option value="school">School</option><option value="goal">Goal</option></select> },
    { id: 'scheduled', header: 'Scheduled', cell: ({ row }) => row.original.scheduledEventIds.length ? `${row.original.scheduledEventIds.length} block(s)` : 'Unscheduled' },
    { id: 'actions', header: '', cell: ({ row }) => <button className="danger smallBtn" onClick={() => setMessage(deleteTask(row.original.id).ok ? 'Task deleted.' : 'Could not delete task.')}>Delete</button> },
  ], [deleteTask, saveTask]);
  const table = useReactTable({ data: tasks, columns, getCoreRowModel: getCoreRowModel() });

  return <section className="card"><header className="pageHead"><div><h2>To do list</h2><p>Notion-style editable task table. Update schedules unfinished unscheduled tasks into safe gaps.</p></div><button onClick={addTask}>+ Task</button></header><div className="tools"><label>Date<input type="date" value={fill.date} onChange={(event) => setFill({ ...fill, date: event.target.value })} /></label><label>Start<input type="time" step="300" value={fill.start} onChange={(event) => setFill({ ...fill, start: event.target.value })} /></label><label>End<input type="time" step="300" value={fill.end} onChange={(event) => setFill({ ...fill, end: event.target.value })} /></label><label>Include past<select value={String(fill.includePast)} onChange={(event) => setFill({ ...fill, includePast: event.target.value === 'true' })}><option value="false">No</option><option value="true">Yes</option></select></label><button className="primary" onClick={() => { const result = fillGapsTool(fill); setMessage(result.ok ? `${result.changedEventCount ?? 0} event(s) changed. ${result.scheduledTaskCount ?? 0} task(s) scheduled.` : result.reason ?? 'No changes made.'); }}>Update schedule</button></div>{message && <div className="notice">{message}</div>}<div className="tableWrap"><table className="taskTable"><thead>{table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id}>{headerGroup.headers.map((header) => <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className={row.original.done ? 'done' : ''}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div></section>;
}

function AiPage() {
  const events = useV2Store((state) => state.events);
  const tasks = useV2Store((state) => state.tasks);
  const schema = { principle: 'AI returns strict tool calls. Scheduler validates and executes. DOM/localStorage is never directly mutated by prose.', tools: ['findEvents', 'createEvent', 'deleteEvent', 'moveEvent', 'resizeEvent', 'fillGaps', 'reflowDay', 'undo'], rules: { noOverlap: true, protectedKinds: PROTECTED_KINDS, keepGroupsTogether: true }, context: { eventCount: events.length, taskCount: tasks.length } };
  return <section className="card"><header className="pageHead"><div><h2>AI tool foundation</h2><p>Ready for DeepSeek/assistant-ui once manual deterministic tools are verified.</p></div></header><div className="aiGrid"><AssistantPanel /><pre className="codeBlock">{JSON.stringify(schema, null, 2)}</pre></div></section>;
}

function toCalendarEvent(event: PersonalOSEvent, nowTick: number): EventInput {
  const color = event.color ?? eventTheme[event.kind];
  return { id: event.id, title: event.title, start: event.start, end: event.end, groupId: event.groupId, editable: event.movable && !event.protected, startEditable: event.movable && !event.protected, durationEditable: event.movable && !event.protected, backgroundColor: color.background, borderColor: color.border, textColor: color.text, extendedProps: { ...event, nowTick } };
}
function renderEventContent(arg: EventContentArg) {
  const kind = arg.event.extendedProps.kind as EventKind;
  const ratio = progressRatio(arg.event.start, arg.event.end);
  return <div className="eventInner"><div className="liveProgressFill" style={{ height: `${ratio * 100}%` }} /><div className="eventText"><div className="eventTime">{formatClock(arg.event.start!)}-{formatClock(arg.event.end!)}</div><div className="eventTitle">{arg.event.title}</div><div className="eventMeta">{eventLabel[kind]} - {arg.event.extendedProps.protected ? 'Protected' : 'Movable'}</div></div></div>;
}
function updateProgress(element: HTMLElement, start: Date | null, end: Date | null) {
  const progress = element.querySelector<HTMLElement>('.liveProgressFill');
  if (!progress || !start || !end) return;
  progress.style.height = `${progressRatio(start, end) * 100}%`;
}
function progressRatio(start: Date | null, end: Date | null): number {
  if (!start || !end || !isToday(start)) return 0;
  const now = Date.now();
  if (now <= start.getTime()) return 0;
  if (now >= end.getTime()) return 1;
  return Math.max(0, Math.min(1, (now - start.getTime()) / (end.getTime() - start.getTime())));
}
function timePhase(start: Date | null, end: Date | null): string {
  if (!start || !end || !isToday(start)) return 'time-neutral';
  const now = Date.now();
  if (now < start.getTime()) return 'time-future';
  if (now > end.getTime()) return 'time-past';
  return 'time-current';
}
function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}
