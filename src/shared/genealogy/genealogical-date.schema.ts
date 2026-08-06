import Type from 'typebox';
import {
    GenealogicalCalendar,
    GenealogicalDateKind,
    GenealogicalEpoch,
} from './genealogical-date.types.js';

export const GenealogicalCalendarSchema = Type.Union([
    Type.Literal(GenealogicalCalendar.Gregorian),
    Type.Literal(GenealogicalCalendar.Julian),
    Type.Literal(GenealogicalCalendar.FrenchRepublican),
    Type.Literal(GenealogicalCalendar.Hebrew),
    Type.Literal(GenealogicalCalendar.Extension),
]);

export const GenealogicalEpochSchema = Type.Union([
    Type.Literal(GenealogicalEpoch.Common),
    Type.Literal(GenealogicalEpoch.BeforeCommon),
]);

const OptionalTagSchema = Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()]));

export const GenealogicalDatePointSchema = Type.Object(
    {
        calendar: GenealogicalCalendarSchema,
        calendarTag: OptionalTagSchema,
        year: Type.Integer({ minimum: 1 }),
        month: Type.Union([Type.Integer({ minimum: 1, maximum: 13 }), Type.Null()]),
        monthTag: OptionalTagSchema,
        day: Type.Union([Type.Integer({ minimum: 1, maximum: 36 }), Type.Null()]),
        epoch: GenealogicalEpochSchema,
        epochTag: OptionalTagSchema,
    },
    {
        additionalProperties: false,
    },
);

const OriginalTextSchema = Type.Union([Type.String(), Type.Null()]);
const NullablePhraseSchema = Type.Union([Type.String({ minLength: 1 }), Type.Null()]);

const GenealogicalSinglePointDateSchema = Type.Object(
    {
        kind: Type.Union([
            Type.Literal(GenealogicalDateKind.Exact),
            Type.Literal(GenealogicalDateKind.About),
            Type.Literal(GenealogicalDateKind.Calculated),
            Type.Literal(GenealogicalDateKind.Estimated),
            Type.Literal(GenealogicalDateKind.Interpreted),
            Type.Literal(GenealogicalDateKind.Before),
            Type.Literal(GenealogicalDateKind.After),
        ]),
        first: GenealogicalDatePointSchema,
        second: Type.Null(),
        phrase: NullablePhraseSchema,
        originalText: OriginalTextSchema,
    },
    {
        additionalProperties: false,
    },
);

const GenealogicalBetweenDateSchema = Type.Object(
    {
        kind: Type.Literal(GenealogicalDateKind.Between),
        first: GenealogicalDatePointSchema,
        second: GenealogicalDatePointSchema,
        phrase: NullablePhraseSchema,
        originalText: OriginalTextSchema,
    },
    {
        additionalProperties: false,
    },
);

const PeriodMetadataSchema = {
    kind: Type.Literal(GenealogicalDateKind.Period),
    phrase: NullablePhraseSchema,
    originalText: OriginalTextSchema,
};

const GenealogicalPeriodDateSchema = Type.Union([
    Type.Object(
        {
            ...PeriodMetadataSchema,
            first: GenealogicalDatePointSchema,
            second: Type.Union([GenealogicalDatePointSchema, Type.Null()]),
        },
        {
            additionalProperties: false,
        },
    ),
    Type.Object(
        {
            ...PeriodMetadataSchema,
            first: Type.Null(),
            second: GenealogicalDatePointSchema,
        },
        {
            additionalProperties: false,
        },
    ),
]);

const GenealogicalPhraseDateSchema = Type.Object(
    {
        kind: Type.Literal(GenealogicalDateKind.Phrase),
        first: Type.Null(),
        second: Type.Null(),
        phrase: Type.String({ minLength: 1 }),
        originalText: OriginalTextSchema,
    },
    {
        additionalProperties: false,
    },
);

export const GenealogicalDateSchema = Type.Union([
    GenealogicalSinglePointDateSchema,
    GenealogicalBetweenDateSchema,
    GenealogicalPeriodDateSchema,
    GenealogicalPhraseDateSchema,
]);
