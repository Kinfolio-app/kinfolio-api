import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../../src/shared/errors/http-error.js';
import {
    DuplicateParentChildRelationshipError,
    ParentChildRelationshipCycleError,
    RelatedPersonNotFoundError,
    SelfParentChildRelationshipError,
} from '../../../../src/modules/relationships/parent-child-relationship.error.js';
import { ParentChildRelationshipService } from '../../../../src/modules/relationships/parent-child-relationship.service.js';
import {
    ParentChildRelationshipEvidenceStatus,
    ParentChildRelationshipType,
    type ParentChildRelationship,
} from '../../../../src/modules/relationships/parent-child-relationship.types.js';

const parentId = '4cf44241-0f1b-4e69-b070-d47ee66b7203';
const childId = 'ffef91f2-f131-44a8-9806-631ff2ac50d7';

const relationship: ParentChildRelationship = {
    id: '65eb723e-82cf-4621-9c70-9ddfc3611b68',
    parentId,
    childId,
    relationshipType: ParentChildRelationshipType.Biological,
    evidenceStatus: ParentChildRelationshipEvidenceStatus.Unassessed,
    createdAt: new Date('2026-07-29T10:00:00.000Z'),
    updatedAt: new Date('2026-07-29T10:00:00.000Z'),
};

function createRepository() {
    return {
        create: vi.fn(),
        findById: vi.fn(),
        findByPersonId: vi.fn(),
    };
}

describe('ParentChildRelationshipService', () => {
    it('creates a parent-child relationship', async () => {
        const repository = createRepository();
        const provenRelationship = {
            ...relationship,
            evidenceStatus: ParentChildRelationshipEvidenceStatus.Proven,
        };
        repository.create.mockResolvedValue(provenRelationship);
        const service = new ParentChildRelationshipService(repository);

        await expect(
            service.create({
                parentId,
                childId,
                relationshipType: ParentChildRelationshipType.Biological,
                evidenceStatus: ParentChildRelationshipEvidenceStatus.Proven,
            }),
        ).resolves.toEqual(provenRelationship);
        expect(repository.create).toHaveBeenCalledWith({
            parentId,
            childId,
            relationshipType: ParentChildRelationshipType.Biological,
            evidenceStatus: ParentChildRelationshipEvidenceStatus.Proven,
        });
    });

    it('rejects a self relationship without querying the repository', async () => {
        const repository = createRepository();
        const service = new ParentChildRelationshipService(repository);

        await expect(
            service.create({
                parentId,
                childId: parentId,
            }),
        ).rejects.toEqual(
            expect.objectContaining({
                status: 409,
                detail: 'A person cannot be their own parent.',
                cause: expect.any(SelfParentChildRelationshipError),
            }),
        );
        expect(repository.create).not.toHaveBeenCalled();
    });

    it.each([
        {
            name: 'a missing person',
            domainError: new RelatedPersonNotFoundError(),
            status: 404,
            detail: 'The parent or child does not exist.',
        },
        {
            name: 'a duplicate',
            domainError: new DuplicateParentChildRelationshipError(),
            status: 409,
            detail: 'This parent-child relationship already exists.',
        },
        {
            name: 'a cycle',
            domainError: new ParentChildRelationshipCycleError(),
            status: 409,
            detail: 'This parent-child relationship would create a cycle.',
        },
    ])(
        'translates $name domain error into an HTTP error',
        async ({ domainError, status, detail }) => {
            const repository = createRepository();
            repository.create.mockRejectedValue(domainError);
            const service = new ParentChildRelationshipService(repository);

            await expect(
                service.create({
                    parentId,
                    childId,
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

    it('returns a parent-child relationship by id', async () => {
        const repository = createRepository();
        repository.findById.mockResolvedValue(relationship);
        const service = new ParentChildRelationshipService(repository);

        await expect(service.findById(relationship.id)).resolves.toEqual(relationship);
    });

    it('returns not found when a parent-child relationship does not exist', async () => {
        const repository = createRepository();
        repository.findById.mockResolvedValue(null);
        const service = new ParentChildRelationshipService(repository);

        await expect(service.findById(relationship.id)).rejects.toEqual(
            new NotFoundError({
                detail: 'The requested parent-child relationship does not exist.',
            }),
        );
    });

    it('builds capped pagination metadata for a person relationships', async () => {
        const repository = createRepository();
        repository.findByPersonId.mockResolvedValue({
            data: [relationship],
            totalItems: 201,
        });
        const service = new ParentChildRelationshipService(repository);

        const result = await service.findByPersonId(parentId, 500, 2);

        expect(repository.findByPersonId).toHaveBeenCalledWith(parentId, 100, 2);
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
        const service = new ParentChildRelationshipService(repository);

        await expect(service.findByPersonId(parentId, 20, 1)).rejects.toEqual(
            new NotFoundError({
                detail: 'The requested person does not exist.',
            }),
        );
    });
});
