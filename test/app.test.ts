import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AppConfig } from '../src/config/env.js';
import { BadRequestError } from '../src/shared/errors/http-error.js';
import type { FastifyInstance } from 'fastify';

const TEST_CONFIG: AppConfig = {
    host: '127.0.0.1',
    port: 3000,
    databaseUrl: 'postgresql://test:test@localhost:5432/kinfolio_test',
};

describe('app', () => {
    let app: FastifyInstance;

    beforeAll(() => {
        app = buildApp({
            config: TEST_CONFIG,
            databasePlugin: async () => {},
        });

        app.get('/test/expected-error', () => {
            throw new BadRequestError({
                detail: 'Expected public detail.',
            });
        });

        app.get('/test/unexpected-error', () => {
            throw new Error('Sensitive internal detail.');
        });
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns the application health status', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/health',
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            status: 'ok',
        });
    });

    it('formats an AppError as problem details', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/test/expected-error',
        });

        expect(response.statusCode).toBe(400);
        expect(response.headers['content-type']).toContain('application/problem+json');
        expect(response.json()).toMatchObject({
            type: 'about:blank',
            title: 'Bad Request',
            status: 400,
            detail: 'Expected public detail.',
            requestId: expect.any(String),
        });
    });

    it('hides unexpected error details', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/test/unexpected-error',
        });

        expect(response.statusCode).toBe(500);
        expect(response.headers['content-type']).toContain('application/problem+json');
        expect(response.json()).toMatchObject({
            type: 'about:blank',
            title: 'Internal Server Error',
            status: 500,
            detail: 'An unexpected error occurred.',
            requestId: expect.any(String),
        });
        expect(response.body).not.toContain('Sensitive internal detail.');
    });

    it('formats unknown routes as problem details', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/route-that-does-not-exist',
        });

        expect(response.statusCode).toBe(404);
        expect(response.headers['content-type']).toContain('application/problem+json');
        expect(response.json()).toMatchObject({
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: 'The requested route does not exist.',
            requestId: expect.any(String),
        });
    });
});
