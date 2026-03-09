import Fastify from 'fastify';
import cors from '@fastify/cors';
import routes from './api/routes/index.js';

const fastify = Fastify({
  logger: true,
});

// Register Middleware
fastify.register(cors, {
  origin: '*', // Adjust as needed for security
});

// Register Routes
fastify.register(routes);

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
