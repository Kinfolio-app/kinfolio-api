import type { CreatePersonDto, UpdatePersonDto } from './person.schema.js';
import type { Person } from './person.types.js';

export class InvalidPersonError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidPersonError';
    }
}

const TRIMMED_PERSON_FIELDS = [
    'firstName',
    'middleNames',
    'lastName',
    'birthName',
    'birthPlace',
    'deathPlace',
    'biography',
] as const satisfies readonly (keyof CreatePersonDto)[];

function normalizePerson(person: CreatePersonDto): CreatePersonDto {
    const normalizedPerson = { ...person };

    for (const field of TRIMMED_PERSON_FIELDS) {
        const value = normalizedPerson[field];

        if (value !== undefined) {
            normalizedPerson[field] = value.trim();
        }
    }

    return normalizedPerson;
}

export default function createPerson(input: CreatePersonDto): CreatePersonDto {
    const person = normalizePerson(input);

    if (
        ![person.firstName, person.lastName, person.birthName].some(
            (name) => name !== undefined && name.trim().length > 0,
        )
    ) {
        throw new InvalidPersonError('At least one name is required.');
    }

    if (
        person.birthDate !== undefined &&
        person.deathDate !== undefined &&
        person.birthDate > person.deathDate
    ) {
        throw new InvalidPersonError('Death date must not be earlier than birth date.');
    }

    return person;
}

const TRIMMED_UPDATE_PERSON_FIELDS = [
    'firstName',
    'middleNames',
    'lastName',
    'birthName',
    'birthPlace',
    'deathPlace',
    'biography',
] as const satisfies readonly (keyof UpdatePersonDto)[];

function normalizePersonUpdate(input: UpdatePersonDto): UpdatePersonDto {
    const normalizedInput = { ...input };

    for (const field of TRIMMED_UPDATE_PERSON_FIELDS) {
        const value = normalizedInput[field];

        if (typeof value === 'string') {
            normalizedInput[field] = value.trim();
        }
    }

    return normalizedInput;
}

export function updatePerson(person: Person, input: UpdatePersonDto): Person {
    const updatedPerson = {
        ...person,
        ...normalizePersonUpdate(input),
    };

    if (
        ![updatedPerson.firstName, updatedPerson.lastName, updatedPerson.birthName].some(
            (name) => name !== null && name.trim().length > 0,
        )
    ) {
        throw new InvalidPersonError('At least one name is required.');
    }

    if (
        updatedPerson.birthDate !== null &&
        updatedPerson.deathDate !== null &&
        updatedPerson.birthDate > updatedPerson.deathDate
    ) {
        throw new InvalidPersonError('Death date must not be earlier than birth date.');
    }

    return updatedPerson;
}
