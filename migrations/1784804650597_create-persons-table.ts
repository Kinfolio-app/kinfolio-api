import { PgType, type ColumnDefinitions, type MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
    pgm.createType('living_status', ['unknown', 'living', 'deceased']);

    pgm.createTable('persons', {
        id: {
            type: PgType.UUID,
            primaryKey: true,
            notNull: true,
            default: pgm.func('gen_random_uuid()'),
        },
        first_name: {
            type: PgType.TEXT,
        },
        middle_names: {
            type: PgType.TEXT,
        },
        last_name: {
            type: PgType.TEXT,
        },
        birth_name: {
            type: PgType.TEXT,
        },
        birth_date: {
            type: PgType.DATE,
        },
        birth_place: {
            type: PgType.TEXT,
        },
        death_date: {
            type: PgType.DATE,
        },
        death_place: {
            type: PgType.TEXT,
        },
        living_status: {
            type: 'living_status',
            notNull: true,
            default: 'unknown',
        },
        biography: {
            type: PgType.TEXT,
        },
        created_at: {
            type: PgType.TIMESTAMPTZ,
            notNull: true,
            default: pgm.func('now()'),
        },
        updated_at: {
            type: PgType.TIMESTAMPTZ,
            notNull: true,
            default: pgm.func('now()'),
        },
    });

    pgm.addConstraint('persons', 'persons_has_name', {
        check: `
        NULLIF(BTRIM(first_name), '') IS NOT NULL
        OR NULLIF(BTRIM(last_name), '') IS NOT NULL
        OR NULLIF(BTRIM(birth_name), '') IS NOT NULL
    `,
    });

    pgm.addConstraint('persons', 'persons_dates_are_consistent', {
        check: `
        birth_date IS NULL
        OR death_date IS NULL
        OR death_date >= birth_date
    `,
    });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
    pgm.dropTable('persons');
    pgm.dropType('living_status');
}
