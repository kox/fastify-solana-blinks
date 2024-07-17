import fastify from 'fastify';
import pino from 'pino';
import daoRouter from './routes/dao.router';
import donateRouter from './routes/donate.router';
import path from 'node:path';
import fs from 'fs';

/* import userRouter from './routes/user.router';
import postRouter from './routes/post.router';*/
import loadConfig from './config/env.config'; 
/* import { utils } from './utils';
import formbody from '@fastify/formbody'; */
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

loadConfig();

const port = Number(process.env.API_PORT) || 5001;
const host = String(process.env.API_HOST);

const startServer = async () => {
  const server = fastify({
    logger: pino({ level: process.env.LOG_LEVEL }),
  });

  // Register middlewares
  /* server.register(formbody); */
  /* await server.register(cors); */

  await server.register(require('@fastify/cors'), {
    origin: '*', // false,
    methods: 'GET,HEAD,POST',
    allowedHeaders:
      'Content-Type, Accept, Access-Control-Allow-Origin, Access-Control-Allow-Methods',
    credentials: true,
  });
  server.register(helmet, {
    crossOriginResourcePolicy: false,
  });

  
  server.register(require('@fastify/static'), {
    root: path.join(__dirname, '../public'),
    prefix: '/public/', // optional: default '/'
    constraints: { host: 'localhost:5000' }
    //constraints: {},
    // constraints: { host: 'example.com' }  optional: default {}
  })
  

  // Register routes
  server.register(daoRouter, { prefix: '/api/actions/dao' })
  server.register(donateRouter, { prefix: '/api/actions/donate' })

  // Set error handler
  server.setErrorHandler((error, _request, reply) => {
    server.log.error(error);
    reply.status(500).send({ error: 'Something went wrong' });
  });

  // Route to serve actions.json
  server.get('/actions.json', async (_request, reply) => {
    try {
      const data = fs.readFileSync(path.join(__dirname, '../actions_json/actions.json'), 'utf-8');
      reply.header('Content-Type', 'application/json').send(data);
    } catch (err) {
      server.log.error(err);
      reply.status(500).send({ error: 'Failed to read actions.json' });
    }
  });


  // Health check route
  server.get('/health', async (_request, reply) => {
    try {
      // await utils.healthCheck();
      reply.status(200).send({
        message: 'Health check endpoint success.',
      });
    } catch (e) {
      reply.status(500).send({
        message: 'Health check endpoint failed.',
      });
    }
  });

  // Root route
  server.get('/', (request, reply) => {
    reply.status(200).send({ message: 'Hello from fastify boilerplate!' });
  });

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      try {
        await server.close();
        server.log.error(`Closed application on ${signal}`);
        process.exit(0);
      } catch (err) {
        server.log.error(`Error closing application on ${signal}`, err);
        process.exit(1);
      }
    });
  });

  // Start server
  try {
    await server.listen({
      port,
      host,
    });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

startServer();