import Fastify, { type FastifyPluginAsync } from 'fastify';
import dbConnector, { type DatabasePluginOptions } from './plugins/database.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import healthRoutes from './modules/health/health.routes.js';
import peopleModule from './modules/people/person.module.js';
import type { AppConfig } from './config/env.js';

type BuildAppOptions = {
    config: AppConfig;
    databasePlugin?: FastifyPluginAsync<DatabasePluginOptions>;
    peoplePlugin?: FastifyPluginAsync;
};

export function buildApp({
    config,
    databasePlugin = dbConnector,
    peoplePlugin = peopleModule,
}: BuildAppOptions) {
    const app = Fastify({
        logger: true,
        ajv: {
            customOptions: {
                removeAdditional: false,
            },
        },
    });

    app.register(databasePlugin, {
        databaseUrl: config.databaseUrl,
    });
    app.register(errorHandlerPlugin);
    app.register(healthRoutes);
    app.register(peoplePlugin);

    return app;
}
