import fastifyPlugin from 'fastify-plugin';
import type { FastifyPluginCallback } from 'fastify';
import fastifyPostgres from '@fastify/postgres';

const dbConnector: FastifyPluginCallback = (fastify, options, done) => {
    void options;

    fastify.register(fastifyPostgres, {
        connectionString: process.env.DATABASE_URL,
    });

    done();
};

export default fastifyPlugin(dbConnector);
