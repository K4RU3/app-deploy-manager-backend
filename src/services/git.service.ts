import { execa } from 'execa';
import fs from 'fs/promises';
import path from 'path';

export interface GitLog {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

export class GitService {
  async clone(repoUrl: string, targetDir: string) {
    await fs.mkdir(path.dirname(targetDir), { recursive: true });
    await execa('git', ['clone', repoUrl, targetDir]);
  }

  async fetch(repoDir: string) {
    await execa('git', ['fetch', '--all'], { cwd: repoDir });
  }

  async checkout(repoDir: string, ref: string) {
    await execa('git', ['checkout', ref], { cwd: repoDir });
  }

  async getLogs(repoDir: string, limit: number = 20, ref?: string): Promise<GitLog[]> {
    const args = [
      "log",
      `-${limit}`,
      "--pretty=format:%H%x09%h%x09%an%x09%ad%x09%s",
      "--date=short",
    ];
    if (ref) {
      args.push(ref);
    }

    const { stdout } = await execa("git", args, { cwd: repoDir });

    if (!stdout) return [];

    return stdout.split('\n').map((line) => {
      const [hash = '', shortHash = '', author = '', date = '', message = ''] = line.split('\t');
      return { hash, shortHash, author, date, message };
    });
  }
}

export const gitService = new GitService();
