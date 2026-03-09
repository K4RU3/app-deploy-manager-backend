import { z } from 'zod';

export const BackupHistorySchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  file: z.string(),
  createdAt: z.string(), // ISO string
  size: z.number().int(),
});

export type BackupHistory = z.infer<typeof BackupHistorySchema>;
