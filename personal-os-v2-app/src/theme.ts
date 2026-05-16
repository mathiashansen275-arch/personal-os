import type { EventKind } from './models';

export const eventTheme: Record<EventKind, { background: string; border: string; text: string }> = {
  school: { background: 'rgba(7, 38, 75, .88)', border: '#00a7ff', text: '#21b7ff' },
  work: { background: 'rgba(55, 29, 0, .88)', border: '#e09100', text: '#ffd16e' },
  routine: { background: 'rgba(38, 14, 64, .90)', border: '#7f3dff', text: '#d0adff' },
  windDown: { background: 'rgba(0, 66, 36, .88)', border: '#0ed77d', text: '#6fffc0' },
  trip: { background: 'rgba(0, 61, 83, .88)', border: '#33dfff', text: '#c8f8ff' },
  task: { background: 'rgba(58, 0, 34, .88)', border: '#e342bd', text: '#ff68df' },
  agency: { background: 'rgba(58, 0, 34, .88)', border: '#e342bd', text: '#ff68df' },
  personal: { background: 'rgba(31, 50, 20, .88)', border: '#9daf49', text: '#e4f5b5' },
  goal: { background: 'rgba(58, 0, 34, .88)', border: '#e342bd', text: '#ff68df' },
};

export const eventLabel: Record<EventKind, string> = {
  school: 'School',
  work: 'Work',
  routine: 'Routine',
  windDown: 'Wind down',
  trip: 'Trip',
  task: 'Task',
  agency: 'Agency',
  personal: 'Personal',
  goal: 'Goal',
};
