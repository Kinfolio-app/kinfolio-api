import { runInTransaction, type Database } from '../../shared/database/transaction.js';
import type { SupportedGedcomVersion } from './gedcom-file.types.js';
import type {
    GedcomImportDraft,
    GedcomImportDraftStatus,
    StoredGedcomImportData,
} from './gedcom-import-persistence.types.js';
import { GedcomImportSourceRepository } from './gedcom-import-source.repository.js';
import { decodeSha256, encodeSha256 } from './gedcom-sha256.js';

type GedcomImportDraftRow = {
    id: string;
    source_id: string;
    status: GedcomImportDraftStatus;
    file_sha256: Uint8Array;
    file_content: Uint8Array;
    gedcom_version: SupportedGedcomVersion;
    plan: StoredGedcomImportData;
    resolutions: StoredGedcomImportData;
    base_versions: StoredGedcomImportData;
    revision: number;
    expires_at: Date;
    created_at: Date;
    updated_at: Date;
};

export type CreateGedcomImportDraftInput = {
    sourceId: string;
    status: GedcomImportDraftStatus;
    fileSha256: string;
    fileContent: Uint8Array;
    gedcomVersion: SupportedGedcomVersion;
    plan: StoredGedcomImportData;
    resolutions?: StoredGedcomImportData;
    baseVersions?: StoredGedcomImportData;
    expiresAt: Date;
};

export type UpdateGedcomImportDraftResolutionsInput = {
    id: string;
    expectedRevision: number;
    status: GedcomImportDraftStatus;
    resolutions: StoredGedcomImportData;
};

export type GedcomImportDraftCleanupResult = {
    deletedDrafts: number;
    deletedSources: number;
};

function mapDraft(row: GedcomImportDraftRow): GedcomImportDraft {
    return {
        id: row.id,
        sourceId: row.source_id,
        status: row.status,
        fileSha256: encodeSha256(row.file_sha256),
        fileContent: new Uint8Array(row.file_content),
        gedcomVersion: row.gedcom_version,
        plan: row.plan,
        resolutions: row.resolutions,
        baseVersions: row.base_versions,
        revision: row.revision,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class GedcomImportDraftRepository {
    constructor(private readonly database: Database) {}

    async create(input: CreateGedcomImportDraftInput): Promise<GedcomImportDraft> {
        const { rows } = await this.database.query<GedcomImportDraftRow>(
            `INSERT INTO gedcom_import_drafts (
                source_id,
                status,
                file_sha256,
                file_content,
                gedcom_version,
                plan,
                resolutions,
                base_versions,
                expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                input.sourceId,
                input.status,
                decodeSha256(input.fileSha256),
                input.fileContent,
                input.gedcomVersion,
                input.plan,
                input.resolutions ?? {},
                input.baseVersions ?? {},
                input.expiresAt,
            ],
        );
        const row = rows[0];

        if (row === undefined) {
            throw new Error('PostgreSQL did not return the created GEDCOM import draft.');
        }

        return mapDraft(row);
    }

    async findById(id: string): Promise<GedcomImportDraft | null> {
        const { rows } = await this.database.query<GedcomImportDraftRow>(
            'SELECT * FROM gedcom_import_drafts WHERE id = $1',
            [id],
        );
        const row = rows[0];

        return row === undefined ? null : mapDraft(row);
    }

    async findByIdForUpdate(id: string): Promise<GedcomImportDraft | null> {
        const { rows } = await this.database.query<GedcomImportDraftRow>(
            'SELECT * FROM gedcom_import_drafts WHERE id = $1 FOR UPDATE',
            [id],
        );
        const row = rows[0];

        return row === undefined ? null : mapDraft(row);
    }

    async updateResolutions(
        input: UpdateGedcomImportDraftResolutionsInput,
    ): Promise<GedcomImportDraft | null> {
        const { rows } = await this.database.query<GedcomImportDraftRow>(
            `UPDATE gedcom_import_drafts
            SET
                status = $3,
                resolutions = $4,
                revision = revision + 1,
                updated_at = NOW()
            WHERE id = $1
                AND revision = $2
                AND expires_at > NOW()
            RETURNING *`,
            [input.id, input.expectedRevision, input.status, input.resolutions],
        );
        const row = rows[0];

        return row === undefined ? null : mapDraft(row);
    }

    async deleteById(id: string): Promise<boolean> {
        return runInTransaction(this.database, async (database) => {
            const { rows } = await database.query<{ source_id: string }>(
                'DELETE FROM gedcom_import_drafts WHERE id = $1 RETURNING source_id',
                [id],
            );
            const row = rows[0];

            if (row === undefined) return false;

            await new GedcomImportSourceRepository(database).deleteIfUnused(row.source_id);
            return true;
        });
    }

    async deleteExpired(referenceTime: Date): Promise<GedcomImportDraftCleanupResult> {
        return runInTransaction(this.database, async (database) => {
            const { rows } = await database.query<{ source_id: string }>(
                `DELETE FROM gedcom_import_drafts
                WHERE expires_at <= $1
                RETURNING source_id`,
                [referenceTime],
            );
            const sourceIds = [...new Set(rows.map((row) => row.source_id))];
            const deletedSources = await new GedcomImportSourceRepository(
                database,
            ).deleteManyIfUnused(sourceIds);

            return {
                deletedDrafts: rows.length,
                deletedSources,
            };
        });
    }
}
