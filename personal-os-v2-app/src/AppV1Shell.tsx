import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventContentArg, EventInput } from '@fullcalendar/core';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import type { PersonalOSEvent, PersonalOSTask } from './models';
import { PROTECTED_KINDS } from './models';
import { eventTheme } from './theme';
import { canPlaceEvent } from './scheduler';
import { dateKey, formatClock, isoWeek, toLocalIso } from './time';
import { useV2Store } from './store';

type Tab = 'schedule' | 'tasks' | 'productivity';
type Msg = { role: 'user' | 'assistant'; text: string };
const todayKey = dateKey(new Date());
const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function AppV1Shell() {
  const [tab, setTab] = useState<Tab>('schedule');
  const [chatOpen, setChatOpen] = useState(false);
  const initialize = useV2Store((s) => s.initialize);
  const ready = useV2Store((s) => s.isReady);
  const synced = useV2Store((s) => s.lectioSynced);
  const forceImport = useV2Store((s) => s.forceLegacyImport);

  useEffect(() => { void initialize(); }, [initialize]);

  return <div className="v1App">
    <header className="v1Topbar"><div className="v1Badges"><span className="v1Badge">WEEK {isoWeek(new Date())}</span><button className={`v1Badge ${synced ? 'synced' : 'unsynced'}`} onClick={() => void forceImport()}>{synced ? 'SYNCED' : 'UNSYNCED'}</button></div><div className="v1Nav"><button>←</button><button>TODAY</button><button>→</button></div></header>
    <nav className="v1Tabs"><button className={tab === 'schedule' ? 'active' : ''} onClick={() => setTab('schedule')}>SCHEDULE</button><button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}>TO DO LIST</button><button className={tab === 'productivity' ? 'active' : ''} onClick={() => setTab('productivity')}>PRODUCTIVITY</button></nav>
    {!ready && <section className="v1Panel">Loading Personal OS V2...</section>}
    {ready && tab === 'schedule' && <Schedule />}
    {ready && tab === 'tasks' && <Tasks />}
    {ready && tab === 'productivity' && <section className="v1Panel"><div className="panelTitle">Productivity tracker</div><p className="muted">Productivity tracking stays here while the v2 scheduler is stabilised.</p></section>}
    <button className="floatingAi" onClick={() => setChatOpen(true)}>✦</button>
    {chatOpen && <div className="assistantShade" onClick={() => setChatOpen(false)}><div onClick={(e) => e.stopPropagation()}><Assistant onClose={() => setChatOpen(false)} /></div></div>}
  </div>;
}

