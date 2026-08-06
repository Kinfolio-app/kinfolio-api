export const GenealogicalCalendar = {
    Gregorian: 'gregorian',
    Julian: 'julian',
    FrenchRepublican: 'french_republican',
    Hebrew: 'hebrew',
    Extension: 'extension',
} as const;

export type GenealogicalCalendar = (typeof GenealogicalCalendar)[keyof typeof GenealogicalCalendar];

export const GenealogicalEpoch = {
    Common: 'common',
    BeforeCommon: 'before_common',
} as const;

export type GenealogicalEpoch = (typeof GenealogicalEpoch)[keyof typeof GenealogicalEpoch];

export const GenealogicalDateKind = {
    Exact: 'exact',
    About: 'about',
    Calculated: 'calculated',
    Estimated: 'estimated',
    Interpreted: 'interpreted',
    Before: 'before',
    After: 'after',
    Between: 'between',
    Period: 'period',
    Phrase: 'phrase',
} as const;

export type GenealogicalDateKind = (typeof GenealogicalDateKind)[keyof typeof GenealogicalDateKind];

export type GenealogicalDatePoint = {
    calendar: GenealogicalCalendar;
    calendarTag?: string | null;
    year: number;
    month: number | null;
    monthTag?: string | null;
    day: number | null;
    epoch: GenealogicalEpoch;
    epochTag?: string | null;
};

export type GenealogicalSinglePointDate = {
    kind:
        | typeof GenealogicalDateKind.Exact
        | typeof GenealogicalDateKind.About
        | typeof GenealogicalDateKind.Calculated
        | typeof GenealogicalDateKind.Estimated
        | typeof GenealogicalDateKind.Interpreted
        | typeof GenealogicalDateKind.Before
        | typeof GenealogicalDateKind.After;
    first: GenealogicalDatePoint;
    second: null;
    phrase: string | null;
    originalText: string | null;
};

export type GenealogicalBetweenDate = {
    kind: typeof GenealogicalDateKind.Between;
    first: GenealogicalDatePoint;
    second: GenealogicalDatePoint;
    phrase: string | null;
    originalText: string | null;
};

export type GenealogicalPeriodDate = {
    kind: typeof GenealogicalDateKind.Period;
    phrase: string | null;
    originalText: string | null;
} & (
    | {
          first: GenealogicalDatePoint;
          second: GenealogicalDatePoint | null;
      }
    | {
          first: null;
          second: GenealogicalDatePoint;
      }
);

export type GenealogicalPhraseDate = {
    kind: typeof GenealogicalDateKind.Phrase;
    first: null;
    second: null;
    phrase: string;
    originalText: string | null;
};

export type GenealogicalDate =
    | GenealogicalSinglePointDate
    | GenealogicalBetweenDate
    | GenealogicalPeriodDate
    | GenealogicalPhraseDate;
