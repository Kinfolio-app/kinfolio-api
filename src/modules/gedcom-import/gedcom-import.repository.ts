import type { Database } from '../../shared/database/transaction.js';
import type { NormalizedIdentifier } from './common/gedcom-parser.types.js';
import type { SupportedGedcomVersion } from './gedcom-file.types.js';
import { GedcomImportSourceRepository } from './gedcom-import-source.repository.js';
import { decodeSha256, encodeSha256 } from './gedcom-sha256.js';
import type {
    GedcomCoupleEventLink,
    GedcomFamilyLink,
    GedcomImportRun,
    GedcomImportSource,
    GedcomIndividualLink,
    GedcomParentChildLink,
    StoredGedcomImportData,
} from './gedcom-import-persistence.types.js';

type GedcomImportRunRow = {
    id: string;
    source_id: string;
    file_sha256: Uint8Array;
    gedcom_version: SupportedGedcomVersion;
    report: StoredGedcomImportData;
    created_at: Date;
};

type GedcomIndividualLinkRow = {
    source_id: string;
    gedcom_id: string;
    person_id: string;
    identifiers: NormalizedIdentifier[];
    last_imported_data: StoredGedcomImportData;
    last_seen_run_id: string;
    created_at: Date;
    updated_at: Date;
};

type GedcomFamilyLinkRow = {
    source_id: string;
    gedcom_id: string;
    couple_relationship_id: string | null;
    last_imported_data: StoredGedcomImportData;
    last_seen_run_id: string;
    created_at: Date;
    updated_at: Date;
};

type GedcomParentChildLinkRow = {
    source_id: string;
    family_gedcom_id: string;
    parent_gedcom_id: string;
    child_gedcom_id: string;
    relationship_id: string;
    last_imported_data: StoredGedcomImportData;
    last_seen_run_id: string;
    created_at: Date;
    updated_at: Date;
};

type GedcomCoupleEventLinkRow = {
    source_id: string;
    family_gedcom_id: string;
    gedcom_event_tag: string;
    occurrence_index: number;
    event_id: string;
    content_sha256: Uint8Array;
    last_imported_data: StoredGedcomImportData;
    last_seen_run_id: string;
    created_at: Date;
    updated_at: Date;
};

export type CreateGedcomImportRunInput = {
    sourceId: string;
    fileSha256: string;
    gedcomVersion: SupportedGedcomVersion;
    report: StoredGedcomImportData;
};

export type SaveGedcomIndividualLinkInput = {
    sourceId: string;
    gedcomId: string;
    personId: string;
    identifiers: NormalizedIdentifier[];
    lastImportedData: StoredGedcomImportData;
    lastSeenRunId: string;
};

export type SaveGedcomFamilyLinkInput = {
    sourceId: string;
    gedcomId: string;
    coupleRelationshipId: string | null;
    lastImportedData: StoredGedcomImportData;
    lastSeenRunId: string;
};

export type SaveGedcomParentChildLinkInput = {
    sourceId: string;
    familyGedcomId: string;
    parentGedcomId: string;
    childGedcomId: string;
    relationshipId: string;
    lastImportedData: StoredGedcomImportData;
    lastSeenRunId: string;
};

export type SaveGedcomCoupleEventLinkInput = {
    sourceId: string;
    familyGedcomId: string;
    gedcomEventTag: string;
    occurrenceIndex: number;
    eventId: string;
    contentSha256: string;
    lastImportedData: StoredGedcomImportData;
    lastSeenRunId: string;
};

function mapRun(row: GedcomImportRunRow): GedcomImportRun {
    return {
        id: row.id,
        sourceId: row.source_id,
        fileSha256: encodeSha256(row.file_sha256),
        gedcomVersion: row.gedcom_version,
        report: row.report,
        createdAt: row.created_at,
    };
}

