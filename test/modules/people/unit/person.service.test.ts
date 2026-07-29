import { describe, expect, it, vi } from 'vitest';
import { BadRequestError, NotFoundError } from '../../../../src/shared/errors/http-error.js';
import { InvalidPersonError } from '../../../../src/modules/people/person.entity.js';
import { PersonService } from '../../../../src/modules/people/person.service.js';
import { LivingStatus, type Person } from '../../../../src/modules/people/person.types.js';

describe('PersonService', () => {
    it('translates an invalid person error into a bad request error', async () => {
        const repository = {
            create: vi.fn(),
            findById: vi.fn(),
            findBy: vi.fn(),
            update: vi.fn(),
            deleteById: vi.fn(),
        };
        const service = new PersonService(repository);

        await expect(service.create({})).rejects.toEqual(
            new BadRequestError({
                detail: 'At least one name is required.',
                cause: new InvalidPersonError('At least one name is required.'),
            }),
        );
        expect(repository.create).not.toHaveBeenCalled();
    });

    it('builds pagination metadata for a collection', async () => {
        const person: Person = {
            id: '4cf44241-0f1b-4e69-b070-d47ee66b7203',
            firstName: 'Alice',
            middleNames: null,
            lastName: null,
            birthName: null,
            birthDate: null,
            birthPlace: null,
            deathDate: null,
            deathPlace: null,
            livingStatus: LivingStatus.Unknown,
            biography: null,
            createdAt: new Date('2026-07-29T10:00:00.000Z'),
            updatedAt: new Date('2026-07-29T10:00:00.000Z'),
        };
        const repository = {
            create: vi.fn(),
            findById: vi.fn(),
            findBy: vi.fn().mockResolvedValue({
                data: [person],
                totalItems: 21,
            }),
            update: vi.fn(),
            deleteById: vi.fn(),
        };
        const service = new PersonService(repository);

        const result = await service.findBy(20, 2, ['firstName:ASC']);

        expect(repository.findBy).toHaveBeenCalledWith(20, 2, [
            {
                field: 'firstName',
                direction: 'ASC',
            },
        ]);
        expect(result).toEqual({
            data: [person],
            pagination: {
                page: 2,
                limit: 20,
                totalItems: 21,
                totalPages: 2,
            },
        });
    });

    it('caps the requested page limit', async () => {
        const repository = {
            create: vi.fn(),
            findById: vi.fn(),
            findBy: vi.fn().mockResolvedValue({
                data: [],
                totalItems: 250,
            }),
            update: vi.fn(),
            deleteById: vi.fn(),
        };
        const service = new PersonService(repository);

        const result = await service.findBy(500, 1, ['birthDate:ASC']);

        expect(repository.findBy).toHaveBeenCalledWith(100, 1, [
            {
                field: 'birthDate',
                direction: 'ASC',
            },
        ]);
        expect(result.pagination).toEqual({
            page: 1,
            limit: 100,
            totalItems: 250,
            totalPages: 3,
        });
    });

    it('rejects multiple sort directions for the same field', async () => {
        const repository = {
            create: vi.fn(),
            findById: vi.fn(),
            findBy: vi.fn(),
            update: vi.fn(),
            deleteById: vi.fn(),
        };
        const service = new PersonService(repository);

        await expect(service.findBy(20, 1, ['firstName:ASC', 'firstName:DESC'])).rejects.toEqual(
            new BadRequestError({
                detail: 'The "firstName" field can only be sorted once.',
            }),
        );
        expect(repository.findBy).not.toHaveBeenCalled();
    });

    it('updates an existing person', async () => {
        const person: Person = {
            id: '4cf44241-0f1b-4e69-b070-d47ee66b7203',
            firstName: 'Alice',
            middleNames: null,
            lastName: null,
            birthName: null,
            birthDate: null,
            birthPlace: null,
            deathDate: null,
            deathPlace: null,
            livingStatus: LivingStatus.Unknown,
            biography: null,
            createdAt: new Date('2026-07-29T10:00:00.000Z'),
            updatedAt: new Date('2026-07-29T10:00:00.000Z'),
        };
        const updatedPerson = {
            ...person,
            firstName: 'Alicia',
        };
        const repository = {
            create: vi.fn(),
            findById: vi.fn().mockResolvedValue(person),
            findBy: vi.fn(),
            update: vi.fn().mockResolvedValue(updatedPerson),
            deleteById: vi.fn(),
        };
        const service = new PersonService(repository);

        const result = await service.update(person.id, {
            firstName: ' Alicia ',
        });

        expect(repository.update).toHaveBeenCalledWith(updatedPerson);
        expect(result).toEqual(updatedPerson);
    });

    it('soft deletes an existing person', async () => {
        const repository = {
            create: vi.fn(),
            findById: vi.fn(),
            findBy: vi.fn(),
            update: vi.fn(),
            deleteById: vi.fn().mockResolvedValue(true),
        };
        const service = new PersonService(repository);
        const id = '4cf44241-0f1b-4e69-b070-d47ee66b7203';

        await expect(service.delete(id)).resolves.toBeUndefined();
        expect(repository.deleteById).toHaveBeenCalledWith(id);
    });

    it('returns not found when soft deleting an unavailable person', async () => {
        const repository = {
            create: vi.fn(),
            findById: vi.fn(),
            findBy: vi.fn(),
            update: vi.fn(),
            deleteById: vi.fn().mockResolvedValue(false),
        };
        const service = new PersonService(repository);

        await expect(service.delete('4cf44241-0f1b-4e69-b070-d47ee66b7203')).rejects.toEqual(
            new NotFoundError({
                detail: 'The requested person does not exist.',
            }),
        );
    });
});
