import type { FastifyPluginAsync } from 'fastify';
import personRoutes from './person.routes.js';
import { PersonRepository } from './person.repository.js';
import { PersonService } from './person.service.js';

const peopleModule: FastifyPluginAsync = async (app) => {
    const personRepository = new PersonRepository(app.pg.pool);
    const personService = new PersonService(personRepository);

    await app.register(personRoutes, {
        prefix: '/people',
        personService,
    });
};

export default peopleModule;
