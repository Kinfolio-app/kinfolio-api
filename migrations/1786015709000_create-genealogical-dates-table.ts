import { PgType, type ColumnDefinitions, type MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

const SINGLE_POINT_KINDS = [
    'exact',
    'about',
    'calculated',
    'estimated',
    'interpreted',
    'before',
    'after',
] as const;

export async function up(pgm: MigrationBuilder): Promise<void> {
    pgm.createType('genealogical_date_kind', [
        ...SINGLE_POINT_KINDS,
        'between',
        'period',
        'phrase',
    ]);
    pgm.createType('genealogical_calendar', [
        'gregorian',
        'julian',
        'french_republican',
        'hebrew',
        'extension',
    ]);
    pgm.createType('genealogical_epoch', ['common', 'before_common']);

    pgm.createTable('genealogical_dates', {
        id: {
            type: PgType.UUID,
            primaryKey: true,
            notNull: true,
            default: pgm.func('gen_random_uuid()'),
        },
        kind: {
            type: 'genealogical_date_kind',
            notNull: true,
        },
        first_calendar: {
            type: 'genealogical_calendar',
        },
        first_calendar_tag: {
            type: PgType.TEXT,
        },
        first_year: {
            type: PgType.INTEGER,
        },
        first_month: {
            type: PgType.SMALLINT,
        },
        first_month_tag: {
            type: PgType.TEXT,
        },
        first_day: {
            type: PgType.SMALLINT,
        },
        first_epoch: {
            type: 'genealogical_epoch',
        },
        first_epoch_tag: {
            type: PgType.TEXT,
        },
        second_calendar: {
            type: 'genealogical_calendar',
        },
        second_calendar_tag: {
            type: PgType.TEXT,
        },
        second_year: {
            type: PgType.INTEGER,
        },
        second_month: {
            type: PgType.SMALLINT,
        },
        second_month_tag: {
            type: PgType.TEXT,
        },
        second_day: {
            type: PgType.SMALLINT,
        },
        second_epoch: {
            type: 'genealogical_epoch',
        },
        second_epoch_tag: {
            type: PgType.TEXT,
        },
        phrase: {
            type: PgType.TEXT,
        },
        original_text: {
            type: PgType.TEXT,
        },
        created_at: {
            type: PgType.TIMESTAMPTZ,
            notNull: true,
            default: pgm.func('now()'),
        },
    });

    pgm.addConstraint('genealogical_dates', 'genealogical_dates_first_point_consistent', {
        check: `
            (
                first_calendar IS NULL
                AND first_calendar_tag IS NULL
                AND first_year IS NULL
                AND first_month IS NULL
                AND first_month_tag IS NULL
                AND first_day IS NULL
                AND first_epoch IS NULL
                AND first_epoch_tag IS NULL
            )
            OR (
                first_calendar IS NOT NULL
                AND first_year IS NOT NULL
                AND first_epoch IS NOT NULL
            )
        `,
    });
    pgm.addConstraint('genealogical_dates', 'genealogical_dates_second_point_consistent', {
        check: `
            (
                second_calendar IS NULL
                AND second_calendar_tag IS NULL
                AND second_year IS NULL
                AND second_month IS NULL
                AND second_month_tag IS NULL
                AND second_day IS NULL
                AND second_epoch IS NULL
                AND second_epoch_tag IS NULL
            )
            OR (
                second_calendar IS NOT NULL
                AND second_year IS NOT NULL
                AND second_epoch IS NOT NULL
            )
        `,
    });
    pgm.addConstraint('genealogical_dates', 'genealogical_dates_component_ranges', {
        check: `
            (first_year IS NULL OR first_year >= 1)
            AND (second_year IS NULL OR second_year >= 1)
            AND (first_month IS NULL OR first_month BETWEEN 1 AND 13)
            AND (second_month IS NULL OR second_month BETWEEN 1 AND 13)
            AND (first_day IS NULL OR first_day BETWEEN 1 AND 36)
            AND (second_day IS NULL OR second_day BETWEEN 1 AND 36)
        `,
    });
    pgm.addConstraint('genealogical_dates', 'genealogical_dates_day_has_month', {
        check: `
            (first_day IS NULL OR first_month IS NOT NULL OR first_month_tag IS NOT NULL)
            AND (second_day IS NULL OR second_month IS NOT NULL OR second_month_tag IS NOT NULL)
        `,
    });
    pgm.addConstraint('genealogical_dates', 'genealogical_dates_text_not_blank', {
        check: `
            (phrase IS NULL OR NULLIF(BTRIM(phrase), '') IS NOT NULL)
            AND (first_calendar_tag IS NULL OR NULLIF(BTRIM(first_calendar_tag), '') IS NOT NULL)
            AND (first_month_tag IS NULL OR NULLIF(BTRIM(first_month_tag), '') IS NOT NULL)
            AND (first_epoch_tag IS NULL OR NULLIF(BTRIM(first_epoch_tag), '') IS NOT NULL)
            AND (second_calendar_tag IS NULL OR NULLIF(BTRIM(second_calendar_tag), '') IS NOT NULL)
            AND (second_month_tag IS NULL OR NULLIF(BTRIM(second_month_tag), '') IS NOT NULL)
            AND (second_epoch_tag IS NULL OR NULLIF(BTRIM(second_epoch_tag), '') IS NOT NULL)
        `,
    });
    pgm.addConstraint('genealogical_dates', 'genealogical_dates_shape', {
        check: `
            (
                kind IN (${SINGLE_POINT_KINDS.map((kind) => `'${kind}'`).join(', ')})
                AND first_calendar IS NOT NULL
                AND second_calendar IS NULL
            )
            OR (
                kind = 'between'
                AND first_calendar IS NOT NULL
                AND second_calendar IS NOT NULL
            )
            OR (
                kind = 'period'
                AND (first_calendar IS NOT NULL OR second_calendar IS NOT NULL)
            )
            OR (
                kind = 'phrase'
                AND first_calendar IS NULL
                AND second_calendar IS NULL
                AND NULLIF(BTRIM(phrase), '') IS NOT NULL
            )
        `,
    });

    pgm.addColumns('persons', {
        birth_date_id: {
            type: PgType.UUID,
            references: 'genealogical_dates',
            referencesConstraintName: 'persons_birth_date_id_fkey',
            onDelete: 'RESTRICT',
        },
        death_date_id: {
            type: PgType.UUID,
            references: 'genealogical_dates',
            referencesConstraintName: 'persons_death_date_id_fkey',
            onDelete: 'RESTRICT',
        },
    });

    pgm.sql(`
        WITH dates_to_migrate AS MATERIALIZED (
            SELECT
                id AS person_id,
                gen_random_uuid() AS date_id,
                birth_date AS value
            FROM persons
            WHERE birth_date IS NOT NULL
        ),
        inserted_dates AS (
            INSERT INTO genealogical_dates (
                id,
                kind,
                first_calendar,
                first_year,
                first_month,
                first_day,
                first_epoch,
                original_text
            )
            SELECT
                date_id,
                'exact',
                'gregorian',
                EXTRACT(YEAR FROM value)::INTEGER,
                EXTRACT(MONTH FROM value)::SMALLINT,
                EXTRACT(DAY FROM value)::SMALLINT,
                'common',
                TO_CHAR(value, 'YYYY-MM-DD')
            FROM dates_to_migrate
            RETURNING id
        )
        UPDATE persons AS person
        SET birth_date_id = date.date_id
        FROM dates_to_migrate AS date
        WHERE person.id = date.person_id
            AND EXISTS (
                SELECT 1
                FROM inserted_dates
                WHERE inserted_dates.id = date.date_id
            );
    `);

    pgm.sql(`
        WITH dates_to_migrate AS MATERIALIZED (
            SELECT
                id AS person_id,
                gen_random_uuid() AS date_id,
                death_date AS value
            FROM persons
            WHERE death_date IS NOT NULL
        ),
        inserted_dates AS (
            INSERT INTO genealogical_dates (
                id,
                kind,
                first_calendar,
                first_year,
                first_month,
                first_day,
                first_epoch,
                original_text
            )
            SELECT
                date_id,
                'exact',
                'gregorian',
                EXTRACT(YEAR FROM value)::INTEGER,
                EXTRACT(MONTH FROM value)::SMALLINT,
                EXTRACT(DAY FROM value)::SMALLINT,
                'common',
                TO_CHAR(value, 'YYYY-MM-DD')
            FROM dates_to_migrate
            RETURNING id
        )
        UPDATE persons AS person
        SET death_date_id = date.date_id
        FROM dates_to_migrate AS date
        WHERE person.id = date.person_id
            AND EXISTS (
                SELECT 1
                FROM inserted_dates
                WHERE inserted_dates.id = date.date_id
            );
    `);

    pgm.dropConstraint('persons', 'persons_dates_are_consistent');
    pgm.dropColumns('persons', ['birth_date', 'death_date']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
    pgm.addColumns('persons', {
        birth_date: {
            type: PgType.DATE,
        },
        death_date: {
            type: PgType.DATE,
        },
    });

    pgm.sql(`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM persons AS person
                JOIN genealogical_dates AS date
                    ON date.id IN (person.birth_date_id, person.death_date_id)
                WHERE date.kind <> 'exact'
                    OR date.first_calendar <> 'gregorian'
                    OR date.first_epoch <> 'common'
                    OR date.first_month IS NULL
                    OR date.first_day IS NULL
            ) THEN
                RAISE EXCEPTION 'Structured genealogical dates cannot be converted safely to DATE.';
            END IF;
        END
        $$;
    `);

    pgm.sql(`
        UPDATE persons AS person
        SET birth_date = MAKE_DATE(date.first_year, date.first_month, date.first_day)
        FROM genealogical_dates AS date
        WHERE date.id = person.birth_date_id;
    `);
    pgm.sql(`
        UPDATE persons AS person
        SET death_date = MAKE_DATE(date.first_year, date.first_month, date.first_day)
        FROM genealogical_dates AS date
        WHERE date.id = person.death_date_id;
    `);

    pgm.dropColumns('persons', ['birth_date_id', 'death_date_id']);
    pgm.dropTable('genealogical_dates');
    pgm.dropType('genealogical_epoch');
    pgm.dropType('genealogical_calendar');
    pgm.dropType('genealogical_date_kind');

    pgm.addConstraint('persons', 'persons_dates_are_consistent', {
        check: `
            birth_date IS NULL
            OR death_date IS NULL
            OR death_date >= birth_date
        `,
    });
}
