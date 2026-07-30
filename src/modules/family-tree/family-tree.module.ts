import type { FastifyPluginAsync } from 'fastify';
import { FamilyTreeRepository } from './family-tree.repository.js';
import familyTreeRoutes from './family-tree.routes.js';
import { FamilyTreeService } from './family-tree.service.js';

const familyTreeModule: FastifyPluginAsync = async (app) => {
    const familyTreeRepository = new FamilyTreeRepository(app.pg.pool);
    const familyTreeService = new FamilyTreeService(familyTreeRepository);

    await app.register(familyTreeRoutes, {
        familyTreeService,
    });
};

export default familyTreeModule;
