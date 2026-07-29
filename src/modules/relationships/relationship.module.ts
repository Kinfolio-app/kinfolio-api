import type { FastifyPluginAsync } from 'fastify';
import { ParentChildRelationshipRepository } from './parent-child-relationship.repository.js';
import parentChildRelationshipRoutes from './parent-child-relationship.routes.js';
import { ParentChildRelationshipService } from './parent-child-relationship.service.js';

const relationshipModule: FastifyPluginAsync = async (app) => {
    const parentChildRelationshipRepository = new ParentChildRelationshipRepository(app.pg.pool);
    const parentChildRelationshipService = new ParentChildRelationshipService(
        parentChildRelationshipRepository,
    );

    await app.register(parentChildRelationshipRoutes, {
        parentChildRelationshipService,
    });
};

export default relationshipModule;
