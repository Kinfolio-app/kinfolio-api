import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.js';
import type { AppConfig } from '../../../../src/config/env.js';
import { GedcomImportRepository } from '../../../../src/modules/gedcom-import/gedcom-import.repository.js';
import { HttpStatus } from '../../../../src/shared/http/http-status.js';
import { MediaType } from '../../../../src/shared/http/media-type.js';

const MULTIPART_BOUNDARY = 'gedcom-draft-test-boundary';
const TEST_DATABASE_NAME = 'kinfolio_test';

function createTestConfig(): AppConfig {
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

    return {
        host: '127.0.0.1',
        port: 3000,
        databaseUrl,
    };
}

function createGedcomFile(): Buffer {
    return Buffer.from(
        ['0 HEAD', '1 GEDC', '2 VERS 7.0.18', '0 @I1@ INDI', '1 NAME Ada /Martin/', '0 TRLR'].join(
            '\n',
        ),
        'utf8',
    );
}

function createMultipartPayload(file: Uint8Array, fields: Record<string, string>): Buffer {
    const parts: Buffer[] = [
        Buffer.from(
            [
                `--${MULTIPART_BOUNDARY}`,
                'Content-Disposition: form-data; name="file"; filename="family.ged"',
                'Content-Type: application/octet-stream',
                '',
            ].join('\r\n') + '\r\n',
            'utf8',
        ),
        Buffer.from(file),
        Buffer.from('\r\n', 'utf8'),
    ];

    Object.entries(fields).forEach(([name, value]) => {
        parts.push(
            Buffer.from(
                [
                    `--${MULTIPART_BOUNDARY}`,
                    `Content-Disposition: form-data; name="${name}"`,
                    '',
                    value,
                    '',
                ].join('\r\n'),
                'utf8',
            ),
        );
    });

    parts.push(Buffer.from(`--${MULTIPART_BOUNDARY}--\r\n`, 'utf8'));
    return Buffer.concat(parts);
}

