import fastifyPlugin from 'fastify-plugin';
import type { FastifyPluginAsync } from "fastify";
import fastifyPostgres from '@fastify/postgres';

const dbConnector: FastifyPluginAsync = async (fastify, _options) => {
    fastify.register(fastifyPostgres, {
        connectionString: process.env.DATABASE_URL,
    });
}

export default fastifyPlugin(dbConnector);