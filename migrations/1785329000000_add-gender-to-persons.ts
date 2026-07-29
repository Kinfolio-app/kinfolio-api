import { type ColumnDefinitions, type MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
    pgm.createType('person_gender', ['male', 'female', 'non_binary', 'unspecified']);

    pgm.addColumn('persons', {
        gender: {
            type: 'person_gender',
            notNull: true,
            default: 'unspecified',
        },
    });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
    pgm.dropColumn('persons', 'gender');
    pgm.dropType('person_gender');
}
