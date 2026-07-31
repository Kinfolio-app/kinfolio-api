import { describe, expect, it } from 'vitest';
import { parseGedcom7Date } from '../../../../src/modules/gedcom-import/v7/date-parser.js';

describe('parseGedcom7Date', () => {
    it('parses a qualified date with a phrase', () => {
        const result = parseGedcom7Date('ABT 12 MAR 1900', 'according to the census');

        expect(result).toEqual({
            success: true,
            date: {
                kind: 'about',
                first: {
                    calendar: 'gregorian',
                    calendarTag: null,
                    year: 1900,
                    month: 3,
                    monthTag: 'MAR',
                    day: 12,
                    epoch: 'common',
                    epochTag: null,
                },
                second: null,
                phrase: 'according to the census',
                originalText: 'ABT 12 MAR 1900',
            },
        });
    });

    it('parses GEDCOM 7 calendars and BCE epochs', () => {
        const result = parseGedcom7Date('JULIAN 1 JAN 44 BCE');

        expect(result).toEqual(
            expect.objectContaining({
                success: true,
                date: expect.objectContaining({
                    first: expect.objectContaining({
                        calendar: 'julian',
                        epoch: 'before_common',
                        epochTag: 'BCE',
                    }),
                }),
            }),
        );
    });

    it('preserves extension calendar identifiers', () => {
        const result = parseGedcom7Date('_CAL 3 _MONTH 42 _EPOCH');

        expect(result).toEqual(
            expect.objectContaining({
                success: true,
                date: expect.objectContaining({
                    first: expect.objectContaining({
                        calendar: 'extension',
                        calendarTag: '_CAL',
                        monthTag: '_MONTH',
                        epochTag: '_EPOCH',
                    }),
                }),
            }),
        );
    });

    it('represents a phrase-only date', () => {
        expect(parseGedcom7Date(null, 'during the spring')).toEqual({
            success: true,
            date: {
                kind: 'phrase',
                first: null,
                second: null,
                phrase: 'during the spring',
                originalText: 'during the spring',
            },
        });
    });

    it('accepts an empty DateValue', () => {
        expect(parseGedcom7Date(null)).toEqual({ success: true, date: null });
    });

    it.each(['29 FEB 1900', 'FRENCH_R 7 COMP 2', 'HEBREW 1 JAN 5000', '1900 B.C.'])(
        'rejects invalid GEDCOM 7 date %s',
        (value) => {
            expect(parseGedcom7Date(value).success).toBe(false);
        },
    );
});
