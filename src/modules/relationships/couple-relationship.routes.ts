import type { FastifyPluginCallback } from 'fastify';
import { HttpStatus } from '../../shared/http/http-status.js';
import {
    CoupleRelationshipIdParamsSchema,
    CoupleRelationshipResponseDtoSchema,
    CoupleRelationshipsCollectionResponseDtoSchema,
    CoupleRelationshipsQuerystringSchema,
    CreateCoupleRelationshipDtoSchema,
    PersonCoupleRelationshipsParamsSchema,
    type CoupleRelationshipIdParamsDto,
    type CoupleRelationshipsQuerystringDto,
    type CreateCoupleRelationshipDto,
    type PersonCoupleRelationshipsParamsDto,
} from './couple-relationship.schema.js';
import type { CoupleRelationshipService } from './couple-relationship.service.js';

type CoupleRelationshipRoutesOptions = {
    coupleRelationshipService: CoupleRelationshipService;
};

const coupleRelationshipRoutes: FastifyPluginCallback<CoupleRelationshipRoutesOptions> = (
    app,
    { coupleRelationshipService },
) => {
    app.post<{ Body: CreateCoupleRelationshipDto }>(
        '/couple-relationships',
        {
            schema: {
                body: CreateCoupleRelationshipDtoSchema,
                response: {
                    [HttpStatus.Created]: CoupleRelationshipResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const relationship = await coupleRelationshipService.create(request.body);

            return reply.code(HttpStatus.Created).send(relationship);
        },
    );

    app.get<{ Params: CoupleRelationshipIdParamsDto }>(
        '/couple-relationships/:id',
        {
            schema: {
                params: CoupleRelationshipIdParamsSchema,
                response: {
                    [HttpStatus.Ok]: CoupleRelationshipResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const relationship = await coupleRelationshipService.findById(request.params.id);

            return reply.code(HttpStatus.Ok).send(relationship);
        },
    );

    app.get<{
        Params: PersonCoupleRelationshipsParamsDto;
        Querystring: CoupleRelationshipsQuerystringDto;
    }>(
        '/people/:id/couple-relationships',
        {
            schema: {
                params: PersonCoupleRelationshipsParamsSchema,
                querystring: CoupleRelationshipsQuerystringSchema,
                response: {
                    [HttpStatus.Ok]: CoupleRelationshipsCollectionResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const relationships = await coupleRelationshipService.findByPersonId(
                request.params.id,
                request.query.limit,
                request.query.page,
            );

            return reply.code(HttpStatus.Ok).send(relationships);
        },
    );
};

export default coupleRelationshipRoutes;
