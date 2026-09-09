import { PgType, type ColumnDefinitions, type MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

function createTimestamps(pgm: MigrationBuilder): ColumnDefinitions {
    return {
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
    };
}

export async function up(pgm: MigrationBuilder): Promise<void> {
    pgm.createTable('gedcom_import_sources', {
        id: {
            type: PgType.UUID,
            primaryKey: true,
            notNull: true,
            default: pgm.func('gen_random_uuid()'),
        },
        name: {
            type: PgType.TEXT,
            notNull: true,
        },
        ...createTimestamps(pgm),
    });

    pgm.addConstraint('gedcom_import_sources', 'gedcom_import_sources_name_not_blank', {
        check: "NULLIF(BTRIM(name), '') IS NOT NULL",
    });

    pgm.createTable('gedcom_import_runs', {
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
            referencesConstraintName: 'gedcom_import_runs_source_id_fkey',
            onDelete: 'RESTRICT',
        },
        file_sha256: {
            type: PgType.BYTEA,
            notNull: true,
        },
        gedcom_version: {
            type: PgType.TEXT,
            notNull: true,
        },
        report: {
            type: PgType.JSONB,
            notNull: true,
        },
        created_at: {
            type: PgType.TIMESTAMPTZ,
            notNull: true,
            default: pgm.func('now()'),
        },
    });

    pgm.addConstraint('gedcom_import_runs', 'gedcom_import_runs_sha256_length', {
        check: 'OCTET_LENGTH(file_sha256) = 32',
    });
    pgm.addConstraint('gedcom_import_runs', 'gedcom_import_runs_version_not_blank', {
        check: "NULLIF(BTRIM(gedcom_version), '') IS NOT NULL",
    });
    pgm.addConstraint('gedcom_import_runs', 'gedcom_import_runs_source_fingerprint_unique', {
        unique: ['source_id', 'file_sha256'],
    });
    pgm.addConstraint('gedcom_import_runs', 'gedcom_import_runs_source_id_id_unique', {
        unique: ['source_id', 'id'],
    });

    pgm.createTable('gedcom_individual_links', {
        source_id: {
            type: PgType.UUID,
            notNull: true,
            references: 'gedcom_import_sources',
            referencesConstraintName: 'gedcom_individual_links_source_id_fkey',
            onDelete: 'RESTRICT',
        },
        gedcom_id: {
            type: PgType.TEXT,
            notNull: true,
        },
        person_id: {
            type: PgType.UUID,
            notNull: true,
            references: 'persons',
            referencesConstraintName: 'gedcom_individual_links_person_id_fkey',
            onDelete: 'RESTRICT',
        },
        identifiers: {
            type: PgType.JSONB,
            notNull: true,
            default: pgm.func("'[]'::jsonb"),
        },
        last_imported_data: {
            type: PgType.JSONB,
            notNull: true,
        },
        last_seen_run_id: {
            type: PgType.UUID,
            notNull: true,
        },
        ...createTimestamps(pgm),
    });

    pgm.addConstraint('gedcom_individual_links', 'gedcom_individual_links_pkey', {
        primaryKey: ['source_id', 'gedcom_id'],
    });
    pgm.addConstraint('gedcom_individual_links', 'gedcom_individual_links_id_not_blank', {
        check: "NULLIF(BTRIM(gedcom_id), '') IS NOT NULL",
    });
    pgm.addConstraint('gedcom_individual_links', 'gedcom_individual_links_identifiers_array', {
        check: "JSONB_TYPEOF(identifiers) = 'array'",
    });
    pgm.addConstraint(
        'gedcom_individual_links',
        'gedcom_individual_links_source_run_fkey',
        'FOREIGN KEY (source_id, last_seen_run_id) REFERENCES gedcom_import_runs (source_id, id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED',
    );
    pgm.createIndex('gedcom_individual_links', 'person_id', {
        name: 'gedcom_individual_links_person_id_idx',
    });

    pgm.createTable('gedcom_family_links', {
        source_id: {
            type: PgType.UUID,
            notNull: true,
            references: 'gedcom_import_sources',
            referencesConstraintName: 'gedcom_family_links_source_id_fkey',
            onDelete: 'RESTRICT',
        },
        gedcom_id: {
            type: PgType.TEXT,
            notNull: true,
        },
        couple_relationship_id: {
            type: PgType.UUID,
            references: 'couple_relationships',
            referencesConstraintName: 'gedcom_family_links_couple_relationship_id_fkey',
            onDelete: 'RESTRICT',
        },
        last_imported_data: {
            type: PgType.JSONB,
            notNull: true,
        },
        last_seen_run_id: {
            type: PgType.UUID,
            notNull: true,
        },
        ...createTimestamps(pgm),
    });

    pgm.addConstraint('gedcom_family_links', 'gedcom_family_links_pkey', {
        primaryKey: ['source_id', 'gedcom_id'],
    });
    pgm.addConstraint('gedcom_family_links', 'gedcom_family_links_id_not_blank', {
        check: "NULLIF(BTRIM(gedcom_id), '') IS NOT NULL",
    });
    pgm.addConstraint(
        'gedcom_family_links',
        'gedcom_family_links_source_run_fkey',
        'FOREIGN KEY (source_id, last_seen_run_id) REFERENCES gedcom_import_runs (source_id, id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED',
    );
    pgm.createIndex('gedcom_family_links', 'couple_relationship_id', {
        name: 'gedcom_family_links_couple_relationship_id_idx',
    });

    pgm.createTable('gedcom_parent_child_links', {
        source_id: {
            type: PgType.UUID,
            notNull: true,
        },
        family_gedcom_id: {
            type: PgType.TEXT,
            notNull: true,
        },
        parent_gedcom_id: {
            type: PgType.TEXT,
            notNull: true,
        },
        child_gedcom_id: {
            type: PgType.TEXT,
            notNull: true,
        },
        relationship_id: {
            type: PgType.UUID,
            notNull: true,
            references: 'parent_child_relationships',
            referencesConstraintName: 'gedcom_parent_child_links_relationship_id_fkey',
            onDelete: 'RESTRICT',
        },
        last_imported_data: {
            type: PgType.JSONB,
            notNull: true,
        },
        last_seen_run_id: {
            type: PgType.UUID,
            notNull: true,
        },
        ...createTimestamps(pgm),
    });

    pgm.addConstraint('gedcom_parent_child_links', 'gedcom_parent_child_links_pkey', {
        primaryKey: ['source_id', 'family_gedcom_id', 'parent_gedcom_id', 'child_gedcom_id'],
    });
    pgm.addConstraint(
        'gedcom_parent_child_links',
        'gedcom_parent_child_links_family_fkey',
        'FOREIGN KEY (source_id, family_gedcom_id) REFERENCES gedcom_family_links (source_id, gedcom_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED',
    );
    pgm.addConstraint(
        'gedcom_parent_child_links',
        'gedcom_parent_child_links_parent_fkey',
        'FOREIGN KEY (source_id, parent_gedcom_id) REFERENCES gedcom_individual_links (source_id, gedcom_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED',
    );
    pgm.addConstraint(
        'gedcom_parent_child_links',
        'gedcom_parent_child_links_child_fkey',
        'FOREIGN KEY (source_id, child_gedcom_id) REFERENCES gedcom_individual_links (source_id, gedcom_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED',
    );
    pgm.addConstraint(
        'gedcom_parent_child_links',
        'gedcom_parent_child_links_source_run_fkey',
        'FOREIGN KEY (source_id, last_seen_run_id) REFERENCES gedcom_import_runs (source_id, id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED',
    );
    pgm.createIndex('gedcom_parent_child_links', 'relationship_id', {
        name: 'gedcom_parent_child_links_relationship_id_idx',
    });

    pgm.createTable('gedcom_couple_event_links', {
        source_id: {
            type: PgType.UUID,
            notNull: true,
        },
        family_gedcom_id: {
            type: PgType.TEXT,
            notNull: true,
        },
        gedcom_event_tag: {
            type: PgType.TEXT,
            notNull: true,
        },
        occurrence_index: {
            type: PgType.INTEGER,
            notNull: true,
        },
        event_id: {
            type: PgType.UUID,
            notNull: true,
            references: 'couple_relationship_events',
            referencesConstraintName: 'gedcom_couple_event_links_event_id_fkey',
            onDelete: 'RESTRICT',
        },
        content_sha256: {
            type: PgType.BYTEA,
            notNull: true,
        },
        last_imported_data: {
            type: PgType.JSONB,
            notNull: true,
        },
        last_seen_run_id: {
            type: PgType.UUID,
            notNull: true,
        },
        ...createTimestamps(pgm),
    });

    pgm.addConstraint('gedcom_couple_event_links', 'gedcom_couple_event_links_pkey', {
        primaryKey: ['source_id', 'family_gedcom_id', 'gedcom_event_tag', 'occurrence_index'],
    });
    pgm.addConstraint('gedcom_couple_event_links', 'gedcom_couple_event_links_valid_key', {
        check: "NULLIF(BTRIM(gedcom_event_tag), '') IS NOT NULL AND occurrence_index >= 0",
    });
    pgm.addConstraint('gedcom_couple_event_links', 'gedcom_couple_event_links_sha256_length', {
        check: 'OCTET_LENGTH(content_sha256) = 32',
    });
    pgm.addConstraint(
        'gedcom_couple_event_links',
        'gedcom_couple_event_links_family_fkey',
        'FOREIGN KEY (source_id, family_gedcom_id) REFERENCES gedcom_family_links (source_id, gedcom_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED',
    );
    pgm.addConstraint(
        'gedcom_couple_event_links',
        'gedcom_couple_event_links_source_run_fkey',
        'FOREIGN KEY (source_id, last_seen_run_id) REFERENCES gedcom_import_runs (source_id, id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED',
    );
    pgm.createIndex('gedcom_couple_event_links', 'event_id', {
        name: 'gedcom_couple_event_links_event_id_idx',
    });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
    pgm.dropTable('gedcom_couple_event_links');
    pgm.dropTable('gedcom_parent_child_links');
    pgm.dropTable('gedcom_family_links');
    pgm.dropTable('gedcom_individual_links');
    pgm.dropTable('gedcom_import_runs');
    pgm.dropTable('gedcom_import_sources');
}
