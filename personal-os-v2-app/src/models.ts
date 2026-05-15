import { z } from 'zod';

export const eventKindSchema = z.enum([
  'school',
  'work',
  'routine',
  'windDown',
  'trip',
  'task',
  'agency',
  'personal',
  'goal',
]);

export const taskKindSchema = z.enum(['personal', 'agency', 'school', 'goal']);

export const sourceSchema = z.enum([
  'legacy-import',
  'manual',
  'ai',
  'school',
  'routine',
  'dashboard',
]);

export const personalOSEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  kind: eventKindSchema,
  movable: z.boolean(),
  protected: z.boolean(),
  groupId: z.string().optional(),
  taskIds: z.array(z.string()).optional(),
  taskTexts: z.array(z.string()).optional(),
  source: sourceSchema,
  color: z
    .object({
      background: z.string().optional(),
      border: z.string().optional(),
      text: z.string().optional(),
    })
    .optional(),
});

export const personalOSTaskSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  done: z.boolean(),
  priority: z.number().int().min(1).max(5).optional(),
  estimatedMinutes: z.number().int().min(5).max(720).optional(),
  kind: taskKindSchema.optional(),
  deadline: z.string().optional(),
  scheduledEventIds: z.array(z.string()),
});

export type PersonalOSEvent = z.infer<typeof personalOSEventSchema>;
export type PersonalOSTask = z.infer<typeof personalOSTaskSchema>;
export type EventKind = z.infer<typeof eventKindSchema>;
export type TaskKind = z.infer<typeof taskKindSchema>;

export type UndoSnapshot = {
  reason: string;
  createdAt: string;
  events: PersonalOSEvent[];
  tasks: PersonalOSTask[];
};

export type ToolResult = {
  ok: boolean;
  reason?: string;
  changedEventCount?: number;
  scheduledTaskCount?: number;
  skipped?: string[];
};

export const PROTECTED_KINDS: EventKind[] = ['school', 'work', 'routine', 'windDown', 'trip'];
