import type {
    GenealogicalCalendar,
    GenealogicalDate,
    GenealogicalDatePoint,
} from '../../../shared/genealogy/genealogical-date.types.js';
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
import {
    GEDCOM_551_CALENDARS,
    GEDCOM_551_DATE_SYNTAX,
    type Gedcom551CalendarTag,
} from './date-constants.js';

export type GedcomDateParseResult =
    | {
          success: true;
          date: GenealogicalDate;
      }
    | {
          success: false;
          message: string;
      };

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
    if (!value.startsWith(GEDCOM_551_DATE_SYNTAX.calendarEscapePrefix)) {
        return { success: true, calendar: 'gregorian', dateText: value };
    }

    const escapeEnd = value.indexOf(
        GEDCOM_551_DATE_SYNTAX.calendarEscapeTerminator,
        GEDCOM_551_DATE_SYNTAX.calendarEscapePrefix.length,
    );

    if (escapeEnd === -1 || value[escapeEnd + 1] !== ' ') {
        return { success: false, message: 'The GEDCOM calendar escape is invalid.' };
    }

    const calendarName = value.slice(GEDCOM_551_DATE_SYNTAX.calendarEscapePrefix.length, escapeEnd);
    const calendar = GEDCOM_551_CALENDARS[calendarName as Gedcom551CalendarTag] ?? null;

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

    if (parts.at(-1) === GEDCOM_551_DATE_SYNTAX.beforeCommonEpoch) {
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
    kind: 'exact' | 'interpreted' | GenealogicalDateQualifierKind,
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

    if (
        value.startsWith(GEDCOM_551_DATE_SYNTAX.phraseOpening) &&
        value.endsWith(GEDCOM_551_DATE_SYNTAX.phraseClosing) &&
        value.length > 2
    ) {
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

    const interpretedPrefix = dateKeywordPrefix(GEDCOM_551_DATE_SYNTAX.interpreted);

    if (value.startsWith(interpretedPrefix)) {
        const phraseStart = value.indexOf(
            GEDCOM_551_DATE_SYNTAX.interpretedPhraseSeparator,
            interpretedPrefix.length,
        );

        if (phraseStart === -1 || !value.endsWith(GEDCOM_551_DATE_SYNTAX.phraseClosing)) {
            return failure('An interpreted GEDCOM date must contain a parenthesized phrase.');
        }

        return singlePointDate(
            value,
            'interpreted',
            value.slice(interpretedPrefix.length, phraseStart),
            value.slice(
                phraseStart + GEDCOM_551_DATE_SYNTAX.interpretedPhraseSeparator.length,
                -GEDCOM_551_DATE_SYNTAX.phraseClosing.length,
            ),
        );
    }

    for (const { keyword, kind } of GEDCOM_DATE_QUALIFIERS) {
        const prefix = dateKeywordPrefix(keyword);
        if (value.startsWith(prefix)) {
            return singlePointDate(value, kind, value.slice(prefix.length));
        }
    }

    const betweenPrefix = dateKeywordPrefix(GEDCOM_DATE_RANGE_KEYWORDS.between);
    const andSeparator = dateKeywordSeparator(GEDCOM_DATE_RANGE_KEYWORDS.and);

    if (value.startsWith(betweenPrefix)) {
        const separator = value.indexOf(andSeparator, betweenPrefix.length);

        if (separator === -1) {
            return failure('A GEDCOM date range must contain AND.');
        }

        return twoPointDate(
            value,
            'between',
            value.slice(betweenPrefix.length, separator),
            value.slice(separator + andSeparator.length),
        );
    }

    const fromPrefix = dateKeywordPrefix(GEDCOM_DATE_PERIOD_KEYWORDS.from);
    const toSeparator = dateKeywordSeparator(GEDCOM_DATE_PERIOD_KEYWORDS.to);

    if (value.startsWith(fromPrefix)) {
        const separator = value.indexOf(toSeparator, fromPrefix.length);

        if (separator !== -1) {
            return twoPointDate(
                value,
                'period',
                value.slice(fromPrefix.length, separator),
                value.slice(separator + toSeparator.length),
            );
        }

        const result = parseDatePoint(value.slice(fromPrefix.length));

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

    const toPrefix = dateKeywordPrefix(GEDCOM_DATE_PERIOD_KEYWORDS.to);

    if (value.startsWith(toPrefix)) {
        const result = parseDatePoint(value.slice(toPrefix.length));

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