function Schedule() {
  const events = useV2Store((s) => s.events);
  const move = useV2Store((s) => s.moveEventTool);
  const resize = useV2Store((s) => s.resizeEventTool);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { const id = window.setInterval(() => setTick(Date.now()), 30000); return () => window.clearInterval(id); }, []);
  const items = useMemo<EventInput[]>(() => events.map((event) => toCal(event, tick)), [events, tick]);
  return <section className="v1Calendar"><FullCalendar plugins={[timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" firstDay={1} allDaySlot={false} nowIndicator={false} headerToolbar={false} dayHeaderContent={(arg) => dayHeader(arg.date)} height="auto" slotMinTime="06:45:00" slotMaxTime="22:30:00" slotDuration="00:15:00" slotLabelInterval="00:15:00" slotLabelContent={(arg) => slotLabel(arg.date)} snapDuration="00:05:00" expandRows editable eventOverlap={false} events={items} eventContent={eventContent} eventDidMount={(i) => setProgress(i.el, i.event.start, i.event.end)} eventClassNames={(a) => [`event-${String(a.event.extendedProps.kind)}`, phase(a.event.start, a.event.end), a.event.extendedProps.protected ? 'isProtected' : 'isMovable']} eventAllow={(d, dragged) => { if (!dragged || !d.end) return false; const existing = events.find((event) => event.id === dragged.id); return existing ? canPlaceEvent(events, { ...existing, start: toLocalIso(d.start), end: toLocalIso(d.end) }, [existing.id], false).ok : false; }} eventDrop={(i) => { if (!i.event.start || !i.event.end) { i.revert(); return; } const result = move(i.event.id, toLocalIso(i.event.start), toLocalIso(i.event.end), false); if (!result.ok) i.revert(); }} eventResize={(i) => { if (!i.event.start || !i.event.end) { i.revert(); return; } const result = resize(i.event.id, toLocalIso(i.event.end), toLocalIso(i.event.start), false); if (!result.ok) i.revert(); }} /></section>;
}

function Assistant({ onClose }: { onClose: () => void }) {
  const events = useV2Store((s) => s.events);
  const tasks = useV2Store((s) => s.tasks);
  const fill = useV2Store((s) => s.fillGapsTool);
  const undo = useV2Store((s) => s.undoTool);
  const deleteMatching = useV2Store((s) => s.deleteEventsMatchingTool);
  const moveMatching = useV2Store((s) => s.moveEventsMatchingTool);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', text: 'Ask DeepSeek anything, or ask it to change blocks.' }]);
  async function send() {
    const text = input.trim(); if (!text || busy) return;
    setInput(''); setBusy(true); setMsgs((m) => [...m, { role: 'user', text }]);
    const local = localTool(text, fill, undo, deleteMatching, moveMatching); if (local) { setMsgs((m) => [...m, { role: 'assistant', text: local }]); setBusy(false); return; }
    try { const r = await fetch('/api/deepseek', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, context: { events: events.slice(0, 120), tasks: tasks.slice(0, 80), rules: { noOverlap: true, protectedKinds: PROTECTED_KINDS } } }) }); if (!r.ok) throw new Error('no api'); const data = await r.json() as { reply?: string; content?: string; message?: string }; setMsgs((m) => [...m, { role: 'assistant', text: data.reply || data.content || data.message || 'No changes made.' }]); } catch { setMsgs((m) => [...m, { role: 'assistant', text: 'AI backend is not available in this v2 deployment yet. No changes made.' }]); }
    setBusy(false);
  }
  return <aside className="v1Assistant"><div className="assistantTitle"><strong>DeepSeek Assistant</strong><button onClick={onClose}>×</button></div><div className="assistantMessages">{msgs.map((m, i) => <div className={`assistantMessage ${m.role}`} key={i}>{m.text}</div>)}</div><form className="assistantComposer" onSubmit={(e) => { e.preventDefault(); void send(); }}><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask me anything..." /><button disabled={busy || !input.trim()}>{busy ? '...' : 'SEND'}</button></form></aside>;
}

