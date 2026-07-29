import { BadRequestError, NotFoundError } from '../../shared/errors/http-error.js';
import createPerson, { InvalidPersonError } from './person.entity.js';
import type { PersonRepository } from './person.repository.js';
import type { CreatePersonDto, PersonSortDto } from './person.schema.js';
import type { Person } from './person.types.js';
import { MAX_PAGE_LIMIT, type CollectionResponse } from '../../shared/http/collection-response.js';

type PersonRepositoryContract = Pick<PersonRepository, 'create' | 'findById' | 'findBy'>;

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

    async findBy(
        limit: number,
        page: number,
        sort: PersonSortDto[],
    ): Promise<CollectionResponse<Person>> {
        const fields = new Set<string>();
        const orderBy = sort.map((value) => {
            const [field, direction] = value.split(':') as [
                'firstName' | 'birthDate',
                'ASC' | 'DESC',
            ];

            if (fields.has(field)) {
                throw new BadRequestError({
                    detail: `The "${field}" field can only be sorted once.`,
                });
            }

            fields.add(field);

            return {
                field,
                direction,
            };
        });

        const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);
        const { data, totalItems } = await this.repository.findBy(effectiveLimit, page, orderBy);

        return {
            data,
            pagination: {
                page,
                limit: effectiveLimit,
                totalItems,
                totalPages: Math.ceil(totalItems / effectiveLimit),
            },
        };
    }
}
