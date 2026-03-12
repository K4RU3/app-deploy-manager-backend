import type { FastifyReply, FastifyRequest } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'node:crypto';
import db from '../../config/db.js';
import { env } from '../../config/env.js';
import { gitService } from '../../services/git.service.js';
import { dockerService } from '../../services/docker.service.js';
import { nginxService } from '../../services/nginx.service.js';
import { certificateService } from '../../services/certificate.service.js';
import { ServiceSchema, type Service } from '../../models/service.js';

export class ServiceController {
  async getAllServices(request: FastifyRequest, reply: FastifyReply) {
    const rawServices = db.prepare('SELECT * FROM services').all() as any[];
    const services = await Promise.all(
      rawServices.map(async (s) => {
        const service = ServiceSchema.parse(s);
        service.status = await dockerService.getContainerStatus(service.containerName);
        return service;
      })
    );
    return reply.send(services);
  }

  async createService(request: FastifyRequest<{ Body: { repositoryUrl: string; branch?: string } }>, reply: FastifyReply) {
    const { repositoryUrl, branch = 'main' } = request.body;
    const id = randomUUID();
    const repoDir = path.join(env.REPOS_PATH, id);

    try {
      // 1. clone repository
      await gitService.clone(repositoryUrl, repoDir);

      // 2. read app-service.json
      const configPath = path.join(repoDir, 'app-service.json');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // 3. validate configuration (basic validation for now)
      if (!config.name || !config.domain) {
        throw new Error('Invalid app-service.json: missing required fields');
      }

      const service = ServiceSchema.parse({
        id,
        name: config.name,
        domain: config.domain,
        repositoryUrl,
        branch,
        deployMode: 'branch',
        selectedCommit: null,
        containerName: `svc-${id}`,
        port: config.port,
        volumeName: config.volume || `${config.name}_data`,
        autoBackup: config.autoBackup ?? true,
        enabled: true,
      });

      // 4. register service
      db.prepare(`
        INSERT INTO services (id, name, domain, repositoryUrl, branch, deployMode, containerName, port, volumeName, autoBackup, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        service.id,
        service.name,
        service.domain,
        service.repositoryUrl,
        service.branch,
        service.deployMode,
        service.containerName,
        service.port ? JSON.stringify(service.port) : null,
        service.volumeName,
        service.autoBackup ? 1 : 0,
        service.enabled ? 1 : 0
      );

      // 5. create docker container (we'll build it first too)
      await dockerService.buildImage(repoDir, `svc-${id}`);
      await dockerService.createAndStartContainer({
        serviceId: id,
        imageName: `svc-${id}`,
        volume: service.volumeName,
        port: service.port || undefined,
      });

      // 6. generate nginx config
      if (service.port) {
        await nginxService.generateConfig(service.domain, service.port.host);
      }

      // 7. issue TLS certificate
      try {
        await certificateService.issueCertificate(service.domain);
      } catch (err) {
        console.error('Certificate issuance failed, but proceeding...', err);
        // We might not want to fail the whole thing if certbot fails (e.g. DNS not ready)
      }

      // 8. enable service
      await nginxService.enableService(service.domain);

      const responseService = ServiceSchema.parse(service);
      responseService.status = await dockerService.getContainerStatus(service.containerName);
      return reply.code(201).send(responseService);
    } catch (error: any) {
      // Cleanup on failure
      await fs.rm(repoDir, { recursive: true, force: true });
      return reply.code(400).send({ error: error.message });
    }
  }

  async deleteService(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const rawService = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    if (!rawService) {
      return reply.code(404).send({ error: 'Service not found' });
    }
    const service = ServiceSchema.parse(rawService);

    try {
      // Disable in nginx
      await nginxService.disableService(service.domain);

      // Stop and remove docker container
      await dockerService.stopAndRemoveContainer(service.containerName);

      // Remove docker image (the image name is the same as the container name)
      await dockerService.removeImage(service.containerName);

      // Remove repository
      const repoDir = path.join(env.REPOS_PATH, id);
      await fs.rm(repoDir, { recursive: true, force: true });

      // Remove from DB (CASCADE will handle history)
      db.prepare('DELETE FROM services WHERE id = ?').run(id);

      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async patchService(request: FastifyRequest<{ Params: { id: string }; Body: Partial<Service> }>, reply: FastifyReply) {
    const { id } = request.params;
    const updates = request.body;

    const rawService = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    if (!rawService) {
      return reply.code(404).send({ error: 'Service not found' });
    }
    const service = ServiceSchema.parse(rawService);

    // Filter out fields that shouldn't be updated directly via patch or need special handling
    const allowedUpdates = ['name', 'branch', 'deployMode', 'autoBackup', 'port'];
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedUpdates.includes(key))
    );

    if (Object.keys(filteredUpdates).length === 0) {
      return reply.code(400).send({ error: 'No valid fields to update' });
    }

    const setClause = Object.keys(filteredUpdates)
      .map((key) => `${key} = ?`)
      .join(', ');
    const values = Object.values(filteredUpdates).map((v) => {
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'object' && v !== null) return JSON.stringify(v);
      return v;
    });

    db.prepare(`UPDATE services SET ${setClause} WHERE id = ?`).run(...values, id);

    const updatedRawService = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    const updatedService = ServiceSchema.parse(updatedRawService);
    updatedService.status = await dockerService.getContainerStatus(updatedService.containerName);
    return reply.send(updatedService);
  }

  async enableService(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const rawService = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    if (!rawService) return reply.code(404).send({ error: 'Service not found' });
    const service = ServiceSchema.parse(rawService);

    await nginxService.enableService(service.domain);
    db.prepare('UPDATE services SET enabled = 1 WHERE id = ?').run(id);

    return reply.send({ success: true });
  }

  async disableService(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const rawService = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    if (!rawService) return reply.code(404).send({ error: 'Service not found' });
    const service = ServiceSchema.parse(rawService);

    await nginxService.disableService(service.domain);
    db.prepare('UPDATE services SET enabled = 0 WHERE id = ?').run(id);

    return reply.send({ success: true });
  }
}

export const serviceController = new ServiceController();
