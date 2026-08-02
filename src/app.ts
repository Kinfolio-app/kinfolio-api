import Fastify, { type FastifyPluginAsync } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import dbConnector, { type DatabasePluginOptions } from './plugins/database.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import healthRoutes from './modules/health/health.routes.js';
import peopleModule from './modules/people/person.module.js';
import relationshipModule from './modules/relationships/relationship.module.js';
import type { AppConfig } from './config/env.js';
import familyTreeModule from './modules/family-tree/family-tree.module.js';
import gedcomImportModule from './modules/gedcom-import/gedcom-import.module.js';

type BuildAppOptions = {
    config: AppConfig;
    databasePlugin?: FastifyPluginAsync<DatabasePluginOptions>;
    familyTreePlugin?: FastifyPluginAsync;
    gedcomImportPlugin?: FastifyPluginAsync;
    peoplePlugin?: FastifyPluginAsync;
    relationshipPlugin?: FastifyPluginAsync;
};

const FILE_SIZE = 10 * 1024 * 1024;

export function buildApp({
    config,
    databasePlugin = dbConnector,
    familyTreePlugin = familyTreeModule,
    gedcomImportPlugin = gedcomImportModule,
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

    app.register(fastifyMultipart, {
        attachFieldsToBody: 'keyValues',
        limits: {
            files: 1,
            fields: 0,
            parts: 1,
            fileSize: FILE_SIZE,
        },
    });
    app.register(databasePlugin, {
        databaseUrl: config.databaseUrl,
    });
    app.register(errorHandlerPlugin);
    app.register(healthRoutes);
    app.register(familyTreePlugin);
    app.register(gedcomImportPlugin);
    app.register(peoplePlugin);
    app.register(relationshipPlugin);

    return app;
}
