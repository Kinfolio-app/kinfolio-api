import type { QueryableDatabase } from '../../shared/database/transaction.js';
import type { GedcomImportSource } from './gedcom-import-persistence.types.js';

type GedcomImportSourceRow = {
    id: string;
    name: string;
    created_at: Date;
    updated_at: Date;
};

function mapSource(row: GedcomImportSourceRow): GedcomImportSource {
    return {
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class GedcomImportSourceRepository {
    constructor(private readonly database: QueryableDatabase) {}

    async create(name: string): Promise<GedcomImportSource> {
        const { rows } = await this.database.query<GedcomImportSourceRow>(
            `INSERT INTO gedcom_import_sources (name)
            VALUES ($1)
            RETURNING *`,
            [name.trim()],
        );
        const row = rows[0];

        if (row === undefined) {
            throw new Error('PostgreSQL did not return the created GEDCOM import source.');
        }

        return mapSource(row);
    }

    async findById(id: string): Promise<GedcomImportSource | null> {
        const { rows } = await this.database.query<GedcomImportSourceRow>(
            'SELECT * FROM gedcom_import_sources WHERE id = $1',
            [id],
        );
        const row = rows[0];

        return row === undefined ? null : mapSource(row);
    }

    async deleteIfUnused(id: string): Promise<boolean> {
        return (await this.deleteManyIfUnused([id])) === 1;
    }

    async deleteManyIfUnused(ids: string[]): Promise<number> {
        if (ids.length === 0) return 0;

        const { rowCount } = await this.database.query(
            `DELETE FROM gedcom_import_sources AS source
            WHERE source.id = ANY($1::uuid[])
                AND NOT EXISTS (
                    SELECT 1 FROM gedcom_import_drafts WHERE source_id = source.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM gedcom_import_runs WHERE source_id = source.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM gedcom_individual_links WHERE source_id = source.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM gedcom_family_links WHERE source_id = source.id
                )`,
            [ids],
        );

        return rowCount ?? 0;
    }
}
