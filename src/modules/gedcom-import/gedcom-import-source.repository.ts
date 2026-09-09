import type { QueryableDatabase } from '../../shared/database/transaction.js';

export class GedcomImportSourceRepository {
    constructor(private readonly database: QueryableDatabase) {}

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
