import Type from 'typebox';
import { createCollectionResponseSchema } from '../../shared/http/collection-response.js';
import {
    ParentChildRelationshipEvidenceStatus,
    ParentChildRelationshipType,
} from './parent-child-relationship.types.js';

const ParentChildRelationshipTypeSchema = Type.Union([
    Type.Literal(ParentChildRelationshipType.Biological),
    Type.Literal(ParentChildRelationshipType.Adoptive),
    Type.Literal(ParentChildRelationshipType.Step),
    Type.Literal(ParentChildRelationshipType.Foster),
    Type.Literal(ParentChildRelationshipType.Other),
    Type.Literal(ParentChildRelationshipType.Unspecified),
]);

const ParentChildRelationshipEvidenceStatusSchema = Type.Union([
    Type.Literal(ParentChildRelationshipEvidenceStatus.Unassessed),
    Type.Literal(ParentChildRelationshipEvidenceStatus.Proven),
    Type.Literal(ParentChildRelationshipEvidenceStatus.Challenged),
]);

export const CreateParentChildRelationshipDtoSchema = Type.Object(
    {
        parentId: Type.String({ format: 'uuid' }),
        childId: Type.String({ format: 'uuid' }),
        relationshipType: Type.Optional(ParentChildRelationshipTypeSchema),
        evidenceStatus: Type.Optional(ParentChildRelationshipEvidenceStatusSchema),
    },
    {
        additionalProperties: false,
    },
);

export type CreateParentChildRelationshipDto = Type.Static<
    typeof CreateParentChildRelationshipDtoSchema
>;

export const ParentChildRelationshipIdParamsSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
    },
    {
        additionalProperties: false,
    },
);

export type ParentChildRelationshipIdParamsDto = Type.Static<
    typeof ParentChildRelationshipIdParamsSchema
>;

export const PersonParentChildRelationshipsParamsSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
    },
    {
        additionalProperties: false,
    },
);

export type PersonParentChildRelationshipsParamsDto = Type.Static<
    typeof PersonParentChildRelationshipsParamsSchema
>;

export const ParentChildRelationshipsQuerystringSchema = Type.Object(
    {
        limit: Type.Integer({ minimum: 1, default: 20 }),
        page: Type.Integer({ minimum: 1, default: 1 }),
    },
    {
        additionalProperties: false,
    },
);

export type ParentChildRelationshipsQuerystringDto = Type.Static<
    typeof ParentChildRelationshipsQuerystringSchema
>;

export const ParentChildRelationshipResponseDtoSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
        parentId: Type.String({ format: 'uuid' }),
        childId: Type.String({ format: 'uuid' }),
        relationshipType: ParentChildRelationshipTypeSchema,
        evidenceStatus: ParentChildRelationshipEvidenceStatusSchema,
        createdAt: Type.String({ format: 'date-time' }),
        updatedAt: Type.String({ format: 'date-time' }),
    },
    {
        additionalProperties: false,
    },
);

export type ParentChildRelationshipResponseDto = Type.Static<
    typeof ParentChildRelationshipResponseDtoSchema
>;

export const ParentChildRelationshipsCollectionResponseDtoSchema = createCollectionResponseSchema(
    ParentChildRelationshipResponseDtoSchema,
);

export type ParentChildRelationshipsCollectionResponseDto = Type.Static<
    typeof ParentChildRelationshipsCollectionResponseDtoSchema
>;
