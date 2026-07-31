import type {
    GenealogicalCalendar,
    GenealogicalDate,
    GenealogicalDatePoint,
} from './gedcom-parser.types.js';
import { isAsciiDigits } from './gedcom-character-utils.js';

export type GedcomDateParseResult =
    | {
          success: true;
          date: GenealogicalDate;
      }
    | {
          success: false;
          message: string;
      };

const GREGORIAN_AND_JULIAN_MONTHS = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
] as const;

const HEBREW_MONTHS = [
    'TSH',
    'CSH',
    'KSL',
    'TVT',
    'SHV',
    'ADR',
    'ADS',
    'NSN',
    'IYR',
    'SVN',
    'TMZ',
    'AAV',
    'ELL',
] as const;

const FRENCH_REPUBLICAN_MONTHS = [
    'VEND',
    'BRUM',
    'FRIM',
    'NIVO',
    'PLUV',
    'VENT',
    'GERM',
    'FLOR',
    'PRAI',
    'MESS',
    'THER',
    'FRUC',
    'COMP',
] as const;

function failure(message: string): GedcomDateParseResult {
    return { success: false, message };
}

function monthNumber(calendar: GenealogicalCalendar, value: string): number | null {
    const months =
        calendar === 'hebrew'
            ? HEBREW_MONTHS
            : calendar === 'french_republican'
              ? FRENCH_REPUBLICAN_MONTHS
              : GREGORIAN_AND_JULIAN_MONTHS;
    const index = months.findIndex((month) => month === value);

    return index === -1 ? null : index + 1;
}

function extractCalendar(
    value: string,
):
    | { success: true; calendar: GenealogicalCalendar; dateText: string }
    | { success: false; message: string } {
    if (!value.startsWith('@#D')) {
        return { success: true, calendar: 'gregorian', dateText: value };
    }

    const escapeEnd = value.indexOf('@', 3);

    if (escapeEnd === -1 || value[escapeEnd + 1] !== ' ') {
        return { success: false, message: 'The GEDCOM calendar escape is invalid.' };
    }

    const calendarName = value.slice(3, escapeEnd);
    const calendar =
        calendarName === 'GREGORIAN'
            ? 'gregorian'
            : calendarName === 'JULIAN'
              ? 'julian'
              : calendarName === 'HEBREW'
                ? 'hebrew'
                : calendarName === 'FRENCH R'
                  ? 'french_republican'
                  : null;

    if (calendar === null) {
        return {
            success: false,
            message: `Calendar ${calendarName} is not defined by GEDCOM 5.5.1.`,
        };
    }

    return {
        success: true,
        calendar,
        dateText: value.slice(escapeEnd + 2),
    };
}

function parseDatePoint(
    value: string,
): { success: true; point: GenealogicalDatePoint } | { success: false; message: string } {
    const calendarResult = extractCalendar(value);

    if (!calendarResult.success) {
        return calendarResult;
    }

    const parts = calendarResult.dateText.split(' ');

    if (parts.some((part) => part.length === 0)) {
        return { success: false, message: 'The GEDCOM date contains invalid spacing.' };
    }

    let epoch: GenealogicalDatePoint['epoch'] = 'common';

    if (parts.at(-1) === 'B.C.') {
        epoch = 'before_common';
        parts.pop();
    }

    if (parts.length < 1 || parts.length > 3) {
        return { success: false, message: 'The GEDCOM date point has an invalid shape.' };
    }

    const yearText = parts.at(-1) ?? '';

    if (!isAsciiDigits(yearText)) {
        return { success: false, message: 'The GEDCOM date year is invalid.' };
    }

    const year = Number(yearText);

    if (year < 1 || year > 9999) {
        return { success: false, message: 'The GEDCOM date year is outside supported bounds.' };
    }

    let month: number | null = null;
    let day: number | null = null;

    if (parts.length >= 2) {
        const monthText = parts.at(-2) ?? '';
        month = monthNumber(calendarResult.calendar, monthText);

        if (month === null) {
            return {
                success: false,
                message: `Month ${monthText} is invalid for the declared calendar.`,
            };
        }
    }

    if (parts.length === 3) {
        const dayText = parts[0] ?? '';

        if (!isAsciiDigits(dayText)) {
            return { success: false, message: 'The GEDCOM date day is invalid.' };
        }

        day = Number(dayText);

        if (day < 1 || day > 31) {
            return { success: false, message: 'The GEDCOM date day is outside supported bounds.' };
        }
    }

    return {
        success: true,
        point: {
            calendar: calendarResult.calendar,
            year,
            month,
            day,
            epoch,
        },
    };
}

