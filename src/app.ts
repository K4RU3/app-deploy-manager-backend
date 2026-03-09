import Fastify from 'fastify';
import cors from '@fastify/cors';
import routes from './api/routes/index.js';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

// Parse command line arguments
const { values } = parseArgs({
  options: {
    config: { type: 'string', short: 'c' },
    log: { type: 'boolean' },
    'no-log': { type: 'boolean' },
    port: { type: 'string', short: 'p' },
  },
  strict: false,
});

// Load configuration from file if provided
let configFromFile: any = {};
if (values.config) {
  const configPath = path.resolve(process.cwd(), values.config as string);
  if (fs.existsSync(configPath)) {
    try {
      configFromFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (err: any) {
      console.error(`Error reading config file: ${err.message}`);
    }
  } else {
    console.error(`Config file not found: ${configPath}`);
  }
}

// Determine logger status: CLI > Config File > Default (true)
let loggerOption: any = true;
if (values['no-log']) {
  loggerOption = false;
} else if (values.log) {
  loggerOption = true;
} else if (configFromFile.logger !== undefined) {
  loggerOption = configFromFile.logger;
}

const fastify = Fastify({
  logger: loggerOption,
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
    const port = Number(values.port || configFromFile.port || 3001);
    await fastify.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
