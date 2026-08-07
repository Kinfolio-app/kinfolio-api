import { describe, expect, it, vi } from 'vitest';
import {
    CoupleRelationshipPersonNotFoundError,
    SelfCoupleRelationshipError,
} from '../../../../src/modules/relationships/couple-relationship.error.js';
import { CoupleRelationshipService } from '../../../../src/modules/relationships/couple-relationship.service.js';
import type { CoupleRelationship } from '../../../../src/modules/relationships/couple-relationship.types.js';
import { NotFoundError } from '../../../../src/shared/errors/http-error.js';

const partner1Id = '4cf44241-0f1b-4e69-b070-d47ee66b7203';
const partner2Id = 'ffef91f2-f131-44a8-9806-631ff2ac50d7';

const relationship: CoupleRelationship = {
    id: '65eb723e-82cf-4621-9c70-9ddfc3611b68',
    partner1Id,
    partner2Id,
    createdAt: new Date('2026-08-07T10:00:00.000Z'),
    updatedAt: new Date('2026-08-07T10:00:00.000Z'),
};

function createRepository() {
    return {
        create: vi.fn(),
        findById: vi.fn(),
        findByPersonId: vi.fn(),
    };
}

describe('CoupleRelationshipService', () => {
    it('creates a couple relationship', async () => {
        const repository = createRepository();
        repository.create.mockResolvedValue(relationship);
        const service = new CoupleRelationshipService(repository);
        const input = {
            partner1Id,
            partner2Id,
        };

        await expect(service.create(input)).resolves.toEqual(relationship);
        expect(repository.create).toHaveBeenCalledWith(input);
    });

    it.each([
        {
            name: 'an unavailable partner',
            domainError: new CoupleRelationshipPersonNotFoundError(),
            status: 404,
            detail: 'One or both partners do not exist or are deleted.',
        },
        {
            name: 'a self relationship',
            domainError: new SelfCoupleRelationshipError(),
            status: 409,
            detail: 'A person cannot be their own partner.',
        },
    ])(
        'translates $name domain error into an HTTP error',
        async ({ domainError, status, detail }) => {
            const repository = createRepository();
            repository.create.mockRejectedValue(domainError);
            const service = new CoupleRelationshipService(repository);

            await expect(
                service.create({
                    partner1Id,
                    partner2Id,
                }),
            ).rejects.toEqual(
                expect.objectContaining({
                    status,
                    detail,
                    cause: domainError,
                }),
            );
        },
    );

    it('does not translate an unexpected repository error', async () => {
        const repository = createRepository();
        const repositoryError = new Error('Unexpected repository failure.');
        repository.create.mockRejectedValue(repositoryError);
        const service = new CoupleRelationshipService(repository);

        await expect(
            service.create({
                partner1Id,
                partner2Id,
            }),
        ).rejects.toBe(repositoryError);
    });

    it('returns a couple relationship by id', async () => {
        const repository = createRepository();
        repository.findById.mockResolvedValue(relationship);
        const service = new CoupleRelationshipService(repository);

        await expect(service.findById(relationship.id)).resolves.toEqual(relationship);
    });

    it('returns not found when a couple relationship does not exist', async () => {
        const repository = createRepository();
        repository.findById.mockResolvedValue(null);
        const service = new CoupleRelationshipService(repository);

        await expect(service.findById(relationship.id)).rejects.toEqual(
            new NotFoundError({
                detail: 'The requested couple relationship does not exist.',
            }),
        );
    });

    it('builds capped pagination metadata for a person relationships', async () => {
        const repository = createRepository();
        repository.findByPersonId.mockResolvedValue({
            data: [relationship],
            totalItems: 201,
        });
        const service = new CoupleRelationshipService(repository);

        const result = await service.findByPersonId(partner1Id, 500, 2);

        expect(repository.findByPersonId).toHaveBeenCalledWith(partner1Id, 100, 2);
        expect(result).toEqual({
            data: [relationship],
            pagination: {
                page: 2,
                limit: 100,
                totalItems: 201,
                totalPages: 3,
            },
        });
    });

    it('returns not found when listing relationships for an unavailable person', async () => {
        const repository = createRepository();
        repository.findByPersonId.mockResolvedValue(null);
        const service = new CoupleRelationshipService(repository);

        await expect(service.findByPersonId(partner1Id, 20, 1)).rejects.toEqual(
            new NotFoundError({
                detail: 'The requested person does not exist.',
            }),
        );
    });
});
