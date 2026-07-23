import fastifyPlugin from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import fastifyPostgres from '@fastify/postgres';

export type DatabasePluginOptions = {
    databaseUrl: string;
};

const dbConnector: FastifyPluginAsync<DatabasePluginOptions> = async (fastify, options) => {
    await fastify.register(fastifyPostgres, {
        connectionString: options.databaseUrl,
        connectionTimeoutMillis: 5_000,
    });

    await fastify.pg.query('SELECT 1');

    fastify.log.info('PostgreSQL connection established');
};

export default fastifyPlugin(dbConnector);
