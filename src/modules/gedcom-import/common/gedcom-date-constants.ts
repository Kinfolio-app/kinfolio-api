import type { GenealogicalDate } from '../../../shared/genealogy/genealogical-date.types.js';

export const GEDCOM_DATE_QUALIFIERS = [
    { keyword: 'ABT', kind: 'about' },
    { keyword: 'CAL', kind: 'calculated' },
    { keyword: 'EST', kind: 'estimated' },
    { keyword: 'BEF', kind: 'before' },
    { keyword: 'AFT', kind: 'after' },
] as const satisfies readonly {
    keyword: string;
    kind: GenealogicalDate['kind'];
}[];

export type GedcomDateQualifierKeyword = (typeof GEDCOM_DATE_QUALIFIERS)[number]['keyword'];
export type GenealogicalDateQualifierKind = (typeof GEDCOM_DATE_QUALIFIERS)[number]['kind'];

export const GEDCOM_DATE_RANGE_KEYWORDS = {
    between: 'BET',
    and: 'AND',
} as const;

export type GedcomDateRangeKeyword =
    (typeof GEDCOM_DATE_RANGE_KEYWORDS)[keyof typeof GEDCOM_DATE_RANGE_KEYWORDS];

export const GEDCOM_DATE_PERIOD_KEYWORDS = {
    from: 'FROM',
    to: 'TO',
} as const;

export type GedcomDatePeriodKeyword =
    (typeof GEDCOM_DATE_PERIOD_KEYWORDS)[keyof typeof GEDCOM_DATE_PERIOD_KEYWORDS];

export function dateKeywordPrefix(keyword: string): string {
    return `${keyword} `;
}

export function dateKeywordSeparator(keyword: string): string {
    return ` ${keyword} `;
}
