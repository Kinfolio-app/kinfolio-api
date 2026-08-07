import type { Pool } from 'pg';
import type { GenealogicalDate, GenealogicalDatePoint } from './genealogical-date.types.js';

type Database = Pick<Pool, 'query'>;

function normalizePoint(point: GenealogicalDatePoint): GenealogicalDatePoint {
    return {
        calendar: point.calendar,
        calendarTag: point.calendarTag ?? null,
        year: point.year,
        month: point.month,
        monthTag: point.monthTag ?? null,
        day: point.day,
        epoch: point.epoch,
        epochTag: point.epochTag ?? null,
    };
}

export function normalizeGenealogicalDate(date: GenealogicalDate): GenealogicalDate {
    return {
        ...date,
        first: date.first === null ? null : normalizePoint(date.first),
        second: date.second === null ? null : normalizePoint(date.second),
    } as GenealogicalDate;
}

function pointValues(point: GenealogicalDatePoint | null): (string | number | null)[] {
    if (point === null) {
        return [null, null, null, null, null, null, null, null];
    }

    return [
        point.calendar,
        point.calendarTag ?? null,
        point.year,
        point.month,
        point.monthTag ?? null,
        point.day,
        point.epoch,
        point.epochTag ?? null,
    ];
}

export function selectGenealogicalDate(alias: string): string {
    const point = (position: 'first' | 'second') => `
        CASE
            WHEN ${alias}.${position}_calendar IS NULL THEN NULL
            ELSE jsonb_build_object(
                'calendar', ${alias}.${position}_calendar,
                'calendarTag', ${alias}.${position}_calendar_tag,
                'year', ${alias}.${position}_year,
                'month', ${alias}.${position}_month,
                'monthTag', ${alias}.${position}_month_tag,
                'day', ${alias}.${position}_day,
                'epoch', ${alias}.${position}_epoch,
                'epochTag', ${alias}.${position}_epoch_tag
            )
        END
    `;

    return `
        CASE
            WHEN ${alias}.id IS NULL THEN NULL
            ELSE jsonb_build_object(
                'kind', ${alias}.kind,
                'first', ${point('first')},
                'second', ${point('second')},
                'phrase', ${alias}.phrase,
                'originalText', ${alias}.original_text
            )
        END
    `;
}

export class GenealogicalDateRepository {
    constructor(private readonly database: Database) {}

    async create(date: GenealogicalDate): Promise<string> {
        const normalizedDate = normalizeGenealogicalDate(date);
        const { rows } = await this.database.query<{ id: string }>(
            `INSERT INTO genealogical_dates (
                kind,
                first_calendar,
                first_calendar_tag,
                first_year,
                first_month,
                first_month_tag,
                first_day,
                first_epoch,
                first_epoch_tag,
                second_calendar,
                second_calendar_tag,
                second_year,
                second_month,
                second_month_tag,
                second_day,
                second_epoch,
                second_epoch_tag,
                phrase,
                original_text
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19
            )
            RETURNING id`,
            [
                normalizedDate.kind,
                ...pointValues(normalizedDate.first),
                ...pointValues(normalizedDate.second),
                normalizedDate.phrase,
                normalizedDate.originalText,
            ],
        );
        const row = rows[0];

        if (row === undefined) {
            throw new Error('PostgreSQL did not return the created genealogical date.');
        }

        return row.id;
    }

    async deleteOrphaned(ids: string[]): Promise<void> {
        if (ids.length === 0) {
            return;
        }

        await this.database.query(
            `DELETE FROM genealogical_dates AS date
            WHERE date.id = ANY($1::uuid[])
                AND NOT EXISTS (
                    SELECT 1
                    FROM persons AS person
                    WHERE person.birth_date_id = date.id
                        OR person.death_date_id = date.id
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM couple_relationship_events AS event
                    WHERE event.date_id = date.id
                )`,
            [ids],
        );
    }
}
