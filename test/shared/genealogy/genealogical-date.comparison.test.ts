import { describe, expect, it } from 'vitest';
import { compareGenealogicalDates } from '../../../src/shared/genealogy/genealogical-date.comparison.js';
import {
    GenealogicalCalendar,
    GenealogicalDateKind,
} from '../../../src/shared/genealogy/genealogical-date.types.js';
import { exactGregorianDate } from '../../fixtures/genealogical-date.js';

describe('compareGenealogicalDates', () => {
    it('orders complete exact dates', () => {
        expect(
            compareGenealogicalDates(
                exactGregorianDate(1900, 3, 12),
                exactGregorianDate(1905, 6, 18),
            ),
        ).toBe(-1);
    });

    it('recognizes equal complete exact dates', () => {
        expect(
            compareGenealogicalDates(
                exactGregorianDate(1900, 3, 12),
                exactGregorianDate(1900, 3, 12),
            ),
        ).toBe(0);
    });

    it('orders partial dates only when their ranges do not overlap', () => {
        expect(compareGenealogicalDates(exactGregorianDate(1900), exactGregorianDate(1901))).toBe(
            -1,
        );
        expect(
            compareGenealogicalDates(exactGregorianDate(1900), exactGregorianDate(1900, 6)),
        ).toBeNull();
    });

    it('does not invent an order for an approximate date', () => {
        expect(
            compareGenealogicalDates(
                {
                    ...exactGregorianDate(1900),
                    kind: GenealogicalDateKind.About,
                },
                exactGregorianDate(1901),
            ),
        ).toBeNull();
    });

    it('does not compare different calendars', () => {
        const julianDate = exactGregorianDate(1900);
        julianDate.first.calendar = GenealogicalCalendar.Julian;

        expect(compareGenealogicalDates(julianDate, exactGregorianDate(1901))).toBeNull();
    });
});
