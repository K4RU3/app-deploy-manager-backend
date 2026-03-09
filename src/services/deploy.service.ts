import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'node:crypto';
import { gitService } from './git.service.js';
import { dockerService } from './docker.service.js';
import { backupService } from './backup.service.js';
import { env } from '../config/env.js';
import db from '../config/db.js';
import { Service } from '../models/service.js';

export class DeployService {
  async deploy(serviceId: string, options: { mode: 'branch' | 'commit'; value: string }) {
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId) as Service;
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    const repoDir = path.join(env.REPOS_PATH, service.id);
    const logLines: string[] = [];

    const log = (message: string) => {
      const timestamp = new Date().toISOString();
      const line = `[${timestamp}] ${message}`;
      logLines.push(line);
      console.log(`[Deploy ${service.name}] ${line}`);
    };

    let result: 'success' | 'failure' = 'success';
    let commitHash = '';

    try {
      // 1. Optional volume backup
      if (service.autoBackup) {
        log('Starting auto-backup...');
        const backup = await backupService.createBackup(service.id, service.volumeName);
        db.prepare(
          'INSERT INTO backup_history (id, serviceId, file, createdAt, size) VALUES (?, ?, ?, ?, ?)'
        ).run(randomUUID(), service.id, backup.file, backup.createdAt, backup.size);
        log(`Backup created: ${backup.file} (${backup.size} bytes)`);
      }

      // 2. Git fetch
      log('Fetching updates from git...');
      await gitService.fetch(repoDir);

      // 3. Checkout branch or commit
      log(`Checking out ${options.mode}: ${options.value}...`);
      await gitService.checkout(repoDir, options.value);

      // Get current commit hash for history
      const logs = await gitService.getLogs(repoDir, 1);
      commitHash = logs[0]?.hash || 'unknown';

      // 4. Docker build
      log('Building docker image...');
      const imageName = `svc-${service.id}`;
      await dockerService.buildImage(repoDir, imageName);

      // 5. Container restart
      log('Restarting container...');
      await dockerService.createAndStartContainer({
        serviceId: service.id,
        imageName: imageName,
        port: service.containerPort,
        volume: service.volumeName,
      });

      // 6. Health check
      log('Performing health check...');
      const healthy = await dockerService.isHealthy(`svc-${service.id}`);
      if (!healthy) {
        throw new Error('Container is not healthy after deployment');
      }
      log('Deployment successful and container is healthy');

    } catch (error: any) {
      result = 'failure';
      log(`Deployment failed: ${error.message}`);
      if (error.stack) {
        log(error.stack);
      }
    } finally {
      // 7. Log deploy result
      db.prepare(
        'INSERT INTO deploy_history (id, serviceId, commitHash, timestamp, result, logs) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        randomUUID(),
        service.id,
        commitHash,
        new Date().toISOString(),
        result,
        logLines.join('\n')
      );

      // Update service with selected commit if it was a success and mode was commit?
      // Or just keep the last successful commit.
      // The spec says Service has selectedCommit.
      if (result === 'success') {
        db.prepare('UPDATE services SET selectedCommit = ?, deployMode = ?, branch = ? WHERE id = ?').run(
          commitHash,
          options.mode,
          options.mode === 'branch' ? options.value : service.branch,
          service.id
        );
      }
    }

    return { result, logs: logLines };
  }
}

export const deployService = new DeployService();