function mapIndividualLink(row: GedcomIndividualLinkRow): GedcomIndividualLink {
    return {
        sourceId: row.source_id,
        gedcomId: row.gedcom_id,
        personId: row.person_id,
        identifiers: row.identifiers,
        lastImportedData: row.last_imported_data,
        lastSeenRunId: row.last_seen_run_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapFamilyLink(row: GedcomFamilyLinkRow): GedcomFamilyLink {
    return {
        sourceId: row.source_id,
        gedcomId: row.gedcom_id,
        coupleRelationshipId: row.couple_relationship_id,
        lastImportedData: row.last_imported_data,
        lastSeenRunId: row.last_seen_run_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapParentChildLink(row: GedcomParentChildLinkRow): GedcomParentChildLink {
    return {
        sourceId: row.source_id,
        familyGedcomId: row.family_gedcom_id,
        parentGedcomId: row.parent_gedcom_id,
        childGedcomId: row.child_gedcom_id,
        relationshipId: row.relationship_id,
        lastImportedData: row.last_imported_data,
        lastSeenRunId: row.last_seen_run_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapCoupleEventLink(row: GedcomCoupleEventLinkRow): GedcomCoupleEventLink {
    return {
        sourceId: row.source_id,
        familyGedcomId: row.family_gedcom_id,
        gedcomEventTag: row.gedcom_event_tag,
        occurrenceIndex: row.occurrence_index,
        eventId: row.event_id,
        contentSha256: encodeSha256(row.content_sha256),
        lastImportedData: row.last_imported_data,
        lastSeenRunId: row.last_seen_run_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class GedcomImportRepository {
    constructor(private readonly database: Database) {}

    async createSource(name: string): Promise<GedcomImportSource> {
        return new GedcomImportSourceRepository(this.database).create(name);
    }

    async findSourceById(id: string): Promise<GedcomImportSource | null> {
        return new GedcomImportSourceRepository(this.database).findById(id);
    }

    async deleteSourceIfUnused(id: string): Promise<boolean> {
        return new GedcomImportSourceRepository(this.database).deleteIfUnused(id);
    }

    async createOrFindRun(input: CreateGedcomImportRunInput): Promise<{
        run: GedcomImportRun;
        created: boolean;
    }> {
        const fingerprint = decodeSha256(input.fileSha256);
        const { rows } = await this.database.query<GedcomImportRunRow>(
            `INSERT INTO gedcom_import_runs (
                source_id,
                file_sha256,
                gedcom_version,
                report
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (source_id, file_sha256) DO NOTHING
            RETURNING *`,
            [input.sourceId, fingerprint, input.gedcomVersion, input.report],
        );
        const createdRow = rows[0];

        if (createdRow !== undefined) {
            return { run: mapRun(createdRow), created: true };
        }

        const existing = await this.findRunByFingerprint(input.sourceId, input.fileSha256);

        if (existing === null) {
            throw new Error('PostgreSQL did not return the existing GEDCOM import run.');
        }

        return { run: existing, created: false };
    }

    async findRunByFingerprint(
        sourceId: string,
        fileSha256: string,
    ): Promise<GedcomImportRun | null> {
        const { rows } = await this.database.query<GedcomImportRunRow>(
            `SELECT *
            FROM gedcom_import_runs
            WHERE source_id = $1
                AND file_sha256 = $2`,
            [sourceId, decodeSha256(fileSha256)],
        );
        const row = rows[0];

        return row === undefined ? null : mapRun(row);
    }

    async saveIndividualLink(input: SaveGedcomIndividualLinkInput): Promise<GedcomIndividualLink> {
        const { rows } = await this.database.query<GedcomIndividualLinkRow>(
            `INSERT INTO gedcom_individual_links (
                source_id,
                gedcom_id,
                person_id,
                identifiers,
                last_imported_data,
                last_seen_run_id
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (source_id, gedcom_id) DO UPDATE
            SET
                person_id = EXCLUDED.person_id,
                identifiers = EXCLUDED.identifiers,
                last_imported_data = EXCLUDED.last_imported_data,
                last_seen_run_id = EXCLUDED.last_seen_run_id,
                updated_at = NOW()
            RETURNING *`,
            [
                input.sourceId,
                input.gedcomId,
                input.personId,
                JSON.stringify(input.identifiers),
                input.lastImportedData,
                input.lastSeenRunId,
            ],
        );
        const row = rows[0];

        if (row === undefined) {
            throw new Error('PostgreSQL did not return the GEDCOM individual link.');
        }

        return mapIndividualLink(row);
    }

    async findIndividualLink(
        sourceId: string,
        gedcomId: string,
    ): Promise<GedcomIndividualLink | null> {
        const { rows } = await this.database.query<GedcomIndividualLinkRow>(
            `SELECT *
            FROM gedcom_individual_links
            WHERE source_id = $1
                AND gedcom_id = $2`,
            [sourceId, gedcomId],
        );
        const row = rows[0];

        return row === undefined ? null : mapIndividualLink(row);
    }

    async saveFamilyLink(input: SaveGedcomFamilyLinkInput): Promise<GedcomFamilyLink> {
        const { rows } = await this.database.query<GedcomFamilyLinkRow>(
            `INSERT INTO gedcom_family_links (
                source_id,
                gedcom_id,
                couple_relationship_id,
                last_imported_data,
                last_seen_run_id
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (source_id, gedcom_id) DO UPDATE
            SET
                couple_relationship_id = EXCLUDED.couple_relationship_id,
                last_imported_data = EXCLUDED.last_imported_data,
                last_seen_run_id = EXCLUDED.last_seen_run_id,
                updated_at = NOW()
            RETURNING *`,
            [
                input.sourceId,
                input.gedcomId,
                input.coupleRelationshipId,
                input.lastImportedData,
                input.lastSeenRunId,
            ],
        );
        const row = rows[0];

        if (row === undefined) {
            throw new Error('PostgreSQL did not return the GEDCOM family link.');
        }

        return mapFamilyLink(row);
    }

    async findFamilyLink(sourceId: string, gedcomId: string): Promise<GedcomFamilyLink | null> {
        const { rows } = await this.database.query<GedcomFamilyLinkRow>(
            `SELECT *
            FROM gedcom_family_links
            WHERE source_id = $1
                AND gedcom_id = $2`,
            [sourceId, gedcomId],
        );
        const row = rows[0];

        return row === undefined ? null : mapFamilyLink(row);
    }

    async saveParentChildLink(
        input: SaveGedcomParentChildLinkInput,
    ): Promise<GedcomParentChildLink> {
        const { rows } = await this.database.query<GedcomParentChildLinkRow>(
            `INSERT INTO gedcom_parent_child_links (
                source_id,
                family_gedcom_id,
                parent_gedcom_id,
                child_gedcom_id,
                relationship_id,
                last_imported_data,
                last_seen_run_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (source_id, family_gedcom_id, parent_gedcom_id, child_gedcom_id) DO UPDATE
            SET
                relationship_id = EXCLUDED.relationship_id,
                last_imported_data = EXCLUDED.last_imported_data,
                last_seen_run_id = EXCLUDED.last_seen_run_id,
                updated_at = NOW()
            RETURNING *`,
            [
                input.sourceId,
                input.familyGedcomId,
                input.parentGedcomId,
                input.childGedcomId,
                input.relationshipId,
                input.lastImportedData,
                input.lastSeenRunId,
            ],
        );
        const row = rows[0];

        if (row === undefined) {
            throw new Error('PostgreSQL did not return the GEDCOM parent-child link.');
        }

        return mapParentChildLink(row);
    }

    async findParentChildLink(
        sourceId: string,
        familyGedcomId: string,
        parentGedcomId: string,
        childGedcomId: string,
    ): Promise<GedcomParentChildLink | null> {
        const { rows } = await this.database.query<GedcomParentChildLinkRow>(
            `SELECT *
            FROM gedcom_parent_child_links
            WHERE source_id = $1
                AND family_gedcom_id = $2
                AND parent_gedcom_id = $3
                AND child_gedcom_id = $4`,
            [sourceId, familyGedcomId, parentGedcomId, childGedcomId],
        );
        const row = rows[0];

        return row === undefined ? null : mapParentChildLink(row);
    }

    async saveCoupleEventLink(
        input: SaveGedcomCoupleEventLinkInput,
    ): Promise<GedcomCoupleEventLink> {
        const { rows } = await this.database.query<GedcomCoupleEventLinkRow>(
            `INSERT INTO gedcom_couple_event_links (
                source_id,
                family_gedcom_id,
                gedcom_event_tag,
                occurrence_index,
                event_id,
                content_sha256,
                last_imported_data,
                last_seen_run_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (
                source_id,
                family_gedcom_id,
                gedcom_event_tag,
                occurrence_index
            ) DO UPDATE
            SET
                event_id = EXCLUDED.event_id,
                content_sha256 = EXCLUDED.content_sha256,
                last_imported_data = EXCLUDED.last_imported_data,
                last_seen_run_id = EXCLUDED.last_seen_run_id,
                updated_at = NOW()
            RETURNING *`,
            [
                input.sourceId,
                input.familyGedcomId,
                input.gedcomEventTag,
                input.occurrenceIndex,
                input.eventId,
                decodeSha256(input.contentSha256),
                input.lastImportedData,
                input.lastSeenRunId,
            ],
        );
        const row = rows[0];

        if (row === undefined) {
            throw new Error('PostgreSQL did not return the GEDCOM couple event link.');
        }

        return mapCoupleEventLink(row);
    }

    async findCoupleEventLink(
        sourceId: string,
        familyGedcomId: string,
        gedcomEventTag: string,
        occurrenceIndex: number,
    ): Promise<GedcomCoupleEventLink | null> {
        const { rows } = await this.database.query<GedcomCoupleEventLinkRow>(
            `SELECT *
            FROM gedcom_couple_event_links
            WHERE source_id = $1
                AND family_gedcom_id = $2
                AND gedcom_event_tag = $3
                AND occurrence_index = $4`,
            [sourceId, familyGedcomId, gedcomEventTag, occurrenceIndex],
        );
        const row = rows[0];

        return row === undefined ? null : mapCoupleEventLink(row);
    }
}
