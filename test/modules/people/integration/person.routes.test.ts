import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.js';
import { loadConfig } from '../../../../src/config/env.js';
import type { FastifyInstance } from 'fastify';
import {
    type CreatePersonInput,
    LivingStatus,
} from '../../../../src/modules/people/person.types.js';
import { HttpStatus } from '../../../../src/shared/http/http-status.js';
import { MediaType } from '../../../../src/shared/http/media-type.js';

const TEST_DATABASE_NAME = 'kinfolio_test';

function assertTestDatabase(databaseUrl: string): void {
    const url = new URL(databaseUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));

    if (databaseName !== TEST_DATABASE_NAME) {
        throw new Error(
            `Integration tests require "${TEST_DATABASE_NAME}", received "${databaseName}".`,
        );
    }
}

describe('PersonRoute integration', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        const config = loadConfig();

        assertTestDatabase(config.databaseUrl);

        app = buildApp({ config });
        await app.ready();
    });

    beforeEach(async () => {
        await app.pg.query('TRUNCATE TABLE persons');
    });

    afterAll(async () => {
        await app.pg.query('TRUNCATE TABLE persons');
        await app.close();
    });

    it('creates a person successfully', async () => {
        const personInput: CreatePersonInput = {
            firstName: 'Alice',
            middleNames: 'Louise',
            lastName: 'Martin',
            birthName: 'Durand',
            birthDate: '1985-03-12',
            birthPlace: 'Lyon',
            deathDate: '2025-06-18',
            deathPlace: 'Paris',
            livingStatus: LivingStatus.Deceased,
            biography: 'Test biography.',
        };

        const response = await app.inject({
            method: 'POST',
            url: '/people',
            payload: personInput,
        });

        expect(response.statusCode).toBe(HttpStatus.Created);
        expect(response.json()).toMatchObject({
            ...personInput,
            id: expect.any(String),
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        });
    });

    it('creates a person with database defaults', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/people',
            payload: {
                firstName: 'Alice',
            },
        });

        expect(response.statusCode).toBe(HttpStatus.Created);
        expect(response.json()).toEqual({
            id: expect.any(String),
            firstName: 'Alice',
            middleNames: null,
            lastName: null,
            birthName: null,
            birthDate: null,
            birthPlace: null,
            deathDate: null,
            deathPlace: null,
            livingStatus: LivingStatus.Unknown,
            biography: null,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        });
    });

    it('returns a person by id', async () => {
        const createResponse = await app.inject({
            method: 'POST',
            url: '/people',
            payload: {
                firstName: 'Alice',
                lastName: 'Martin',
            },
        });

        expect(createResponse.statusCode).toBe(HttpStatus.Created);

        const createdPerson = createResponse.json();

        const response = await app.inject({
            method: 'GET',
            url: `/people/${createdPerson.id}`,
        });

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(response.json()).toEqual(createdPerson);
    });

    it('returns problem details when a person does not exist', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/people/${randomUUID()}`,
        });

        expect(response.statusCode).toBe(HttpStatus.NotFound);
        expect(response.headers['content-type']).toContain(MediaType.ProblemJson);
        expect(response.json()).toMatchObject({
            type: 'about:blank',
            title: 'Not Found',
            status: HttpStatus.NotFound,
            detail: 'The requested person does not exist.',
            requestId: expect.any(String),
        });
    });
});
