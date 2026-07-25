import type { FastifyPluginCallback } from 'fastify';
import type { PersonService } from './person.service.js';
import type { CreatePersonInput } from './person.types.js';
import { HttpStatus } from '../../shared/http/http-status.js';

type PersonRoutesOptions = {
    personService: PersonService;
};

const personRoutes: FastifyPluginCallback<PersonRoutesOptions> = (app, { personService }) => {
    app.post<{ Body: CreatePersonInput }>('/', async (request, reply) => {
        const person = await personService.create(request.body);

        return reply.code(HttpStatus.Created).send(person);
    });

    app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
        const person = await personService.findById(request.params.id);

        return reply.code(HttpStatus.Ok).send(person);
    });
};

export default personRoutes;
