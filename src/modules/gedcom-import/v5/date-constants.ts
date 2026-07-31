import type { GenealogicalCalendar } from '../common/gedcom-parser.types.js';

export const GEDCOM_551_CALENDARS = {
    GREGORIAN: 'gregorian',
    JULIAN: 'julian',
    HEBREW: 'hebrew',
    'FRENCH R': 'french_republican',
} as const satisfies Readonly<Record<string, GenealogicalCalendar>>;

export type Gedcom551CalendarTag = keyof typeof GEDCOM_551_CALENDARS;

export const GEDCOM_551_DATE_SYNTAX = {
    calendarEscapePrefix: '@#D',
    calendarEscapeTerminator: '@',
    beforeCommonEpoch: 'B.C.',
    interpreted: 'INT',
    phraseOpening: '(',
    phraseClosing: ')',
    interpretedPhraseSeparator: ' (',
} as const;
