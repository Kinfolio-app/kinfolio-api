import Type from 'typebox';
import { GenealogicalDateSchema } from '../../shared/genealogy/genealogical-date.schema.js';
import { createCollectionResponseSchema } from '../../shared/http/collection-response.js';
import { CoupleRelationshipEventType } from './couple-relationship.types.js';

export const CoupleRelationshipEventTypeSchema = Type.Union([
    Type.Literal(CoupleRelationshipEventType.Engagement),
    Type.Literal(CoupleRelationshipEventType.Marriage),
    Type.Literal(CoupleRelationshipEventType.CivilUnion),
    Type.Literal(CoupleRelationshipEventType.Separation),
    Type.Literal(CoupleRelationshipEventType.Divorce),
    Type.Literal(CoupleRelationshipEventType.Annulment),
    Type.Literal(CoupleRelationshipEventType.Other),
]);

export const CreateCoupleRelationshipDtoSchema = Type.Object(
    {
        partner1Id: Type.String({ format: 'uuid' }),
        partner2Id: Type.String({ format: 'uuid' }),
    },
    {
        additionalProperties: false,
    },
);

export type CreateCoupleRelationshipDto = Type.Static<typeof CreateCoupleRelationshipDtoSchema>;

export const CoupleRelationshipIdParamsSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
    },
    {
        additionalProperties: false,
    },
);

export type CoupleRelationshipIdParamsDto = Type.Static<typeof CoupleRelationshipIdParamsSchema>;

export const PersonCoupleRelationshipsParamsSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
    },
    {
        additionalProperties: false,
    },
);

export type PersonCoupleRelationshipsParamsDto = Type.Static<
    typeof PersonCoupleRelationshipsParamsSchema
>;

export const CoupleRelationshipsQuerystringSchema = Type.Object(
    {
        limit: Type.Integer({ minimum: 1, default: 20 }),
        page: Type.Integer({ minimum: 1, default: 1 }),
    },
    {
        additionalProperties: false,
    },
);

export type CoupleRelationshipsQuerystringDto = Type.Static<
    typeof CoupleRelationshipsQuerystringSchema
>;

export const CoupleRelationshipResponseDtoSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
        partner1Id: Type.String({ format: 'uuid' }),
        partner2Id: Type.String({ format: 'uuid' }),
        createdAt: Type.String({ format: 'date-time' }),
        updatedAt: Type.String({ format: 'date-time' }),
    },
    {
        additionalProperties: false,
    },
);

export type CoupleRelationshipResponseDto = Type.Static<typeof CoupleRelationshipResponseDtoSchema>;

export const CoupleRelationshipsCollectionResponseDtoSchema = createCollectionResponseSchema(
    CoupleRelationshipResponseDtoSchema,
);

export type CoupleRelationshipsCollectionResponseDto = Type.Static<
    typeof CoupleRelationshipsCollectionResponseDtoSchema
>;

export const CreateCoupleRelationshipEventDtoSchema = Type.Object(
    {
        eventType: CoupleRelationshipEventTypeSchema,
        date: Type.Optional(GenealogicalDateSchema),
        place: Type.Optional(Type.String({ minLength: 1 })),
        description: Type.Optional(Type.String({ minLength: 1 })),
    },
    {
        additionalProperties: false,
    },
);

export type CreateCoupleRelationshipEventDto = Type.Static<
    typeof CreateCoupleRelationshipEventDtoSchema
>;

export const UpdateCoupleRelationshipEventDtoSchema = Type.Object(
    {
        eventType: Type.Optional(CoupleRelationshipEventTypeSchema),
        date: Type.Optional(Type.Union([GenealogicalDateSchema, Type.Null()])),
        place: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
        description: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
    },
    {
        additionalProperties: false,
        minProperties: 1,
    },
);

export type UpdateCoupleRelationshipEventDto = Type.Static<
    typeof UpdateCoupleRelationshipEventDtoSchema
>;

export const CoupleRelationshipEventIdParamsSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
    },
    {
        additionalProperties: false,
    },
);

export type CoupleRelationshipEventIdParamsDto = Type.Static<
    typeof CoupleRelationshipEventIdParamsSchema
>;

export const CoupleRelationshipEventsQuerystringSchema = Type.Object(
    {
        limit: Type.Integer({ minimum: 1, default: 20 }),
        page: Type.Integer({ minimum: 1, default: 1 }),
    },
    {
        additionalProperties: false,
    },
);

export type CoupleRelationshipEventsQuerystringDto = Type.Static<
    typeof CoupleRelationshipEventsQuerystringSchema
>;

export const CoupleRelationshipEventResponseDtoSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
        coupleRelationshipId: Type.String({ format: 'uuid' }),
        eventType: CoupleRelationshipEventTypeSchema,
        date: Type.Union([GenealogicalDateSchema, Type.Null()]),
        place: Type.Union([Type.String(), Type.Null()]),
        description: Type.Union([Type.String(), Type.Null()]),
        createdAt: Type.String({ format: 'date-time' }),
        updatedAt: Type.String({ format: 'date-time' }),
    },
    {
        additionalProperties: false,
    },
);

export type CoupleRelationshipEventResponseDto = Type.Static<
    typeof CoupleRelationshipEventResponseDtoSchema
>;

export const CoupleRelationshipEventsCollectionResponseDtoSchema = createCollectionResponseSchema(
    CoupleRelationshipEventResponseDtoSchema,
);

export type CoupleRelationshipEventsCollectionResponseDto = Type.Static<
    typeof CoupleRelationshipEventsCollectionResponseDtoSchema
>;