function Tasks() {
  const tasks = useV2Store((s) => s.tasks);
  const addTask = useV2Store((s) => s.addTask);
  const saveTask = useV2Store((s) => s.saveTask);
  const deleteTask = useV2Store((s) => s.deleteTask);
  const reorderTask = useV2Store((s) => s.reorderTask);
  const fill = useV2Store((s) => s.fillGapsTool);
  const [dragId, setDragId] = useState<string | null>(null);
  const cols = useMemo<ColumnDef<PersonalOSTask>[]>(() => [
    { accessorKey: 'done', header: 'Done', cell: ({ row }) => <input className="taskCheck" type="checkbox" checked={row.original.done} onChange={(e) => saveTask({ ...row.original, done: e.target.checked })} /> },
    { id: 'drag', header: '', cell: () => <span className="dragHandle">⋮⋮</span> },
    { accessorKey: 'text', header: 'Task text', cell: ({ row }) => <input className="taskText" value={row.original.text} onChange={(e) => saveTask({ ...row.original, text: e.target.value })} /> },
    { id: 'del', header: '', cell: ({ row }) => <button className="trashBtn" title="Delete task" onClick={() => deleteTask(row.original.id)}>🗑</button> },
  ], [deleteTask, saveTask]);
  const table = useReactTable({ data: tasks, columns: cols, getCoreRowModel: getCoreRowModel() });
  return <section className="v1Panel"><div className="panelHead"><div><div className="panelTitle">To do list</div><div className="muted">Write duration in parentheses, for example: Research campaign (45 min) or CRO work (2 hours).</div></div><button onClick={addTask}>+ TASK</button></div><button className="iconRefresh" title="Update schedule" onClick={() => fill({ date: todayKey, start: '06:45', end: '22:30', includePast: false })}>↻</button><div className="tableWrap"><table className="taskTable"><thead>{table.getHeaderGroups().map((g) => <tr key={g.id}>{g.headers.map((h) => <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.original.id} className={row.original.done ? 'done' : ''} draggable onDragStart={() => setDragId(row.original.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragId) reorderTask(dragId, row.original.id); setDragId(null); }}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div></section>;
}

function dayHeader(date: Date) { return `${dayNames[date.getDay()]} (${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')})`; }
function slotLabel(date: Date) { const h = date.getHours(); const m = date.getMinutes(); if (h === 6 && m === 45) return '06:45'; if (h === 7 && m === 0) return '07:00'; if (m === 0 && h >= 8 && h <= 22) return `${String(h).padStart(2, '0')}:00`; return ''; }
function localTool(text: string, fill: (args: { date: string; start: string; end: string; includePast: boolean }) => { ok: boolean; reason?: string; changedEventCount?: number; scheduledTaskCount?: number }, undo: () => { ok: boolean; reason?: string }, deleteMatching: (args: { query: string; dates?: string[]; allowProtected?: boolean }) => { ok: boolean; reason?: string; changedEventCount?: number }, moveMatching: (args: { query: string; dates?: string[]; start: string; end: string; allowProtected?: boolean }) => { ok: boolean; reason?: string; changedEventCount?: number }) { const lower = text.toLowerCase(); if (lower.includes('undo') || lower.includes('revert')) { const r = undo(); return r.ok ? 'Undone.' : r.reason ?? 'Nothing to undo.'; } const dates = parseDates(lower); if (lower.includes('remove') || lower.includes('delete')) { const r = deleteMatching({ query: lower, dates, allowProtected: true }); return r.ok ? `Removed ${r.changedEventCount ?? 0} block(s).` : r.reason ?? 'No changes made.'; } if (lower.includes('move')) { const times = [...lower.matchAll(/(\d{1,2}:\d{2})/g)].map((m) => m[1]); if (times.length >= 2) { const r = moveMatching({ query: lower, dates, start: times[0], end: times[1], allowProtected: false }); return r.ok ? `Moved ${r.changedEventCount ?? 0} block(s).` : r.reason ?? 'No changes made.'; } } if (lower.includes('update') || lower.includes('fill') || lower.includes('schedule tasks')) { const r = fill({ date: todayKey, start: '06:45', end: '22:30', includePast: false }); return r.ok ? `${r.changedEventCount ?? 0} event(s) changed. ${r.scheduledTaskCount ?? 0} task(s) scheduled.` : r.reason ?? 'No changes made.'; } return null; }
function parseDates(text: string): string[] | undefined { if (text.includes('weekend')) return weekendDates(); if (text.includes('today')) return [todayKey]; const date = parseNamedDate(text); return date ? [date] : undefined; }
function parseNamedDate(text: string): string | null { const match = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)/); if (!match) return null; const year = new Date().getFullYear(); const month = monthNames.indexOf(match[2]) + 1; return `${year}-${String(month).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`; }
function weekendDates() { const now = new Date(); const monday = new Date(now); const day = monday.getDay() || 7; monday.setDate(monday.getDate() - day + 1); return [5, 6].map((offset) => { const date = new Date(monday); date.setDate(monday.getDate() + offset); return dateKey(date); }); }
function toCal(event: PersonalOSEvent, tick: number): EventInput { const c = event.color ?? eventTheme[event.kind]; return { id: event.id, title: event.title, start: event.start, end: event.end, groupId: event.groupId, editable: event.movable && !event.protected, startEditable: event.movable && !event.protected, durationEditable: event.movable && !event.protected, backgroundColor: c.background, borderColor: c.border, textColor: c.text, extendedProps: { ...event, tick } }; }
function eventContent(arg: EventContentArg) { return <div className="eventInner"><div className="eventText"><div className="eventTime">{formatClock(arg.event.start!)}-{formatClock(arg.event.end!)}</div><div className="eventTitle">{arg.event.title}</div></div></div>; }
function setProgress(el: HTMLElement, start: Date | null, end: Date | null) { el.style.setProperty('--progress', `${ratio(start, end) * 100}%`); }
function ratio(start: Date | null, end: Date | null) { if (!start || !end || !sameDay(start, new Date())) return 0; const n = Date.now(); if (n <= start.getTime()) return 0; if (n >= end.getTime()) return 1; return Math.max(0, Math.min(1, (n - start.getTime()) / (end.getTime() - start.getTime()))); }
function phase(start: Date | null, end: Date | null) { if (!start || !end || !sameDay(start, new Date())) return 'time-neutral'; const n = Date.now(); if (n < start.getTime()) return 'time-future'; if (n > end.getTime()) return 'time-past'; return 'time-current'; }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
