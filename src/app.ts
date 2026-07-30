import Fastify, { type FastifyPluginAsync } from 'fastify';
import dbConnector, { type DatabasePluginOptions } from './plugins/database.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import healthRoutes from './modules/health/health.routes.js';
import peopleModule from './modules/people/person.module.js';
import relationshipModule from './modules/relationships/relationship.module.js';
import type { AppConfig } from './config/env.js';
import familyTreeModule from './modules/family-tree/family-tree.module.js';

type BuildAppOptions = {
    config: AppConfig;
    databasePlugin?: FastifyPluginAsync<DatabasePluginOptions>;
    familyTreePlugin?: FastifyPluginAsync;
    peoplePlugin?: FastifyPluginAsync;
    relationshipPlugin?: FastifyPluginAsync;
};

export function buildApp({
    config,
    databasePlugin = dbConnector,
    familyTreePlugin = familyTreeModule,
    peoplePlugin = peopleModule,
    relationshipPlugin = relationshipModule,
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
    app.register(familyTreePlugin);
    app.register(peoplePlugin);
    app.register(relationshipPlugin);

    return app;
}
