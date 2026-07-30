import type { FastifyPluginCallback } from 'fastify';
import { HttpStatus } from '../../shared/http/http-status.js';
import {
    FamilyTreeIdParamsSchema,
    FamilyTreeQuerystringSchema,
    FamilyTreeResponseDtoSchema,
    type FamilyTreeIdParamsDto,
    type FamilyTreeQuerystringDto,
} from './family-tree.schema.js';
import type { FamilyTreeService } from './family-tree.service.js';

type FamilyTreeRoutesOptions = {
    familyTreeService: FamilyTreeService;
};

const familyTreeRoutes: FastifyPluginCallback<FamilyTreeRoutesOptions> = (
    app,
    { familyTreeService },
) => {
    app.get<{ Params: FamilyTreeIdParamsDto; Querystring: FamilyTreeQuerystringDto }>(
        '/people/:id/family-tree',
        {
            schema: {
                params: FamilyTreeIdParamsSchema,
                querystring: FamilyTreeQuerystringSchema,
                response: {
                    [HttpStatus.Ok]: FamilyTreeResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const familyTree = await familyTreeService.findBranch(
                request.params.id,
                request.query.direction,
                request.query.depth,
            );

            return reply.code(HttpStatus.Ok).send(familyTree);
        },
    );
};

export default familyTreeRoutes;
