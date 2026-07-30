import Type from 'typebox';
import { PersonResponseDtoSchema } from '../people/person.schema.js';
import { ParentChildRelationshipResponseDtoSchema } from '../relationships/parent-child-relationship.schema.js';
import {
    DEFAULT_FAMILY_TREE_DEPTH,
    MAX_FAMILY_TREE_DEPTH,
    TreeDirection,
} from './family-tree.types.js';

export const TreeDirectionSchema = Type.Union([
    Type.Literal(TreeDirection.Ancestors),
    Type.Literal(TreeDirection.Descendants),
    Type.Literal(TreeDirection.Both),
]);

export const FamilyTreeIdParamsSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
    },
    {
        additionalProperties: false,
    },
);

export type FamilyTreeIdParamsDto = Type.Static<typeof FamilyTreeIdParamsSchema>;

export const FamilyTreeQuerystringSchema = Type.Object(
    {
        direction: Type.Union(
            [
                Type.Literal(TreeDirection.Ancestors),
                Type.Literal(TreeDirection.Descendants),
                Type.Literal(TreeDirection.Both),
            ],
            {
                default: TreeDirection.Ancestors,
            },
        ),
        depth: Type.Integer({
            minimum: 1,
            maximum: MAX_FAMILY_TREE_DEPTH,
            default: DEFAULT_FAMILY_TREE_DEPTH,
        }),
    },
    {
        additionalProperties: false,
    },
);

export type FamilyTreeQuerystringDto = Type.Static<typeof FamilyTreeQuerystringSchema>;

export const FamilyTreeResponseDtoSchema = Type.Object(
    {
        rootPersonId: Type.String({ format: 'uuid' }),
        people: Type.Array(PersonResponseDtoSchema),
        relationships: Type.Array(ParentChildRelationshipResponseDtoSchema),
        traversal: Type.Object(
            {
                direction: TreeDirectionSchema,
                requestedDepth: Type.Integer({ minimum: 1 }),
                reachedDepth: Type.Integer({ minimum: 0 }),
                truncated: Type.Boolean(),
            },
            {
                additionalProperties: false,
            },
        ),
    },
    {
        additionalProperties: false,
    },
);

export type FamilyTreeResponseDto = Type.Static<typeof FamilyTreeResponseDtoSchema>;
