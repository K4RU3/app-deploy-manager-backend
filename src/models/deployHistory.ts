import { z } from 'zod';

export const DeployHistorySchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  commitHash: z.string(),
  timestamp: z.string(), // ISO string
  result: z.enum(['success', 'failure']),
  logs: z.string().optional().nullable(),
});

export type DeployHistory = z.infer<typeof DeployHistorySchema>;
