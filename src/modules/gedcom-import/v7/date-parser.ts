import { isAsciiDigits } from '../common/gedcom-character-utils.js';
import {
    FRENCH_REPUBLICAN_MONTHS,
    GREGORIAN_AND_JULIAN_MONTHS,
    HEBREW_MONTHS,
} from '../common/gedcom-calendar-constants.js';
import type {
    GenealogicalCalendar,
    GenealogicalDate,
    GenealogicalDatePoint,
} from '../common/gedcom-parser.types.js';

export type Gedcom7DateParseResult =
    { success: true; date: GenealogicalDate | null } | { success: false; message: string };

function failure(message: string): Gedcom7DateParseResult {
    return { success: false, message };
}

function calendarFromTag(tag: string): GenealogicalCalendar | null {
    if (tag === 'GREGORIAN') return 'gregorian';
    if (tag === 'JULIAN') return 'julian';
    if (tag === 'FRENCH_R') return 'french_republican';
    if (tag === 'HEBREW') return 'hebrew';
    if (tag.startsWith('_') && tag.length > 1) return 'extension';
    return null;
}

function monthTags(calendar: GenealogicalCalendar): readonly string[] {
    if (calendar === 'french_republican') return FRENCH_REPUBLICAN_MONTHS;
    if (calendar === 'hebrew') return HEBREW_MONTHS;
    return GREGORIAN_AND_JULIAN_MONTHS;
}

function maximumDay(calendar: GenealogicalCalendar, month: number | null, year: number): number {
    if (month === null || calendar === 'extension') return 36;
    if (calendar === 'french_republican') return month === 13 ? 6 : 30;
    if (calendar === 'hebrew') return 30;

    if (month === 2) {
        const leap =
            calendar === 'julian'
                ? year % 4 === 0
                : year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        return leap ? 29 : 28;
    }

    return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parsePoint(
    value: string,
): { success: true; point: GenealogicalDatePoint } | { success: false; message: string } {
    const parts = value.split(' ');

    if (parts.some((part) => part.length === 0)) {
        return { success: false, message: 'The GEDCOM 7 date contains invalid spacing.' };
    }

    let calendar: GenealogicalCalendar = 'gregorian';
    let calendarTag: string | null = null;
    const declaredCalendar = calendarFromTag(parts[0] ?? '');

    if (declaredCalendar !== null) {
        calendar = declaredCalendar;
        calendarTag = parts.shift() ?? null;
    }

    let epoch: GenealogicalDatePoint['epoch'] = 'common';
    let epochTag: string | null = null;
    const possibleEpoch = parts.at(-1) ?? '';

    if (possibleEpoch === 'BCE' || possibleEpoch.startsWith('_')) {
        epochTag = parts.pop() ?? null;
        epoch = possibleEpoch === 'BCE' ? 'before_common' : 'common';

        if (possibleEpoch === 'BCE' && calendar !== 'gregorian' && calendar !== 'julian') {
            return { success: false, message: 'BCE is only valid with Gregorian or Julian dates.' };
        }
    }

    if (parts.length < 1 || parts.length > 3) {
        return { success: false, message: 'The GEDCOM 7 date point has an invalid shape.' };
    }

    const yearText = parts.at(-1) ?? '';
    if (!isAsciiDigits(yearText) || Number(yearText) < 1) {
        return { success: false, message: 'The GEDCOM 7 date year is invalid.' };
    }

    const year = Number(yearText);
    if (!Number.isSafeInteger(year)) {
        return { success: false, message: 'The GEDCOM 7 date year is outside safe bounds.' };
    }
    let month: number | null = null;
    let monthTag: string | null = null;

    if (parts.length >= 2) {
        const parsedMonthTag = parts.at(-2) ?? '';
        monthTag = parsedMonthTag;

        if (calendar === 'extension') {
            if (!parsedMonthTag.startsWith('_')) {
                return {
                    success: false,
                    message: 'An extension calendar must use an extension month tag.',
                };
            }
        } else {
            const monthIndex = monthTags(calendar).indexOf(parsedMonthTag);
            if (monthIndex === -1) {
                return {
                    success: false,
                    message: `Month ${monthTag} is invalid for the declared calendar.`,
                };
            }
            month = monthIndex + 1;
        }
    }

    let day: number | null = null;
    if (parts.length === 3) {
        const dayText = parts[0] ?? '';
        if (!isAsciiDigits(dayText)) {
            return { success: false, message: 'The GEDCOM 7 date day is invalid.' };
        }
        day = Number(dayText);
        if (day < 1 || day > maximumDay(calendar, month, year)) {
            return { success: false, message: 'The GEDCOM 7 date day is outside valid bounds.' };
        }
    }

    return {
        success: true,
        point: { calendar, calendarTag, year, month, monthTag, day, epoch, epochTag },
    };
}

function singlePoint(
    originalText: string,
    kind: 'exact' | 'about' | 'calculated' | 'estimated' | 'before' | 'after',
    value: string,
    phrase: string | null,
): Gedcom7DateParseResult {
    const result = parsePoint(value);
    return result.success
        ? {
              success: true,
              date: { kind, first: result.point, second: null, phrase, originalText },
          }
        : failure(result.message);
}

function twoPoints(
    originalText: string,
    kind: 'between' | 'period',
    firstValue: string,
    secondValue: string,
    phrase: string | null,
): Gedcom7DateParseResult {
    const first = parsePoint(firstValue);
    if (!first.success) return failure(first.message);
    const second = parsePoint(secondValue);
    if (!second.success) return failure(second.message);

    return {
        success: true,
        date: { kind, first: first.point, second: second.point, phrase, originalText },
    };
}

export function parseGedcom7Date(
    value: string | null,
    phrase: string | null = null,
): Gedcom7DateParseResult {
    if (value === null) {
        return phrase === null
            ? { success: true, date: null }
            : {
                  success: true,
                  date: { kind: 'phrase', first: null, second: null, phrase, originalText: phrase },
              };
    }

    const qualifiers = [
        ['ABT ', 'about'],
        ['CAL ', 'calculated'],
        ['EST ', 'estimated'],
        ['BEF ', 'before'],
        ['AFT ', 'after'],
    ] as const;

    for (const [prefix, kind] of qualifiers) {
        if (value.startsWith(prefix)) {
            return singlePoint(value, kind, value.slice(prefix.length), phrase);
        }
    }

    if (value.startsWith('BET ')) {
        const separator = value.indexOf(' AND ', 4);
        return separator === -1
            ? failure('A GEDCOM 7 date range must contain AND.')
            : twoPoints(
                  value,
                  'between',
                  value.slice(4, separator),
                  value.slice(separator + 5),
                  phrase,
              );
    }

    if (value.startsWith('FROM ')) {
        const separator = value.indexOf(' TO ', 5);
        if (separator !== -1) {
            return twoPoints(
                value,
                'period',
                value.slice(5, separator),
                value.slice(separator + 4),
                phrase,
            );
        }
        const first = parsePoint(value.slice(5));
        return first.success
            ? {
                  success: true,
                  date: {
                      kind: 'period',
                      first: first.point,
                      second: null,
                      phrase,
                      originalText: value,
                  },
              }
            : failure(first.message);
    }

    if (value.startsWith('TO ')) {
        const second = parsePoint(value.slice(3));
        return second.success
            ? {
                  success: true,
                  date: {
                      kind: 'period',
                      first: null,
                      second: second.point,
                      phrase,
                      originalText: value,
                  },
              }
            : failure(second.message);
    }

    return singlePoint(value, 'exact', value, phrase);
}
