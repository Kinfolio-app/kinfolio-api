import type { FastifyPluginAsync } from 'fastify';
import { CoupleRelationshipEventRepository } from './couple-relationship-event.repository.js';
import coupleRelationshipEventRoutes from './couple-relationship-event.routes.js';
import { CoupleRelationshipEventService } from './couple-relationship-event.service.js';
import { CoupleRelationshipRepository } from './couple-relationship.repository.js';
import coupleRelationshipRoutes from './couple-relationship.routes.js';
import { CoupleRelationshipService } from './couple-relationship.service.js';
import { ParentChildRelationshipRepository } from './parent-child-relationship.repository.js';
import parentChildRelationshipRoutes from './parent-child-relationship.routes.js';
import { ParentChildRelationshipService } from './parent-child-relationship.service.js';

const relationshipModule: FastifyPluginAsync = async (app) => {
    const coupleRelationshipEventRepository = new CoupleRelationshipEventRepository(app.pg.pool);
    const coupleRelationshipEventService = new CoupleRelationshipEventService(
        coupleRelationshipEventRepository,
    );
    const coupleRelationshipRepository = new CoupleRelationshipRepository(app.pg.pool);
    const coupleRelationshipService = new CoupleRelationshipService(coupleRelationshipRepository);
    const parentChildRelationshipRepository = new ParentChildRelationshipRepository(app.pg.pool);
    const parentChildRelationshipService = new ParentChildRelationshipService(
        parentChildRelationshipRepository,
    );

    await app.register(coupleRelationshipEventRoutes, {
        coupleRelationshipEventService,
    });
    await app.register(coupleRelationshipRoutes, {
        coupleRelationshipService,
    });
    await app.register(parentChildRelationshipRoutes, {
        parentChildRelationshipService,
    });
};

export default relationshipModule;
