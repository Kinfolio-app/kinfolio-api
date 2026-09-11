import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GedcomImportDraftRepository } from '../../../../src/modules/gedcom-import/gedcom-import-draft.repository.js';
import {
    GedcomImportDraftStatus,
    type GedcomImportSource,
} from '../../../../src/modules/gedcom-import/gedcom-import-persistence.types.js';
import { GedcomImportRepository } from '../../../../src/modules/gedcom-import/gedcom-import.repository.js';

const TEST_DATABASE_NAME = 'kinfolio_test';

function getTestDatabaseUrl(): string {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl === undefined) {
        throw new Error('DATABASE_URL is required for integration tests.');
    }

    const url = new URL(databaseUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));

    if (databaseName !== TEST_DATABASE_NAME) {
        throw new Error(
            `Integration tests require database "${TEST_DATABASE_NAME}", received "${databaseName}".`,
        );
    }

    return databaseUrl;
}

function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

describe('GedcomImportDraftRepository integration', () => {
    let pool: Pool;
    let client: PoolClient;
    let draftRepository: GedcomImportDraftRepository;
    let importRepository: GedcomImportRepository;
    let source: GedcomImportSource;

    beforeAll(async () => {
        pool = new Pool({ connectionString: getTestDatabaseUrl() });
        await pool.query('SELECT 1');
        await pool.query(`
            DELETE FROM gedcom_couple_event_links;
            DELETE FROM gedcom_parent_child_links;
            DELETE FROM gedcom_family_links;
            DELETE FROM gedcom_individual_links;
            DELETE FROM gedcom_import_drafts;
            DELETE FROM gedcom_import_runs;
            DELETE FROM gedcom_import_sources;
        `);
    });

    beforeEach(async () => {
        client = await pool.connect();
        await client.query('BEGIN');
        draftRepository = new GedcomImportDraftRepository(client);
        importRepository = new GedcomImportRepository(client);
        source = await importRepository.createSource('Synthetic draft source');
    });

    afterEach(async () => {
        try {
            await client.query('ROLLBACK');
        } finally {
            client.release();
        }
    });

    afterAll(async () => {
        await pool.end();
    });

    async function createDraft(expiresAt = new Date('2100-01-01T00:00:00.000Z')) {
        return draftRepository.create({
            sourceId: source.id,
            status: GedcomImportDraftStatus.Ready,
            fileSha256: sha256('synthetic draft contents'),
            fileContent: new TextEncoder().encode('0 HEAD\n0 TRLR'),
            gedcomVersion: '7.0',
            plan: {
                people: [],
                parentChildRelationships: [],
                coupleRelationships: [],
                coupleRelationshipEvents: [],
                issues: [],
            },
            expiresAt,
        });
    }

    it('creates and reads a private draft with empty resolution state', async () => {
        const draft = await createDraft();
        const found = await draftRepository.findById(draft.id);

        expect(found).toEqual(draft);
        expect(Array.from(draft.fileContent)).toEqual(
            Array.from(new TextEncoder().encode('0 HEAD\n0 TRLR')),
        );
        expect(draft.resolutions).toEqual({});
        expect(draft.baseVersions).toEqual({});
        expect(draft.revision).toBe(0);
    });

    it('rolls back a new source when its draft cannot be created', async () => {
        const transactionalRepository = new GedcomImportDraftRepository(pool);
        const sourceName = 'Rolled back synthetic source';

        await expect(
            transactionalRepository.createForNewSource(sourceName, {
                status: GedcomImportDraftStatus.Ready,
                fileSha256: sha256('invalid empty draft'),
                fileContent: new Uint8Array(),
                gedcomVersion: '7.0',
                plan: {
                    people: [],
                    parentChildRelationships: [],
                    coupleRelationships: [],
                    coupleRelationshipEvents: [],
                    issues: [],
                },
                expiresAt: new Date('2100-01-01T00:00:00.000Z'),
            }),
        ).rejects.toMatchObject({ constraint: 'gedcom_import_drafts_file_not_empty' });

        const { rows } = await pool.query<{ count: number }>(
            'SELECT COUNT(*)::integer AS count FROM gedcom_import_sources WHERE name = $1',
            [sourceName],
        );
        expect(rows[0]?.count).toBe(0);
    });

    it('updates resolutions only at the expected revision', async () => {
        const draft = await createDraft();
        const updated = await draftRepository.updateResolutions({
            id: draft.id,
            expectedRevision: 0,
            status: GedcomImportDraftStatus.NeedsResolution,
            resolutions: { 'person:0': { action: 'create' } },
        });

        expect(updated).toMatchObject({
            id: draft.id,
            status: GedcomImportDraftStatus.NeedsResolution,
            revision: 1,
            resolutions: { 'person:0': { action: 'create' } },
        });
        await expect(
            draftRepository.updateResolutions({
                id: draft.id,
                expectedRevision: 0,
                status: GedcomImportDraftStatus.Ready,
                resolutions: {},
            }),
        ).resolves.toBeNull();
    });

    it('deletes a cancelled draft and its now-unused source', async () => {
        const draft = await createDraft();

        await expect(draftRepository.deleteById(draft.id)).resolves.toBe(true);
        await expect(draftRepository.findById(draft.id)).resolves.toBeNull();
        await expect(importRepository.findSourceById(source.id)).resolves.toBeNull();
        await expect(draftRepository.deleteById(draft.id)).resolves.toBe(false);
    });

    it('removes only expired drafts and keeps a source used by a completed run', async () => {
        const expired = await createDraft(new Date('2099-01-01T00:00:00.000Z'));
        const active = await createDraft(new Date('2101-01-01T00:00:00.000Z'));
        await importRepository.createOrFindRun({
            sourceId: source.id,
            fileSha256: sha256('completed synthetic import'),
            gedcomVersion: '7.0',
            report: {},
        });

        await expect(
            draftRepository.deleteExpired(new Date('2100-01-01T00:00:00.000Z')),
        ).resolves.toEqual({
            deletedDrafts: 1,
            deletedSources: 0,
        });
        await expect(draftRepository.findById(expired.id)).resolves.toBeNull();
        await expect(draftRepository.findById(active.id)).resolves.toEqual(active);
        await expect(importRepository.findSourceById(source.id)).resolves.toEqual(source);
    });
});
