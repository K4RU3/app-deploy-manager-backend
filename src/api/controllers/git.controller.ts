import type { FastifyReply, FastifyRequest } from 'fastify';
import path from 'path';
import db from '../../config/db.js';
import { env } from '../../config/env.js';
import { gitService } from '../../services/git.service.js';
import { ServiceSchema, type Service } from '../../models/service.js';

export class GitController {
  async getCommits(request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const limit = parseInt(request.query.limit || '20', 10);

    const rawService = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    if (!rawService) return reply.code(404).send({ error: 'Service not found' });
    const service = ServiceSchema.parse(rawService);

    const repoDir = path.join(env.REPOS_PATH, id);
    
    try {
      // Refresh logs by fetching first
      await gitService.fetch(repoDir);
      const commits = await gitService.getLogs(repoDir, limit);
      return reply.send(commits);
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }
}

export const gitController = new GitController();
