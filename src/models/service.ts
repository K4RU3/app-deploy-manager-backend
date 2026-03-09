import { z } from 'zod';

export const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  repositoryUrl: z.string(),
  branch: z.string(),
  deployMode: z.enum(['branch', 'commit']),
  selectedCommit: z.string().optional().nullable(),
  containerName: z.string(),
  containerPort: z.number().int(),
  volumeName: z.string(),
  // SQLite stores booleans as 0 or 1.
  autoBackup: z.preprocess((val) => {
    if (typeof val === 'number') return val === 1;
    return val;
  }, z.boolean()),
  enabled: z.preprocess((val) => {
    if (typeof val === 'number') return val === 1;
    return val;
  }, z.boolean()),
});

export type Service = z.infer<typeof ServiceSchema>;
