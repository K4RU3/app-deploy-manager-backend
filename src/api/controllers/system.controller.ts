import type { FastifyReply, FastifyRequest } from 'fastify';
import { systemService } from '../../services/system.service.js';
import { SystemStatsSchema, SystemEventSchema } from '../../models/system.js';

export class SystemController {
  async getStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const stats = await systemService.getStats();
      return reply.send(SystemStatsSchema.parse(stats));
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async getEvents(request: FastifyRequest, reply: FastifyReply) {
    try {
      const events = await systemService.getEvents();
      return reply.send(events.map((e) => SystemEventSchema.parse(e)));
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }
}

export const systemController = new SystemController();
