import { describe, expect, it, vi } from 'vitest';
import { FamilyTreeService } from '../../../../src/modules/family-tree/family-tree.service.js';
import {
    FamilyTreeTruncationReason,
    TreeDirection,
} from '../../../../src/modules/family-tree/family-tree.types.js';
import { Gender, LivingStatus, type Person } from '../../../../src/modules/people/person.types.js';
import { NotFoundError } from '../../../../src/shared/errors/http-error.js';

describe('FamilyTreeService', () => {
    it('builds a family tree response from a branch', async () => {
        const rootPersonId = '4cf44241-0f1b-4e69-b070-d47ee66b7203';
        const person: Person = {
            id: rootPersonId,
            firstName: 'Alice',
            middleNames: null,
            lastName: null,
            birthName: null,
            gender: Gender.Unspecified,
            birthDate: null,
            birthPlace: null,
            deathDate: null,
            deathPlace: null,
            livingStatus: LivingStatus.Unknown,
            biography: null,
            createdAt: new Date('2026-07-30T10:00:00.000Z'),
            updatedAt: new Date('2026-07-30T10:00:00.000Z'),
        };
        const repository = {
            findBranch: vi.fn().mockResolvedValue({
                people: [person],
                relationships: [],
                reachedDepth: 2,
                truncationReasons: [FamilyTreeTruncationReason.DepthLimit],
            }),
        };
        const service = new FamilyTreeService(repository);

        const result = await service.findBranch(rootPersonId, TreeDirection.Ancestors, 2);

        expect(repository.findBranch).toHaveBeenCalledWith(
            rootPersonId,
            TreeDirection.Ancestors,
            2,
        );
        expect(result).toEqual({
            rootPersonId,
            people: [person],
            relationships: [],
            traversal: {
                direction: TreeDirection.Ancestors,
                requestedDepth: 2,
                reachedDepth: 2,
                truncated: true,
                truncationReasons: [FamilyTreeTruncationReason.DepthLimit],
                returnedPeople: 1,
            },
        });
    });

    it('returns not found when the root person is unavailable', async () => {
        const repository = {
            findBranch: vi.fn().mockResolvedValue(null),
        };
        const service = new FamilyTreeService(repository);

        await expect(
            service.findBranch(
                '4cf44241-0f1b-4e69-b070-d47ee66b7203',
                TreeDirection.Descendants,
                3,
            ),
        ).rejects.toEqual(
            new NotFoundError({
                detail: 'The requested person does not exist.',
            }),
        );
    });
});
