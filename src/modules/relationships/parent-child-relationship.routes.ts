import type { FastifyPluginCallback } from 'fastify';
import { HttpStatus } from '../../shared/http/http-status.js';
import {
    CreateParentChildRelationshipDtoSchema,
    ParentChildRelationshipIdParamsSchema,
    ParentChildRelationshipResponseDtoSchema,
    ParentChildRelationshipsCollectionResponseDtoSchema,
    ParentChildRelationshipsQuerystringSchema,
    PersonParentChildRelationshipsParamsSchema,
    type CreateParentChildRelationshipDto,
    type ParentChildRelationshipIdParamsDto,
    type ParentChildRelationshipsQuerystringDto,
    type PersonParentChildRelationshipsParamsDto,
} from './parent-child-relationship.schema.js';
import type { ParentChildRelationshipService } from './parent-child-relationship.service.js';

type ParentChildRelationshipRoutesOptions = {
    parentChildRelationshipService: ParentChildRelationshipService;
};

const parentChildRelationshipRoutes: FastifyPluginCallback<ParentChildRelationshipRoutesOptions> = (
    app,
    { parentChildRelationshipService },
) => {
    app.post<{ Body: CreateParentChildRelationshipDto }>(
        '/parent-child-relationships',
        {
            schema: {
                body: CreateParentChildRelationshipDtoSchema,
                response: {
                    [HttpStatus.Created]: ParentChildRelationshipResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const relationship = await parentChildRelationshipService.create(request.body);

            return reply.code(HttpStatus.Created).send(relationship);
        },
    );

    app.get<{ Params: ParentChildRelationshipIdParamsDto }>(
        '/parent-child-relationships/:id',
        {
            schema: {
                params: ParentChildRelationshipIdParamsSchema,
                response: {
                    [HttpStatus.Ok]: ParentChildRelationshipResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const relationship = await parentChildRelationshipService.findById(request.params.id);

            return reply.code(HttpStatus.Ok).send(relationship);
        },
    );

    app.get<{
        Params: PersonParentChildRelationshipsParamsDto;
        Querystring: ParentChildRelationshipsQuerystringDto;
    }>(
        '/people/:id/parent-child-relationships',
        {
            schema: {
                params: PersonParentChildRelationshipsParamsSchema,
                querystring: ParentChildRelationshipsQuerystringSchema,
                response: {
                    [HttpStatus.Ok]: ParentChildRelationshipsCollectionResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const relationships = await parentChildRelationshipService.findByPersonId(
                request.params.id,
                request.query.limit,
                request.query.page,
            );

            return reply.code(HttpStatus.Ok).send(relationships);
        },
    );
};

export default parentChildRelationshipRoutes;
