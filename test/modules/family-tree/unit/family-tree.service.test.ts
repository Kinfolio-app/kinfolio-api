import { describe, expect, it, vi } from 'vitest';
import { FamilyTreeService } from '../../../../src/modules/family-tree/family-tree.service.js';
import { TreeDirection } from '../../../../src/modules/family-tree/family-tree.types.js';
import { NotFoundError } from '../../../../src/shared/errors/http-error.js';

describe('FamilyTreeService', () => {
    it('builds a family tree response from a branch', async () => {
        const repository = {
            findBranch: vi.fn().mockResolvedValue({
                people: [],
                relationships: [],
                reachedDepth: 2,
                truncated: true,
            }),
        };
        const service = new FamilyTreeService(repository);
        const rootPersonId = '4cf44241-0f1b-4e69-b070-d47ee66b7203';

        const result = await service.findBranch(rootPersonId, TreeDirection.Ancestors, 2);

        expect(repository.findBranch).toHaveBeenCalledWith(
            rootPersonId,
            TreeDirection.Ancestors,
            2,
        );
        expect(result).toEqual({
            rootPersonId,
            people: [],
            relationships: [],
            traversal: {
                direction: TreeDirection.Ancestors,
                requestedDepth: 2,
                reachedDepth: 2,
                truncated: true,
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
