import {
    GenealogicalCalendar,
    GenealogicalDateKind,
    GenealogicalEpoch,
    type GenealogicalSinglePointDate,
} from '../../src/shared/genealogy/genealogical-date.types.js';

export function exactGregorianDate(
    year: number,
    month: number | null = null,
    day: number | null = null,
): GenealogicalSinglePointDate {
    const originalText =
        month === null
            ? String(year)
            : day === null
              ? `${year}-${String(month).padStart(2, '0')}`
              : `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
        kind: GenealogicalDateKind.Exact,
        first: {
            calendar: GenealogicalCalendar.Gregorian,
            calendarTag: null,
            year,
            month,
            monthTag: null,
            day,
            epoch: GenealogicalEpoch.Common,
            epochTag: null,
        },
        second: null,
        phrase: null,
        originalText,
    };
}
