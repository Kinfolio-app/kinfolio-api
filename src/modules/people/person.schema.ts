import Type from 'typebox';
import { createCollectionResponseSchema } from '../../shared/http/collection-response.js';
import { Gender, LivingStatus } from './person.types.js';

const GenderSchema = Type.Union([
    Type.Literal(Gender.Male),
    Type.Literal(Gender.Female),
    Type.Literal(Gender.NonBinary),
    Type.Literal(Gender.Unspecified),
]);

export const CreatePersonDtoSchema = Type.Object(
    {
        firstName: Type.Optional(Type.String({ minLength: 1 })),
        middleNames: Type.Optional(Type.String({ minLength: 1 })),
        lastName: Type.Optional(Type.String({ minLength: 1 })),
        birthName: Type.Optional(Type.String({ minLength: 1 })),
        gender: Type.Optional(GenderSchema),
        birthDate: Type.Optional(Type.String({ format: 'date' })),
        birthPlace: Type.Optional(Type.String({ minLength: 1 })),
        deathDate: Type.Optional(Type.String({ format: 'date' })),
        deathPlace: Type.Optional(Type.String({ minLength: 1 })),
        livingStatus: Type.Optional(
            Type.Union([
                Type.Literal(LivingStatus.Unknown),
                Type.Literal(LivingStatus.Living),
                Type.Literal(LivingStatus.Deceased),
            ]),
        ),
        biography: Type.Optional(Type.String()),
    },
    {
        additionalProperties: false,
    },
);

export type CreatePersonDto = Type.Static<typeof CreatePersonDtoSchema>;

export const UpdatePersonDtoSchema = Type.Object(
    {
        firstName: Type.Optional(Type.Union([Type.Null(), Type.String({ minLength: 1 })])),
        middleNames: Type.Optional(Type.Union([Type.Null(), Type.String({ minLength: 1 })])),
        lastName: Type.Optional(Type.Union([Type.Null(), Type.String({ minLength: 1 })])),
        birthName: Type.Optional(Type.Union([Type.Null(), Type.String({ minLength: 1 })])),
        gender: Type.Optional(GenderSchema),
        birthDate: Type.Optional(Type.Union([Type.Null(), Type.String({ format: 'date' })])),
        birthPlace: Type.Optional(Type.Union([Type.Null(), Type.String({ minLength: 1 })])),
        deathDate: Type.Optional(Type.Union([Type.Null(), Type.String({ format: 'date' })])),
        deathPlace: Type.Optional(Type.Union([Type.Null(), Type.String({ minLength: 1 })])),
        livingStatus: Type.Optional(
            Type.Union([
                Type.Literal(LivingStatus.Unknown),
                Type.Literal(LivingStatus.Living),
                Type.Literal(LivingStatus.Deceased),
            ]),
        ),
        biography: Type.Optional(Type.Union([Type.Null(), Type.String()])),
    },
    {
        additionalProperties: false,
        minProperties: 1,
    },
);

export type UpdatePersonDto = Type.Static<typeof UpdatePersonDtoSchema>;

export const PersonIdParamsSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
    },
    {
        additionalProperties: false,
    },
);

export type PersonIdParamsDto = Type.Static<typeof PersonIdParamsSchema>;

export const PersonSortSchema = Type.Union([
    Type.Literal('firstName:ASC'),
    Type.Literal('firstName:DESC'),
    Type.Literal('birthDate:ASC'),
    Type.Literal('birthDate:DESC'),
]);

export type PersonSortDto = Type.Static<typeof PersonSortSchema>;

export const PeopleQuerystringSchema = Type.Object(
    {
        limit: Type.Integer({ minimum: 1, default: 20 }),
        page: Type.Integer({ minimum: 1, default: 1 }),
        sort: Type.Array(PersonSortSchema, {
            minItems: 1,
            maxItems: 2,
            uniqueItems: true,
            default: ['birthDate:ASC'],
        }),
    },
    {
        additionalProperties: false,
    },
);

export type PeopleQuerystringDto = Type.Static<typeof PeopleQuerystringSchema>;

export const PersonResponseDtoSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
        firstName: Type.Union([Type.String(), Type.Null()]),
        middleNames: Type.Union([Type.String(), Type.Null()]),
        lastName: Type.Union([Type.String(), Type.Null()]),
        birthName: Type.Union([Type.String(), Type.Null()]),
        gender: GenderSchema,
        birthDate: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
        birthPlace: Type.Union([Type.String(), Type.Null()]),
        deathDate: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
        deathPlace: Type.Union([Type.String(), Type.Null()]),
        livingStatus: Type.Union([
            Type.Literal(LivingStatus.Unknown),
            Type.Literal(LivingStatus.Living),
            Type.Literal(LivingStatus.Deceased),
        ]),
        biography: Type.Union([Type.String(), Type.Null()]),
        createdAt: Type.String({ format: 'date-time' }),
        updatedAt: Type.String({ format: 'date-time' }),
    },
    {
        additionalProperties: false,
    },
);

export type PersonResponseDto = Type.Static<typeof PersonResponseDtoSchema>;

export const PeopleCollectionResponseDtoSchema =
    createCollectionResponseSchema(PersonResponseDtoSchema);

export type PeopleCollectionResponseDto = Type.Static<typeof PeopleCollectionResponseDtoSchema>;
