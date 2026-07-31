import { isAsciiDigits } from '../common/gedcom-character-utils.js';
import {
    FRENCH_REPUBLICAN_MONTHS,
    GREGORIAN_AND_JULIAN_MONTHS,
    HEBREW_MONTHS,
} from '../common/gedcom-calendar-constants.js';
import {
    GEDCOM_DATE_PERIOD_KEYWORDS,
    GEDCOM_DATE_QUALIFIERS,
    GEDCOM_DATE_RANGE_KEYWORDS,
    dateKeywordPrefix,
    dateKeywordSeparator,
    type GenealogicalDateQualifierKind,
} from '../common/gedcom-date-constants.js';
import type {
    GenealogicalCalendar,
    GenealogicalDate,
    GenealogicalDatePoint,
} from '../common/gedcom-parser.types.js';
import {
    GEDCOM_7_CALENDARS,
    GEDCOM_7_DATE_SYNTAX,
    type Gedcom7CalendarTag,
} from './date-constants.js';

export type Gedcom7DateParseResult =
    { success: true; date: GenealogicalDate | null } | { success: false; message: string };

function failure(message: string): Gedcom7DateParseResult {
    return { success: false, message };
}

function calendarFromTag(tag: string): GenealogicalCalendar | null {
    return (
        GEDCOM_7_CALENDARS[tag as Gedcom7CalendarTag] ??
        (tag.startsWith(GEDCOM_7_DATE_SYNTAX.extensionTagPrefix) && tag.length > 1
            ? 'extension'
            : null)
    );
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

    if (
        possibleEpoch === GEDCOM_7_DATE_SYNTAX.beforeCommonEpoch ||
        possibleEpoch.startsWith(GEDCOM_7_DATE_SYNTAX.extensionTagPrefix)
    ) {
        epochTag = parts.pop() ?? null;
        epoch =
            possibleEpoch === GEDCOM_7_DATE_SYNTAX.beforeCommonEpoch ? 'before_common' : 'common';

        if (
            possibleEpoch === GEDCOM_7_DATE_SYNTAX.beforeCommonEpoch &&
            calendar !== 'gregorian' &&
            calendar !== 'julian'
        ) {
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
            if (!parsedMonthTag.startsWith(GEDCOM_7_DATE_SYNTAX.extensionTagPrefix)) {
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
    kind: 'exact' | GenealogicalDateQualifierKind,
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

    for (const { keyword, kind } of GEDCOM_DATE_QUALIFIERS) {
        const prefix = dateKeywordPrefix(keyword);
        if (value.startsWith(prefix)) {
            return singlePoint(value, kind, value.slice(prefix.length), phrase);
        }
    }

    const betweenPrefix = dateKeywordPrefix(GEDCOM_DATE_RANGE_KEYWORDS.between);
    const andSeparator = dateKeywordSeparator(GEDCOM_DATE_RANGE_KEYWORDS.and);

    if (value.startsWith(betweenPrefix)) {
        const separator = value.indexOf(andSeparator, betweenPrefix.length);
        return separator === -1
            ? failure('A GEDCOM 7 date range must contain AND.')
            : twoPoints(
                  value,
                  'between',
                  value.slice(betweenPrefix.length, separator),
                  value.slice(separator + andSeparator.length),
                  phrase,
              );
    }

    const fromPrefix = dateKeywordPrefix(GEDCOM_DATE_PERIOD_KEYWORDS.from);
    const toSeparator = dateKeywordSeparator(GEDCOM_DATE_PERIOD_KEYWORDS.to);

    if (value.startsWith(fromPrefix)) {
        const separator = value.indexOf(toSeparator, fromPrefix.length);
        if (separator !== -1) {
            return twoPoints(
                value,
                'period',
                value.slice(fromPrefix.length, separator),
                value.slice(separator + toSeparator.length),
                phrase,
            );
        }
        const first = parsePoint(value.slice(fromPrefix.length));
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

    const toPrefix = dateKeywordPrefix(GEDCOM_DATE_PERIOD_KEYWORDS.to);

    if (value.startsWith(toPrefix)) {
        const second = parsePoint(value.slice(toPrefix.length));
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
