import { describe, expect, it } from 'vitest';
import { Check } from 'typebox/value';
import {
    GenealogicalDatePointSchema,
    GenealogicalDateSchema,
} from '../../../src/shared/genealogy/genealogical-date.schema.js';
import {
    GenealogicalCalendar,
    GenealogicalDateKind,
    GenealogicalEpoch,
    type GenealogicalDatePoint,
} from '../../../src/shared/genealogy/genealogical-date.types.js';

const POINT: GenealogicalDatePoint = {
    calendar: GenealogicalCalendar.Gregorian,
    year: 1900,
    month: 3,
    day: 12,
    epoch: GenealogicalEpoch.Common,
};

describe('GenealogicalDateSchema', () => {
    it.each([
        GenealogicalDateKind.Exact,
        GenealogicalDateKind.About,
        GenealogicalDateKind.Calculated,
        GenealogicalDateKind.Estimated,
        GenealogicalDateKind.Interpreted,
        GenealogicalDateKind.Before,
        GenealogicalDateKind.After,
    ])('accepts the %s single-point date kind', (kind) => {
        expect(
            Check(GenealogicalDateSchema, {
                kind,
                first: POINT,
                second: null,
                phrase: null,
                originalText: null,
            }),
        ).toBe(true);
    });

    it('accepts a date between two points', () => {
        expect(
            Check(GenealogicalDateSchema, {
                kind: GenealogicalDateKind.Between,
                first: POINT,
                second: { ...POINT, year: 1905 },
                phrase: null,
                originalText: 'BET 1900 AND 1905',
            }),
        ).toBe(true);
    });

    it.each([
        { first: POINT, second: null },
        { first: null, second: POINT },
        { first: POINT, second: { ...POINT, year: 1905 } },
    ])('accepts a non-empty period with $first and $second', ({ first, second }) => {
        expect(
            Check(GenealogicalDateSchema, {
                kind: GenealogicalDateKind.Period,
                first,
                second,
                phrase: null,
                originalText: null,
            }),
        ).toBe(true);
    });

    it('accepts a phrase without points', () => {
        expect(
            Check(GenealogicalDateSchema, {
                kind: GenealogicalDateKind.Phrase,
                first: null,
                second: null,
                phrase: 'au printemps de 1900',
                originalText: null,
            }),
        ).toBe(true);
    });

    it.each([
        {
            name: 'a single-point date with a second point',
            value: {
                kind: GenealogicalDateKind.Exact,
                first: POINT,
                second: POINT,
                phrase: null,
                originalText: null,
            },
        },
        {
            name: 'a between date without a second point',
            value: {
                kind: GenealogicalDateKind.Between,
                first: POINT,
                second: null,
                phrase: null,
                originalText: null,
            },
        },
        {
            name: 'an empty period',
            value: {
                kind: GenealogicalDateKind.Period,
                first: null,
                second: null,
                phrase: null,
                originalText: null,
            },
        },
        {
            name: 'a phrase with a point',
            value: {
                kind: GenealogicalDateKind.Phrase,
                first: POINT,
                second: null,
                phrase: 'au printemps de 1900',
                originalText: null,
            },
        },
        {
            name: 'an empty phrase',
            value: {
                kind: GenealogicalDateKind.Phrase,
                first: null,
                second: null,
                phrase: '',
                originalText: null,
            },
        },
        {
            name: 'an unknown property',
            value: {
                kind: GenealogicalDateKind.Exact,
                first: POINT,
                second: null,
                phrase: null,
                originalText: null,
                unknownProperty: true,
            },
        },
    ])('rejects $name', ({ value }) => {
        expect(Check(GenealogicalDateSchema, value)).toBe(false);
    });
});

describe('GenealogicalDatePointSchema', () => {
    it('accepts optional source tags', () => {
        expect(
            Check(GenealogicalDatePointSchema, {
                ...POINT,
                calendar: GenealogicalCalendar.Extension,
                calendarTag: '_CUSTOM',
                month: null,
                monthTag: '_SEASON',
                epochTag: '_ERA',
            }),
        ).toBe(true);
    });

    it.each([
        { name: 'a year below one', value: { ...POINT, year: 0 } },
        { name: 'a month above thirteen', value: { ...POINT, month: 14 } },
        { name: 'a day above thirty-six', value: { ...POINT, day: 37 } },
        { name: 'an unknown calendar', value: { ...POINT, calendar: 'unknown' } },
        { name: 'an unknown property', value: { ...POINT, unknownProperty: true } },
    ])('rejects $name', ({ value }) => {
        expect(Check(GenealogicalDatePointSchema, value)).toBe(false);
    });
});
