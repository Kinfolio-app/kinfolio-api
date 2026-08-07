import type { FastifyPluginCallback } from 'fastify';
import { HttpStatus } from '../../shared/http/http-status.js';
import {
    CoupleRelationshipEventIdParamsSchema,
    CoupleRelationshipEventResponseDtoSchema,
    CoupleRelationshipEventsCollectionResponseDtoSchema,
    CoupleRelationshipEventsQuerystringSchema,
    CoupleRelationshipIdParamsSchema,
    CreateCoupleRelationshipEventDtoSchema,
    UpdateCoupleRelationshipEventDtoSchema,
    type CoupleRelationshipEventIdParamsDto,
    type CoupleRelationshipEventsQuerystringDto,
    type CoupleRelationshipIdParamsDto,
    type CreateCoupleRelationshipEventDto,
    type UpdateCoupleRelationshipEventDto,
} from './couple-relationship.schema.js';
import type { CoupleRelationshipEventService } from './couple-relationship-event.service.js';

type CoupleRelationshipEventRoutesOptions = {
    coupleRelationshipEventService: CoupleRelationshipEventService;
};

const coupleRelationshipEventRoutes: FastifyPluginCallback<CoupleRelationshipEventRoutesOptions> = (
    app,
    { coupleRelationshipEventService },
) => {
    app.post<{
        Params: CoupleRelationshipIdParamsDto;
        Body: CreateCoupleRelationshipEventDto;
    }>(
        '/couple-relationships/:id/events',
        {
            schema: {
                params: CoupleRelationshipIdParamsSchema,
                body: CreateCoupleRelationshipEventDtoSchema,
                response: {
                    [HttpStatus.Created]: CoupleRelationshipEventResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const event = await coupleRelationshipEventService.create(
                request.params.id,
                request.body,
            );

            return reply.code(HttpStatus.Created).send(event);
        },
    );

    app.get<{
        Params: CoupleRelationshipIdParamsDto;
        Querystring: CoupleRelationshipEventsQuerystringDto;
    }>(
        '/couple-relationships/:id/events',
        {
            schema: {
                params: CoupleRelationshipIdParamsSchema,
                querystring: CoupleRelationshipEventsQuerystringSchema,
                response: {
                    [HttpStatus.Ok]: CoupleRelationshipEventsCollectionResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const events = await coupleRelationshipEventService.findByRelationshipId(
                request.params.id,
                request.query.limit,
                request.query.page,
            );

            return reply.code(HttpStatus.Ok).send(events);
        },
    );

    app.get<{ Params: CoupleRelationshipEventIdParamsDto }>(
        '/couple-relationship-events/:id',
        {
            schema: {
                params: CoupleRelationshipEventIdParamsSchema,
                response: {
                    [HttpStatus.Ok]: CoupleRelationshipEventResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const event = await coupleRelationshipEventService.findById(request.params.id);

            return reply.code(HttpStatus.Ok).send(event);
        },
    );

    app.patch<{
        Params: CoupleRelationshipEventIdParamsDto;
        Body: UpdateCoupleRelationshipEventDto;
    }>(
        '/couple-relationship-events/:id',
        {
            schema: {
                params: CoupleRelationshipEventIdParamsSchema,
                body: UpdateCoupleRelationshipEventDtoSchema,
                response: {
                    [HttpStatus.Ok]: CoupleRelationshipEventResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const event = await coupleRelationshipEventService.update(
                request.params.id,
                request.body,
            );

            return reply.code(HttpStatus.Ok).send(event);
        },
    );
};

export default coupleRelationshipEventRoutes;
