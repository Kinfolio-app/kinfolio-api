import type { FastifyPluginCallback } from 'fastify';
import { HttpStatus } from '../../shared/http/http-status.js';
import type { PersonService } from './person.service.js';
import {
    CreatePersonDtoSchema,
    PeopleCollectionResponseDtoSchema,
    PeopleQuerystringSchema,
    PersonIdParamsSchema,
    PersonResponseDtoSchema,
    UpdatePersonDtoSchema,
    type CreatePersonDto,
    type PeopleQuerystringDto,
    type PersonIdParamsDto,
    type UpdatePersonDto,
} from './person.schema.js';

type PersonRoutesOptions = {
    personService: PersonService;
};

const personRoutes: FastifyPluginCallback<PersonRoutesOptions> = (app, { personService }) => {
    app.post<{ Body: CreatePersonDto }>(
        '/',
        {
            schema: {
                body: CreatePersonDtoSchema,
                response: {
                    [HttpStatus.Created]: PersonResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const person = await personService.create(request.body);

            return reply.code(HttpStatus.Created).send(person);
        },
    );

    app.get<{ Params: PersonIdParamsDto }>(
        '/:id',
        {
            schema: {
                params: PersonIdParamsSchema,
                response: {
                    [HttpStatus.Ok]: PersonResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const person = await personService.findById(request.params.id);

            return reply.code(HttpStatus.Ok).send(person);
        },
    );

    app.get<{ Querystring: PeopleQuerystringDto }>(
        '/',
        {
            schema: {
                querystring: PeopleQuerystringSchema,
                response: {
                    [HttpStatus.Ok]: PeopleCollectionResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const people = await personService.findBy(
                request.query.limit,
                request.query.page,
                request.query.sort,
            );

            return reply.code(HttpStatus.Ok).send(people);
        },
    );

    app.patch<{ Params: PersonIdParamsDto; Body: UpdatePersonDto }>(
        '/:id',
        {
            schema: {
                params: PersonIdParamsSchema,
                body: UpdatePersonDtoSchema,
                response: { [HttpStatus.Ok]: PersonResponseDtoSchema },
            },
        },
        async (request, reply) => {
            const person = await personService.update(request.params.id, request.body);

            return reply.code(HttpStatus.Ok).send(person);
        },
    );

};

export default personRoutes;
