import type { EventKind } from './models';

export const eventTheme: Record<EventKind, { background: string; border: string; text: string }> = {
  school: { background: 'rgba(8,28,56,.74)', border: '#0d77ff', text: '#2c8dff' },
  work: { background: 'rgba(90,51,0,.48)', border: '#ffb33f', text: '#ffd17b' },
  routine: { background: 'rgba(80,24,137,.34)', border: '#8e4bff', text: '#caa9ff' },
  windDown: { background: 'rgba(8,96,52,.45)', border: '#17b66e', text: '#78ffc0' },
  trip: { background: 'rgba(0,77,103,.58)', border: '#3fe4ff', text: '#c8f8ff' },
  task: { background: 'rgba(76,0,45,.58)', border: '#ff45d6', text: '#ff69e2' },
  agency: { background: 'rgba(76,0,45,.58)', border: '#ff45d6', text: '#ff69e2' },
  personal: { background: 'rgba(44,79,37,.56)', border: '#8dff74', text: '#d8ffd1' },
  goal: { background: 'rgba(88,0,74,.58)', border: '#ff71ec', text: '#ffd0f8' },
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
