import type { EventKind } from './models';

export const eventTheme: Record<EventKind, { background: string; border: string; text: string }> = {
  school: { background: 'rgba(10,48,89,.88)', border: '#1c9aff', text: '#8fd1ff' },
  work: { background: 'rgba(77,43,2,.88)', border: '#e99b28', text: '#ffe0a2' },
  routine: { background: 'rgba(47,20,83,.88)', border: '#9258ff', text: '#d8c1ff' },
  windDown: { background: 'rgba(10,84,54,.84)', border: '#25c97e', text: '#a8ffd6' },
  trip: { background: 'rgba(11,75,94,.86)', border: '#35daf2', text: '#bff8ff' },
  task: { background: 'rgba(76,8,48,.88)', border: '#ff5ace', text: '#ffd0f3' },
  agency: { background: 'rgba(91,4,58,.88)', border: '#ff64d2', text: '#ffc7f1' },
  personal: { background: 'rgba(42,69,28,.88)', border: '#90df62', text: '#ddffca' },
  goal: { background: 'rgba(36,40,86,.88)', border: '#8794ff', text: '#e1e5ff' },
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
