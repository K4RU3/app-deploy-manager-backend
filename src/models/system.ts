import { z } from 'zod';

export const SystemStatsSchema = z.object({
  cpu: z.number(),
  memory: z.number(),
  disk: z.number(),
});

export type SystemStats = z.infer<typeof SystemStatsSchema>;

export const SystemEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  message: z.string(),
  timestamp: z.string(),
});

export type SystemEvent = z.infer<typeof SystemEventSchema>;
