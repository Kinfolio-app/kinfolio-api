import { BadRequestError, NotFoundError } from '../../shared/errors/http-error.js';
import createPerson, { InvalidPersonError } from './person.entity.js';
import type { PersonRepository } from './person.repository.js';
import type { CreatePersonDto } from './person.schema.js';
import type { Person } from './person.types.js';

type PersonRepositoryContract = Pick<PersonRepository, 'create' | 'findById'>;

export class PersonService {
    constructor(private readonly repository: PersonRepositoryContract) {}

    async create(input: CreatePersonDto): Promise<Person> {
        let person: CreatePersonDto;

        try {
            person = createPerson(input);
        } catch (error) {
            if (error instanceof InvalidPersonError) {
                throw new BadRequestError({
                    detail: error.message,
                    cause: error,
                });
            }

            throw error;
        }

        return this.repository.create(person);
    }

    async findById(id: string): Promise<Person> {
        const person = await this.repository.findById(id);

        if (person === null) {
            throw new NotFoundError({
                detail: 'The requested person does not exist.',
            });
        }

        return person;
    }
}
