import type { FastifyPluginCallback } from 'fastify';
import { HttpStatus } from '../../shared/http/http-status.js';
import type { PersonService } from './person.service.js';
import {
    CreatePersonDtoSchema,
    PersonIdParamsSchema,
    PersonResponseDtoSchema,
    type CreatePersonDto,
    type PersonIdParamsDto,
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
};

export default personRoutes;
