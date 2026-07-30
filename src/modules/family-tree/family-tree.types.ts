import type { Person } from '../people/person.types.js';
import type { ParentChildRelationship } from '../relationships/parent-child-relationship.types.js';

export const DEFAULT_FAMILY_TREE_DEPTH = 3;
export const MAX_FAMILY_TREE_DEPTH = 10;

export const TreeDirection = {
    Ancestors: 'ancestors',
    Descendants: 'descendants',
    Both: 'both',
} as const;

export type TreeDirection = (typeof TreeDirection)[keyof typeof TreeDirection];

export type FamilyTreeBranch = {
    people: Person[];
    relationships: ParentChildRelationship[];
    reachedDepth: number;
    truncated: boolean;
};

export type FamilyTree = {
    rootPersonId: string;
    people: Person[];
    relationships: ParentChildRelationship[];
    traversal: {
        direction: TreeDirection;
        requestedDepth: number;
        reachedDepth: number;
        truncated: boolean;
    };
};
