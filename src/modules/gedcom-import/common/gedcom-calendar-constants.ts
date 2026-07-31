export const GREGORIAN_AND_JULIAN_MONTHS = [
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

export type GregorianAndJulianMonthTag = (typeof GREGORIAN_AND_JULIAN_MONTHS)[number];

export const FRENCH_REPUBLICAN_MONTHS = [
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

export type FrenchRepublicanMonthTag = (typeof FRENCH_REPUBLICAN_MONTHS)[number];

export const HEBREW_MONTHS = [
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

export type HebrewMonthTag = (typeof HEBREW_MONTHS)[number];
