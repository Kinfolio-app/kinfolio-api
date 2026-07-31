import type { GenealogicalCalendar } from '../common/gedcom-parser.types.js';

export const GEDCOM_7_CALENDARS = {
    GREGORIAN: 'gregorian',
    JULIAN: 'julian',
    FRENCH_R: 'french_republican',
    HEBREW: 'hebrew',
} as const satisfies Readonly<Record<string, GenealogicalCalendar>>;

export type Gedcom7CalendarTag = keyof typeof GEDCOM_7_CALENDARS;

export const GEDCOM_7_DATE_SYNTAX = {
    beforeCommonEpoch: 'BCE',
    extensionTagPrefix: '_',
    phraseTag: 'PHRASE',
} as const;
