import { describe, expect, it } from 'vitest';
import createPerson, {
    InvalidPersonError,
    updatePerson,
} from '../../../../src/modules/people/person.entity.js';
import { LivingStatus, type Person } from '../../../../src/modules/people/person.types.js';

const person: Person = {
    id: '4cf44241-0f1b-4e69-b070-d47ee66b7203',
    firstName: 'Alice',
    middleNames: null,
    lastName: null,
    birthName: null,
    birthDate: '1980-01-01',
    birthPlace: null,
    deathDate: null,
    deathPlace: null,
    livingStatus: LivingStatus.Living,
    biography: 'Biography',
    createdAt: new Date('2026-07-29T10:00:00.000Z'),
    updatedAt: new Date('2026-07-29T10:00:00.000Z'),
};

describe('createPerson', () => {
    it('normalizes selected textual properties without mutating the input', () => {
        const input = {
            firstName: ' Alice ',
            middleNames: ' Louise ',
            lastName: ' Martin ',
            birthName: ' Durand ',
            birthDate: '1985-03-12',
            birthPlace: ' Lyon ',
            deathDate: '2025-06-18',
            deathPlace: ' Paris ',
            livingStatus: LivingStatus.Deceased,
            biography: ' Test biography. ',
        };

        const person = createPerson(input);

        expect(person).toEqual({
            firstName: 'Alice',
            middleNames: 'Louise',
            lastName: 'Martin',
            birthName: 'Durand',
            birthDate: '1985-03-12',
            birthPlace: 'Lyon',
            deathDate: '2025-06-18',
            deathPlace: 'Paris',
            livingStatus: LivingStatus.Deceased,
            biography: 'Test biography.',
        });
        expect(input.firstName).toBe(' Alice ');
        expect(input.biography).toBe(' Test biography. ');
    });

    it('accepts a birth name as the only identifying name', () => {
        const person = createPerson({
            birthName: ' Durand ',
        });

        expect(person).toEqual({
            birthName: 'Durand',
        });
    });

    it('rejects a person without an identifying name', () => {
        expect(() =>
            createPerson({
                middleNames: 'Louise',
            }),
        ).toThrow(new InvalidPersonError('At least one name is required.'));
    });

    it('rejects a death date earlier than the birth date', () => {
        expect(() =>
            createPerson({
                firstName: 'Alice',
                birthDate: '2000-01-01',
                deathDate: '1990-01-01',
            }),
        ).toThrow(new InvalidPersonError('Death date must not be earlier than birth date.'));
    });
});

describe('updatePerson', () => {
    it('merges and normalizes updated properties without mutating the person', () => {
        const updatedPerson = updatePerson(person, {
            firstName: ' Alicia ',
            biography: null,
        });

        expect(updatedPerson).toEqual({
            ...person,
            firstName: 'Alicia',
            biography: null,
        });
        expect(person.firstName).toBe('Alice');
        expect(person.biography).toBe('Biography');
    });

    it('rejects removing the last identifying name', () => {
        expect(() =>
            updatePerson(person, {
                firstName: null,
            }),
        ).toThrow(new InvalidPersonError('At least one name is required.'));
    });

    it('rejects a death date earlier than the existing birth date', () => {
        expect(() =>
            updatePerson(person, {
                deathDate: '1970-01-01',
            }),
        ).toThrow(new InvalidPersonError('Death date must not be earlier than birth date.'));
    });
});
