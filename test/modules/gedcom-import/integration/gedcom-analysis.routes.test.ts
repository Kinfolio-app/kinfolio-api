import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.js';
import type { AppConfig } from '../../../../src/config/env.js';
import { HttpStatus } from '../../../../src/shared/http/http-status.js';
import { MediaType } from '../../../../src/shared/http/media-type.js';

const TEST_CONFIG: AppConfig = {
    host: '127.0.0.1',
    port: 3000,
    databaseUrl: 'postgresql://test:test@localhost:5432/kinfolio_test',
};

const MULTIPART_BOUNDARY = 'gedcom-analysis-test-boundary';
const MAX_GEDCOM_FILE_SIZE = 10 * 1024 * 1024;

function createMultipartFilePayload(content: Uint8Array): Buffer {
    return Buffer.concat([
        Buffer.from(
            [
                `--${MULTIPART_BOUNDARY}`,
                'Content-Disposition: form-data; name="file"; filename="family.ged"',
                'Content-Type: application/octet-stream',
                '',
            ].join('\r\n') + '\r\n',
            'utf8',
        ),
        content,
        Buffer.from(`\r\n--${MULTIPART_BOUNDARY}--\r\n`, 'utf8'),
    ]);
}

function multipartHeaders(): Record<string, string> {
    return {
        'content-type': `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
    };
}

describe('GEDCOM analysis route integration', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp({
            config: TEST_CONFIG,
            databasePlugin: async () => {},
            familyTreePlugin: async () => {},
            peoplePlugin: async () => {},
            relationshipPlugin: async () => {},
        });
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('analyzes a GEDCOM 5.5.1 file', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/gedcom-imports/analysis',
            headers: multipartHeaders(),
            payload: createMultipartFilePayload(
                Buffer.from(
                    ['0 HEAD', '1 GEDC', '2 VERS 5.5.1', '1 CHAR UTF-8', '0 TRLR'].join('\n'),
                    'utf8',
                ),
            ),
        });

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(response.json()).toEqual({
            version: '5.5.1',
            valid: true,
            summary: {
                individuals: 0,
                families: 0,
                events: 0,
                sources: 0,
                repositories: 0,
                media: 0,
                notes: 0,
            },
            ignored: [],
            ambiguous: [],
            diagnostics: [],
        });
    });

    it('analyzes a GEDCOM 7 file', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/gedcom-imports/analysis',
            headers: multipartHeaders(),
            payload: createMultipartFilePayload(
                Buffer.from(['0 HEAD', '1 GEDC', '2 VERS 7.0.18', '0 TRLR'].join('\n'), 'utf8'),
            ),
        });

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(response.json()).toEqual({
            version: '7.0.18',
            valid: true,
            summary: {
                individuals: 0,
                families: 0,
                events: 0,
                sources: 0,
                repositories: 0,
                media: 0,
                notes: 0,
            },
            ignored: [],
            ambiguous: [],
            diagnostics: [],
        });
    });

    it('exposes ignored and ambiguous GEDCOM extensions', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/gedcom-imports/analysis',
            headers: multipartHeaders(),
            payload: createMultipartFilePayload(
                Buffer.from(
                    [
                        '0 HEAD',
                        '1 GEDC',
                        '2 VERS 7.0.18',
                        '1 SCHMA',
                        '2 TAG _IDENTIFIED https://example.com/extensions/identified',
                        '0 @I1@ INDI',
                        '1 _IDENTIFIED known value',
                        '1 _UNIDENTIFIED unknown value',
                        '0 TRLR',
                    ].join('\n'),
                    'utf8',
                ),
            ),
        });

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(response.json()).toMatchObject({
            version: '7.0.18',
            valid: true,
            summary: {
                individuals: 1,
                families: 0,
                events: 0,
                sources: 0,
                repositories: 0,
                media: 0,
                notes: 0,
            },
            ignored: [
                {
                    kind: 'extension',
                    tag: '_IDENTIFIED',
                    uri: 'https://example.com/extensions/identified',
                    reason: 'The extension is identified but is not supported by Genealaine.',
                    path: expect.any(String),
                    location: {
                        line: 7,
                        column: 1,
                    },
                },
            ],
            ambiguous: [
                {
                    kind: 'extension',
                    tag: '_UNIDENTIFIED',
                    uri: null,
                    reason: 'The extension could not be identified uniquely.',
                    path: expect.any(String),
                    location: {
                        line: 8,
                        column: 1,
                    },
                },
            ],
            diagnostics: [],
        });
    });

    it('rejects a request without a file field', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/gedcom-imports/analysis',
            headers: multipartHeaders(),
            payload: `--${MULTIPART_BOUNDARY}--\r\n`,
        });

        expect(response.statusCode).toBe(HttpStatus.BadRequest);
        expect(response.headers['content-type']).toContain(MediaType.ProblemJson);
        expect(response.json()).toMatchObject({
            title: 'Bad Request',
            status: HttpStatus.BadRequest,
            detail: 'The request is invalid.',
        });
    });

    it('returns detection diagnostics for an invalid GEDCOM file', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/gedcom-imports/analysis',
            headers: multipartHeaders(),
            payload: createMultipartFilePayload(Buffer.from('This is not a GEDCOM file.', 'utf8')),
        });

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(response.json()).toEqual({
            version: null,
            valid: false,
            summary: {
                individuals: 0,
                families: 0,
                events: 0,
                sources: 0,
                repositories: 0,
                media: 0,
                notes: 0,
            },
            ignored: [],
            ambiguous: [],
            diagnostics: [
                {
                    severity: 'error',
                    code: 'missing_header',
                    message: 'The file must start with a GEDCOM HEAD record.',
                    location: {
                        line: 1,
                        column: null,
                    },
                    recordId: null,
                    path: null,
                },
            ],
        });
    });

    it('returns parsing diagnostics for a detected but invalid GEDCOM file', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/gedcom-imports/analysis',
            headers: multipartHeaders(),
            payload: createMultipartFilePayload(
                Buffer.from(
                    ['0 HEAD', '1 GEDC', '2 VERS 7.0.18', '0 @I1@ INDI'].join('\n'),
                    'utf8',
                ),
            ),
        });

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(response.json()).toMatchObject({
            version: '7.0.18',
            valid: false,
            summary: {
                individuals: 0,
                families: 0,
                events: 0,
                sources: 0,
                repositories: 0,
                media: 0,
                notes: 0,
            },
            ignored: [],
            ambiguous: [],
            diagnostics: [
                {
                    severity: 'error',
                    code: 'missing_trailer',
                },
            ],
        });
    });

    it('rejects a file exceeding the upload size limit', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/gedcom-imports/analysis',
            headers: multipartHeaders(),
            payload: createMultipartFilePayload(Buffer.alloc(MAX_GEDCOM_FILE_SIZE + 1, 'a')),
        });

        expect(response.statusCode).toBe(HttpStatus.PayloadTooLarge);
        expect(response.headers['content-type']).toContain(MediaType.ProblemJson);
        expect(response.json()).toMatchObject({
            title: 'Payload Too Large',
            status: HttpStatus.PayloadTooLarge,
            detail: 'The GEDCOM file exceeds the maximum allowed size.',
            requestId: expect.any(String),
        });
    });
});
