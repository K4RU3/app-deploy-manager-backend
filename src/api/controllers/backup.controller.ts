import type { FastifyReply, FastifyRequest } from 'fastify';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
import db from '../../config/db.js';
import { env } from '../../config/env.js';
import { backupService } from '../../services/backup.service.js';
import { BackupHistorySchema } from '../../models/backupHistory.js';
import { ServiceSchema, type Service } from '../../models/service.js';

export class BackupController {
  async getBackups(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const history = db.prepare('SELECT * FROM backup_history WHERE serviceId = ? ORDER BY createdAt DESC').all(id);
    return reply.send(history.map((h) => BackupHistorySchema.parse(h)));
  }

  async createBackup(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const rawService = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    if (!rawService) return reply.code(404).send({ error: 'Service not found' });
    const service = ServiceSchema.parse(rawService);

    try {
      const backup = await backupService.createBackup(id, service.volumeName);
      const historyItem = {
        id: randomUUID(),
        serviceId: id,
        file: backup.file,
        createdAt: backup.createdAt,
        size: backup.size,
      };

      db.prepare(
        'INSERT INTO backup_history (id, serviceId, file, createdAt, size) VALUES (?, ?, ?, ?, ?)'
      ).run(historyItem.id, historyItem.serviceId, historyItem.file, historyItem.createdAt, historyItem.size);

      return reply.send(historyItem);
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async restoreBackup(request: FastifyRequest<{ Params: { id: string }; Body: { file: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const { file } = request.body;
    if (!file) return reply.code(400).send({ error: 'file is required' });

    const rawService = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    if (!rawService) return reply.code(404).send({ error: 'Service not found' });
    const service = ServiceSchema.parse(rawService);

    try {
      await backupService.restoreBackup(id, service.volumeName, file);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async downloadBackup(request: FastifyRequest<{ Params: { id: string; file: string } }>, reply: FastifyReply) {
    const { id, file } = request.params;
    const filePath = path.join(env.BACKUPS_PATH, id, file);

    try {
      if (!fs.existsSync(filePath)) {
        return reply.code(404).send({ error: 'Backup file not found' });
      }

      const stream = fs.createReadStream(filePath);
      return reply.type('application/gzip').send(stream);
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }
}

export const backupController = new BackupController();
