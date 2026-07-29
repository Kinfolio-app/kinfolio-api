import { PgType, type ColumnDefinitions, type MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
    pgm.createType('parent_child_relationship_type', [
        'biological',
        'adoptive',
        'step',
        'foster',
        'other',
        'unspecified',
    ]);

    pgm.createTable('parent_child_relationships', {
        id: {
            type: PgType.UUID,
            primaryKey: true,
            notNull: true,
            default: pgm.func('gen_random_uuid()'),
        },
        parent_id: {
            type: PgType.UUID,
            notNull: true,
            references: 'persons',
            referencesConstraintName: 'parent_child_relationships_parent_id_fkey',
            onDelete: 'RESTRICT',
        },
        child_id: {
            type: PgType.UUID,
            notNull: true,
            references: 'persons',
            referencesConstraintName: 'parent_child_relationships_child_id_fkey',
            onDelete: 'RESTRICT',
        },
        relationship_type: {
            type: 'parent_child_relationship_type',
            notNull: true,
            default: 'unspecified',
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

    pgm.addConstraint('parent_child_relationships', 'parent_child_relationships_distinct_people', {
        check: 'parent_id <> child_id',
    });

    pgm.addConstraint(
        'parent_child_relationships',
        'parent_child_relationships_parent_child_unique',
        {
            unique: ['parent_id', 'child_id'],
        },
    );

    pgm.createIndex('parent_child_relationships', 'child_id', {
        name: 'parent_child_relationships_child_id_idx',
    });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
    pgm.dropTable('parent_child_relationships');
    pgm.dropType('parent_child_relationship_type');
}