function singlePointDate(
    originalText: string,
    kind: 'exact' | 'about' | 'calculated' | 'estimated' | 'interpreted' | 'before' | 'after',
    value: string,
    phrase: string | null = null,
): GedcomDateParseResult {
    const result = parseDatePoint(value);

    if (!result.success) {
        return failure(result.message);
    }

    return {
        success: true,
        date: {
            kind,
            first: result.point,
            second: null,
            phrase,
            originalText,
        },
    };
}

function twoPointDate(
    originalText: string,
    kind: 'between' | 'period',
    firstValue: string,
    secondValue: string,
): GedcomDateParseResult {
    const firstResult = parseDatePoint(firstValue);

    if (!firstResult.success) {
        return failure(firstResult.message);
    }

    const secondResult = parseDatePoint(secondValue);

    if (!secondResult.success) {
        return failure(secondResult.message);
    }

    return {
        success: true,
        date: {
            kind,
            first: firstResult.point,
            second: secondResult.point,
            phrase: null,
            originalText,
        },
    };
}

export function parseGedcom551Date(value: string): GedcomDateParseResult {
    if (value.length === 0) {
        return failure('A GEDCOM date value must not be empty.');
    }

    if (value.startsWith('(') && value.endsWith(')') && value.length > 2) {
        return {
            success: true,
            date: {
                kind: 'phrase',
                first: null,
                second: null,
                phrase: value.slice(1, -1),
                originalText: value,
            },
        };
    }

    if (value.startsWith('INT ')) {
        const phraseStart = value.indexOf(' (', 4);

        if (phraseStart === -1 || !value.endsWith(')')) {
            return failure('An interpreted GEDCOM date must contain a parenthesized phrase.');
        }

        return singlePointDate(
            value,
            'interpreted',
            value.slice(4, phraseStart),
            value.slice(phraseStart + 2, -1),
        );
    }

    const singlePointQualifiers = [
        ['ABT ', 'about'],
        ['CAL ', 'calculated'],
        ['EST ', 'estimated'],
        ['BEF ', 'before'],
        ['AFT ', 'after'],
    ] as const;

    for (const [prefix, kind] of singlePointQualifiers) {
        if (value.startsWith(prefix)) {
            return singlePointDate(value, kind, value.slice(prefix.length));
        }
    }

    if (value.startsWith('BET ')) {
        const separator = value.indexOf(' AND ', 4);

        if (separator === -1) {
            return failure('A GEDCOM date range must contain AND.');
        }

        return twoPointDate(
            value,
            'between',
            value.slice(4, separator),
            value.slice(separator + 5),
        );
    }

    if (value.startsWith('FROM ')) {
        const separator = value.indexOf(' TO ', 5);

        if (separator !== -1) {
            return twoPointDate(
                value,
                'period',
                value.slice(5, separator),
                value.slice(separator + 4),
            );
        }

        const result = parseDatePoint(value.slice(5));

        if (!result.success) {
            return failure(result.message);
        }

        return {
            success: true,
            date: {
                kind: 'period',
                first: result.point,
                second: null,
                phrase: null,
                originalText: value,
            },
        };
    }

    if (value.startsWith('TO ')) {
        const result = parseDatePoint(value.slice(3));

        if (!result.success) {
            return failure(result.message);
        }

        return {
            success: true,
            date: {
                kind: 'period',
                first: null,
                second: result.point,
                phrase: null,
                originalText: value,
            },
        };
    }

    return singlePointDate(value, 'exact', value);
}
