import type { FastifyInstance } from 'fastify';
import { serviceController } from '../controllers/service.controller.js';
import { deployController } from '../controllers/deploy.controller.js';
import { gitController } from '../controllers/git.controller.js';
import { backupController } from '../controllers/backup.controller.js';
import { systemController } from '../controllers/system.controller.js';

export default async function (fastify: FastifyInstance) {
  // Services
  fastify.get('/services', serviceController.getAllServices);
  fastify.get('/services/:id', serviceController.getServiceById);
  fastify.post('/services', serviceController.createService);
  fastify.delete('/services/:id', serviceController.deleteService);
  fastify.patch('/services/:id', serviceController.patchService);
  fastify.post('/services/:id/enable', serviceController.enableService);
  fastify.post('/services/:id/disable', serviceController.disableService);

  // Deployment
  fastify.post('/services/:id/deploy/latest', deployController.deployLatest);
  fastify.post('/services/:id/deploy/commit', deployController.deployCommit);
  fastify.get('/services/:id/deploy/history', deployController.getDeployHistory);

  // Git
  fastify.get('/services/:id/commits', gitController.getCommits);

  // Backup
  fastify.get('/services/:id/backups', backupController.getBackups);
  fastify.post('/services/:id/backup', backupController.createBackup);
  fastify.post('/services/:id/restore', backupController.restoreBackup);
  fastify.get('/services/:id/backups/:file', backupController.downloadBackup);

  // System
  fastify.get('/system/stats', systemController.getStats);
  fastify.get('/system/events', systemController.getEvents);
}
