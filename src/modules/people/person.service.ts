import { NotFoundError } from '../../shared/errors/http-error.js';
import type { PersonRepository } from './person.repository.js';
import type { CreatePersonInput, Person } from './person.types.js';

export class PersonService {
    constructor(private readonly repository: PersonRepository) {}

    async create(input: CreatePersonInput): Promise<Person> {
        return this.repository.create(input);
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
