import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

const EVIDENCE_STATUS_TYPE = 'parent_child_relationship_evidence_status';

export async function up(pgm: MigrationBuilder): Promise<void> {
    pgm.createType(EVIDENCE_STATUS_TYPE, ['unassessed', 'proven', 'challenged']);
    pgm.addColumn('parent_child_relationships', {
        evidence_status: {
            type: EVIDENCE_STATUS_TYPE,
            notNull: true,
            default: 'unassessed',
        },
    });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
    pgm.dropColumn('parent_child_relationships', 'evidence_status');
    pgm.dropType(EVIDENCE_STATUS_TYPE);
}
