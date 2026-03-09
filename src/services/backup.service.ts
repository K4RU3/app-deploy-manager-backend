import { execa } from 'execa';
import fs from 'fs/promises';
import path from 'path';

const BACKUP_ROOT = path.resolve(process.cwd(), 'storage/backups');

export class BackupService {
  async createBackup(serviceId: string, volumeName: string) {
    const backupDir = path.join(BACKUP_ROOT, serviceId);
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${timestamp}.tar.gz`;
    const filePath = path.join(backupDir, fileName);

    // Using docker run --rm with alpine to tar the volume
    // We mount the volume to /data and the backup dir to /backup
    await execa('docker', [
      'run',
      '--rm',
      '-v',
      `${volumeName}:/data`,
      '-v',
      `${backupDir}:/backup`,
      'alpine',
      'tar',
      '-czf',
      `/backup/${fileName}`,
      '-C',
      '/data',
      '.',
    ]);

    const stats = await fs.stat(filePath);

    return {
      file: fileName,
      size: stats.size,
      createdAt: new Date().toISOString(),
    };
  }

  async restoreBackup(serviceId: string, volumeName: string, backupFile: string) {
    const backupDir = path.join(BACKUP_ROOT, serviceId);
    const filePath = path.join(backupDir, backupFile);

    await fs.access(filePath);

    // Using docker run --rm with alpine to untar the volume
    // We mount the volume to /data and the backup dir to /backup
    // First we might want to clear the volume, but tar xzf normally overwrites.
    // Let's clear it first to be sure it's a clean restore.
    await execa('docker', [
      'run',
      '--rm',
      '-v',
      `${volumeName}:/data`,
      'alpine',
      'sh',
      '-c',
      'rm -rf /data/*',
    ]);

    await execa('docker', [
      'run',
      '--rm',
      '-v',
      `${volumeName}:/data`,
      '-v',
      `${backupDir}:/backup`,
      'alpine',
      'tar',
      '-xzf',
      `/backup/${backupFile}`,
      '-C',
      '/data',
    ]);
  }
}

export const backupService = new BackupService();
