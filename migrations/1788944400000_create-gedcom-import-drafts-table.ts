import { PgType, type ColumnDefinitions, type MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
    pgm.createType('gedcom_import_draft_status', ['blocked', 'needs_resolution', 'ready']);

    pgm.createTable('gedcom_import_drafts', {
        id: {
            type: PgType.UUID,
            primaryKey: true,
            notNull: true,
            default: pgm.func('gen_random_uuid()'),
        },
        source_id: {
            type: PgType.UUID,
            notNull: true,
            references: 'gedcom_import_sources',
            referencesConstraintName: 'gedcom_import_drafts_source_id_fkey',
            onDelete: 'RESTRICT',
        },
        status: {
            type: 'gedcom_import_draft_status',
            notNull: true,
        },
        file_sha256: {
            type: PgType.BYTEA,
            notNull: true,
        },
        file_content: {
            type: PgType.BYTEA,
            notNull: true,
        },
        gedcom_version: {
            type: PgType.TEXT,
            notNull: true,
        },
        plan: {
            type: PgType.JSONB,
            notNull: true,
        },
        resolutions: {
            type: PgType.JSONB,
            notNull: true,
            default: pgm.func("'{}'::jsonb"),
        },
        base_versions: {
            type: PgType.JSONB,
            notNull: true,
            default: pgm.func("'{}'::jsonb"),
        },
        revision: {
            type: PgType.INTEGER,
            notNull: true,
            default: 0,
        },
        expires_at: {
            type: PgType.TIMESTAMPTZ,
            notNull: true,
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

    pgm.addConstraint('gedcom_import_drafts', 'gedcom_import_drafts_sha256_length', {
        check: 'OCTET_LENGTH(file_sha256) = 32',
    });
    pgm.addConstraint('gedcom_import_drafts', 'gedcom_import_drafts_file_not_empty', {
        check: 'OCTET_LENGTH(file_content) > 0',
    });
    pgm.addConstraint('gedcom_import_drafts', 'gedcom_import_drafts_version_not_blank', {
        check: "NULLIF(BTRIM(gedcom_version), '') IS NOT NULL",
    });
    pgm.addConstraint('gedcom_import_drafts', 'gedcom_import_drafts_json_objects', {
        check: `
            JSONB_TYPEOF(plan) = 'object'
            AND JSONB_TYPEOF(resolutions) = 'object'
            AND JSONB_TYPEOF(base_versions) = 'object'
        `,
    });
    pgm.addConstraint('gedcom_import_drafts', 'gedcom_import_drafts_revision_non_negative', {
        check: 'revision >= 0',
    });
    pgm.addConstraint('gedcom_import_drafts', 'gedcom_import_drafts_expiration_after_creation', {
        check: 'expires_at > created_at',
    });

    pgm.createIndex('gedcom_import_drafts', 'source_id', {
        name: 'gedcom_import_drafts_source_id_idx',
    });
    pgm.createIndex('gedcom_import_drafts', 'expires_at', {
        name: 'gedcom_import_drafts_expires_at_idx',
    });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
    pgm.dropTable('gedcom_import_drafts');
    pgm.dropType('gedcom_import_draft_status');
}
