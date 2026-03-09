import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

dotenv.config();

const envSchema = z.object({
  DB_PATH: z.string().default(path.resolve(process.cwd(), 'storage/database.sqlite')),
  REPOS_PATH: z.string().default(path.resolve(process.cwd(), 'storage/repos')),
  BACKUPS_PATH: z.string().default(path.resolve(process.cwd(), 'storage/backups')),
  LOGS_PATH: z.string().default(path.resolve(process.cwd(), 'storage/logs')),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;

// Ensure storage directories exist
const dirs = [
  path.dirname(env.DB_PATH),
  env.REPOS_PATH,
  env.BACKUPS_PATH,
  env.LOGS_PATH,
];

dirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
