import { PgType, type ColumnDefinitions, type MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

const COUPLE_RELATIONSHIP_EVENT_TYPES = [
    'engagement',
    'marriage',
    'civil_union',
    'separation',
    'divorce',
    'annulment',
    'other',
] as const;

export async function up(pgm: MigrationBuilder): Promise<void> {
    pgm.createType('couple_relationship_event_type', [...COUPLE_RELATIONSHIP_EVENT_TYPES]);

    pgm.createTable('couple_relationships', {
        id: {
            type: PgType.UUID,
            primaryKey: true,
            notNull: true,
            default: pgm.func('gen_random_uuid()'),
        },
        partner_1_id: {
            type: PgType.UUID,
            notNull: true,
            references: 'persons',
            referencesConstraintName: 'couple_relationships_partner_1_id_fkey',
            onDelete: 'RESTRICT',
        },
        partner_2_id: {
            type: PgType.UUID,
            notNull: true,
            references: 'persons',
            referencesConstraintName: 'couple_relationships_partner_2_id_fkey',
            onDelete: 'RESTRICT',
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

    pgm.addConstraint('couple_relationships', 'couple_relationships_canonical_partners', {
        check: 'partner_1_id < partner_2_id',
    });

    pgm.createIndex('couple_relationships', 'partner_1_id', {
        name: 'couple_relationships_partner_1_id_idx',
    });
    pgm.createIndex('couple_relationships', 'partner_2_id', {
        name: 'couple_relationships_partner_2_id_idx',
    });

    pgm.createTable('couple_relationship_events', {
        id: {
            type: PgType.UUID,
            primaryKey: true,
            notNull: true,
            default: pgm.func('gen_random_uuid()'),
        },
        couple_relationship_id: {
            type: PgType.UUID,
            notNull: true,
            references: 'couple_relationships',
            referencesConstraintName: 'couple_relationship_events_relationship_id_fkey',
            onDelete: 'RESTRICT',
        },
        event_type: {
            type: 'couple_relationship_event_type',
            notNull: true,
        },
        date_id: {
            type: PgType.UUID,
            references: 'genealogical_dates',
            referencesConstraintName: 'couple_relationship_events_date_id_fkey',
            onDelete: 'RESTRICT',
        },
        place: {
            type: PgType.TEXT,
        },
        description: {
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

    pgm.addConstraint('couple_relationship_events', 'couple_relationship_events_text_not_blank', {
        check: `
                (place IS NULL OR NULLIF(BTRIM(place), '') IS NOT NULL)
                AND (description IS NULL OR NULLIF(BTRIM(description), '') IS NOT NULL)
            `,
    });

    pgm.createIndex('couple_relationship_events', 'couple_relationship_id', {
        name: 'couple_relationship_events_relationship_id_idx',
    });
    pgm.createIndex('couple_relationship_events', 'date_id', {
        name: 'couple_relationship_events_date_id_idx',
    });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
    pgm.dropTable('couple_relationship_events');
    pgm.dropTable('couple_relationships');
    pgm.dropType('couple_relationship_event_type');
}