function multipartHeaders(): Record<string, string> {
    return {
        'content-type': `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
    };
}

async function clearGedcomImportData(pool: Pool): Promise<void> {
    await pool.query(`
        DELETE FROM gedcom_couple_event_links;
        DELETE FROM gedcom_parent_child_links;
        DELETE FROM gedcom_family_links;
        DELETE FROM gedcom_individual_links;
        DELETE FROM gedcom_import_drafts;
        DELETE FROM gedcom_import_runs;
        DELETE FROM gedcom_import_sources;
    `);
}

describe('GEDCOM import draft routes integration', () => {
    let app: FastifyInstance;
    let pool: Pool;

    beforeAll(async () => {
        const config = createTestConfig();
        pool = new Pool({ connectionString: config.databaseUrl });
        app = buildApp({
            config,
            familyTreePlugin: async () => {},
            peoplePlugin: async () => {},
            relationshipPlugin: async () => {},
        });
        await app.ready();
    });

    beforeEach(async () => {
        await clearGedcomImportData(pool);
    });

    afterEach(async () => {
        await clearGedcomImportData(pool);
    });

    afterAll(async () => {
        await app.close();
        await pool.end();
    });

    it('creates, reads, updates and deletes a draft without exposing the file', async () => {
        const creationResponse = await app.inject({
            method: 'POST',
            url: '/gedcom-import-drafts',
            headers: multipartHeaders(),
            payload: createMultipartPayload(createGedcomFile(), {
                sourceName: 'Synthetic family tree',
            }),
        });

        expect(creationResponse.statusCode).toBe(HttpStatus.Created);
        const createdDraft = creationResponse.json();
        expect(createdDraft).toMatchObject({
            id: expect.any(String),
            sourceId: expect.any(String),
            status: 'ready',
            fileSha256: createHash('sha256').update(createGedcomFile()).digest('hex'),
            gedcomVersion: '7.0.18',
            revision: 0,
            resolutions: {},
            plan: {
                people: [expect.objectContaining({ key: 'person:0' })],
                issues: [],
            },
        });
        expect(createdDraft).not.toHaveProperty('fileContent');

        const readResponse = await app.inject({
            method: 'GET',
            url: `/gedcom-import-drafts/${createdDraft.id}`,
        });
        expect(readResponse.statusCode).toBe(HttpStatus.Ok);
        expect(readResponse.json()).toEqual(createdDraft);

        const updateResponse = await app.inject({
            method: 'PATCH',
            url: `/gedcom-import-drafts/${createdDraft.id}/resolutions`,
            payload: {
                revision: 0,
                resolutions: { 'person:0': { action: 'create' } },
            },
        });
        expect(updateResponse.statusCode).toBe(HttpStatus.Ok);
        expect(updateResponse.json()).toMatchObject({
            revision: 1,
            resolutions: { 'person:0': { action: 'create' } },
        });

        const staleUpdateResponse = await app.inject({
            method: 'PATCH',
            url: `/gedcom-import-drafts/${createdDraft.id}/resolutions`,
            payload: { revision: 0, resolutions: {} },
        });
        expect(staleUpdateResponse.statusCode).toBe(HttpStatus.Conflict);

        const deletionResponse = await app.inject({
            method: 'DELETE',
            url: `/gedcom-import-drafts/${createdDraft.id}`,
        });
        expect(deletionResponse.statusCode).toBe(HttpStatus.NoContent);

        const missingResponse = await app.inject({
            method: 'GET',
            url: `/gedcom-import-drafts/${createdDraft.id}`,
        });
        expect(missingResponse.statusCode).toBe(HttpStatus.NotFound);
    });

    it('returns diagnostics without leaving a source for an invalid file', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/gedcom-import-drafts',
            headers: multipartHeaders(),
            payload: createMultipartPayload(Buffer.from('not a GEDCOM file', 'utf8'), {
                sourceName: 'Rejected source',
            }),
        });

        expect(response.statusCode).toBe(HttpStatus.BadRequest);
        expect(response.headers['content-type']).toContain(MediaType.ProblemJson);
        expect(response.json()).toMatchObject({
            title: 'Bad Request',
            status: HttpStatus.BadRequest,
            diagnostics: [expect.objectContaining({ code: 'missing_header' })],
        });
        const { rows } = await pool.query<{ count: number }>(
            'SELECT COUNT(*)::integer AS count FROM gedcom_import_sources',
        );
        expect(rows[0]?.count).toBe(0);
    });

    it('requires exactly one source selector', async () => {
        const missingSourceResponse = await app.inject({
            method: 'POST',
            url: '/gedcom-import-drafts',
            headers: multipartHeaders(),
            payload: createMultipartPayload(createGedcomFile(), {}),
        });
        expect(missingSourceResponse.statusCode).toBe(HttpStatus.BadRequest);

        const duplicateSourceResponse = await app.inject({
            method: 'POST',
            url: '/gedcom-import-drafts',
            headers: multipartHeaders(),
            payload: createMultipartPayload(createGedcomFile(), {
                sourceId: 'a3b81ff0-b4e7-4f8a-9469-13b55fb7ba78',
                sourceName: 'Synthetic family tree',
            }),
        });
        expect(duplicateSourceResponse.statusCode).toBe(HttpStatus.BadRequest);
    });

    it('returns the completed run when the source already imported the same file', async () => {
        const repository = new GedcomImportRepository(pool);
        const source = await repository.createSource('Existing synthetic source');
        const file = createGedcomFile();
        const existing = await repository.createOrFindRun({
            sourceId: source.id,
            fileSha256: createHash('sha256').update(file).digest('hex'),
            gedcomVersion: '7.0.18',
            report: { createdPeople: 1 },
        });

        const response = await app.inject({
            method: 'POST',
            url: '/gedcom-import-drafts',
            headers: multipartHeaders(),
            payload: createMultipartPayload(file, { sourceId: source.id }),
        });

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(response.json()).toEqual({
            status: 'already_imported',
            runId: existing.run.id,
            sourceId: source.id,
            report: { createdPeople: 1 },
            createdAt: existing.run.createdAt.toISOString(),
        });
        const { rows } = await pool.query<{ count: number }>(
            'SELECT COUNT(*)::integer AS count FROM gedcom_import_drafts',
        );
        expect(rows[0]?.count).toBe(0);
    });

    it('reports an expired draft as gone before physical cleanup', async () => {
        const creationResponse = await app.inject({
            method: 'POST',
            url: '/gedcom-import-drafts',
            headers: multipartHeaders(),
            payload: createMultipartPayload(createGedcomFile(), {
                sourceName: 'Expiring synthetic source',
            }),
        });
        const draftId = creationResponse.json().id as string;
        await pool.query(
            `UPDATE gedcom_import_drafts
            SET created_at = '2000-01-01T00:00:00.000Z',
                expires_at = '2000-01-02T00:00:00.000Z'
            WHERE id = $1`,
            [draftId],
        );

        const response = await app.inject({
            method: 'GET',
            url: `/gedcom-import-drafts/${draftId}`,
        });

        expect(response.statusCode).toBe(HttpStatus.Gone);
        expect(response.json()).toMatchObject({
            title: 'Gone',
            status: HttpStatus.Gone,
        });
    });
});
