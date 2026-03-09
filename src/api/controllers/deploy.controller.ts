import type { FastifyReply, FastifyRequest } from 'fastify';
import db from '../../config/db.js';
import { deployService } from '../../services/deploy.service.js';
import { DeployHistorySchema } from '../../models/deployHistory.js';
import type { Service } from '../../models/service.js';

export class DeployController {
  async deployLatest(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as Service;
    if (!service) return reply.code(404).send({ error: 'Service not found' });

    // Deploy latest on the current branch
    const result = await deployService.deploy(id, {
      mode: 'branch',
      value: service.branch,
    });

    return reply.send(result);
  }

  async deployCommit(request: FastifyRequest<{ Params: { id: string }; Body: { commitHash: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const { commitHash } = request.body;
    if (!commitHash) return reply.code(400).send({ error: 'commitHash is required' });

    const result = await deployService.deploy(id, {
      mode: 'commit',
      value: commitHash,
    });

    return reply.send(result);
  }

  async getDeployHistory(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const history = db.prepare('SELECT * FROM deploy_history WHERE serviceId = ? ORDER BY timestamp DESC').all();
    return reply.send(history.map((h) => DeployHistorySchema.parse(h)));
  }
}

export const deployController = new DeployController();
