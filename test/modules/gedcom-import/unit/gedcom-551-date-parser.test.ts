import { describe, expect, it } from 'vitest';
import { parseGedcom551Date } from '../../../../src/modules/gedcom-import/v5/date-parser.js';

describe('parseGedcom551Date', () => {
    it('parses an exact partial Gregorian date', () => {
        const result = parseGedcom551Date('12 MAR 1900');

        expect(result).toEqual({
            success: true,
            date: {
                kind: 'exact',
                first: { calendar: 'gregorian', year: 1900, month: 3, day: 12, epoch: 'common' },
                second: null,
                phrase: null,
                originalText: '12 MAR 1900',
            },
        });
    });

    it.each([
        ['ABT 1900', 'about'],
        ['CAL MAR 1900', 'calculated'],
        ['EST 1900', 'estimated'],
        ['BEF 1900', 'before'],
        ['AFT 1900', 'after'],
    ] as const)('parses %s as %s', (value, kind) => {
        const result = parseGedcom551Date(value);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.date.kind).toBe(kind);
        }
    });

    it('parses a range', () => {
        const result = parseGedcom551Date('BET 1900 AND 1905');

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.date).toMatchObject({
                kind: 'between',
                first: { year: 1900 },
                second: { year: 1905 },
            });
        }
    });

    it('parses an open-ended period', () => {
        const result = parseGedcom551Date('FROM 1900');

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.date).toMatchObject({
                kind: 'period',
                first: { year: 1900 },
                second: null,
            });
        }
    });

    it('parses a declared calendar and an interpreted phrase', () => {
        const calendarResult = parseGedcom551Date('@#DJULIAN@ 1 JAN 1900');
        const interpretedResult = parseGedcom551Date('INT 1900 (estimated from census)');

        expect(calendarResult).toEqual(
            expect.objectContaining({
                success: true,
                date: expect.objectContaining({
                    first: expect.objectContaining({ calendar: 'julian' }),
                }),
            }),
        );
        expect(interpretedResult).toEqual(
            expect.objectContaining({
                success: true,
                date: expect.objectContaining({
                    kind: 'interpreted',
                    phrase: 'estimated from census',
                }),
            }),
        );
    });

    it.each(['32 JAN 1900', 'BET 1900 1905', 'MAR UNKNOWN', '@#DUNKNOWN@ 1900'])(
        'rejects invalid date %s',
        (value) => {
            expect(parseGedcom551Date(value).success).toBe(false);
        },
    );
});
