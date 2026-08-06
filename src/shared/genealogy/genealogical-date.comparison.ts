import {
    GenealogicalCalendar,
    GenealogicalDateKind,
    GenealogicalEpoch,
    type GenealogicalDate,
    type GenealogicalDatePoint,
} from './genealogical-date.types.js';

type DateRange = {
    earliest: number;
    latest: number;
};

function daysInGregorianMonth(year: number, month: number): number {
    if (month === 2) {
        const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

        return isLeapYear ? 29 : 28;
    }

    return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function comparablePointRange(point: GenealogicalDatePoint): DateRange | null {
    if (
        point.calendar !== GenealogicalCalendar.Gregorian ||
        point.epoch !== GenealogicalEpoch.Common
    ) {
        return null;
    }

    const earliestMonth = point.month ?? 1;
    const latestMonth = point.month ?? 12;
    const earliestDay = point.day ?? 1;
    const latestDay = point.day ?? daysInGregorianMonth(point.year, latestMonth);
    const toSortableNumber = (month: number, day: number) =>
        point.year * 10_000 + month * 100 + day;

    return {
        earliest: toSortableNumber(earliestMonth, earliestDay),
        latest: toSortableNumber(latestMonth, latestDay),
    };
}

function comparableDateRange(date: GenealogicalDate): DateRange | null {
    if (date.kind === GenealogicalDateKind.Exact) {
        return comparablePointRange(date.first);
    }

    if (date.kind === GenealogicalDateKind.Between) {
        const first = comparablePointRange(date.first);
        const second = comparablePointRange(date.second);

        if (first === null || second === null || first.earliest > second.latest) {
            return null;
        }

        return {
            earliest: first.earliest,
            latest: second.latest,
        };
    }

    return null;
}

export function compareGenealogicalDates(
    left: GenealogicalDate,
    right: GenealogicalDate,
): -1 | 0 | 1 | null {
    const leftRange = comparableDateRange(left);
    const rightRange = comparableDateRange(right);

    if (leftRange === null || rightRange === null) {
        return null;
    }

    if (leftRange.latest < rightRange.earliest) {
        return -1;
    }

    if (leftRange.earliest > rightRange.latest) {
        return 1;
    }

    if (
        leftRange.earliest === leftRange.latest &&
        leftRange.earliest === rightRange.earliest &&
        rightRange.earliest === rightRange.latest
    ) {
        return 0;
    }

    return null;
}
