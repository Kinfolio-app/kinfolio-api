import { NotFoundError } from '../../shared/errors/http-error.js';
import type { FamilyTreeRepository } from './family-tree.repository.js';
import type { FamilyTree, TreeDirection } from './family-tree.types.js';

type FamilyTreeRepositoryContract = Pick<FamilyTreeRepository, 'findBranch'>;

export class FamilyTreeService {
    constructor(private readonly repository: FamilyTreeRepositoryContract) {}

    async findBranch(
        rootPersonId: string,
        direction: TreeDirection,
        depth: number,
    ): Promise<FamilyTree> {
        const branch = await this.repository.findBranch(rootPersonId, direction, depth);

        if (branch === null) {
            throw new NotFoundError({
                detail: 'The requested person does not exist.',
            });
        }

        return {
            rootPersonId,
            people: branch.people,
            relationships: branch.relationships,
            traversal: {
                direction,
                requestedDepth: depth,
                reachedDepth: branch.reachedDepth,
                truncated: branch.truncated,
            },
        };
    }
}
