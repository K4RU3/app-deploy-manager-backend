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
  port: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    }
    if (typeof val === 'number') {
      return { host: val, container: val, protocol: 'tcp' };
    }
    return val;
  }, z.object({
    host: z.number().int(),
    container: z.number().int(),
    protocol: z.enum(['tcp', 'udp']).default('tcp'),
  }).optional().nullable()),
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
  status: z.enum(['Running', 'Stopped', 'Error']).optional(),
});

export type Service = z.infer<typeof ServiceSchema>;
