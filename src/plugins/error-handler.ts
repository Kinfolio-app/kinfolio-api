import type { FastifyPluginCallback } from 'fastify';
import { AppError } from '../errors/app-error.js';
import {
    BadRequestError,
    INTERNAL_SERVER_STATUS,
    InternalServerError,
    NOT_FOUND_STATUS,
} from '../errors/http-error.js';
import fastifyPlugin from 'fastify-plugin';

const APPLICATION_PROBLEM: string = 'application/problem+json';

type FastifyValidationError = Error & {
    validation: unknown;
};

function isFastifyValidationError(error: unknown): error is FastifyValidationError {
    return error instanceof Error && 'validation' in error && error.validation !== undefined;
}

export function normalizeError(error: unknown): AppError {
    if (error instanceof AppError) {
        return error;
    }

    if (isFastifyValidationError(error)) {
        return new BadRequestError({
            detail: 'The request is invalid.',
            cause: error,
        });
    }

    return new InternalServerError(error);
}

const errorHandlerPlugin: FastifyPluginCallback = (fastify, _options, done) => {
    fastify.setErrorHandler((error, request, reply) => {
        const appError = normalizeError(error);

        if (appError.status >= INTERNAL_SERVER_STATUS) {
            request.log.error(
                {
                    err: appError,
                },
                'Unhandled error',
            );
        }

        return reply.status(appError.status).type(APPLICATION_PROBLEM).send({
            type: appError.type,
            title: appError.title,
            status: appError.status,
            detail: appError.detail,
            requestId: request.id,
        });
    });

    fastify.setNotFoundHandler((request, reply) => {
        return reply.status(NOT_FOUND_STATUS).type(APPLICATION_PROBLEM).send({
            type: 'about:blank',
            title: 'Not Found',
            status: NOT_FOUND_STATUS,
            detail: 'The requested route does not exist.',
            requestId: request.id,
        });
    });

    done();
};

export default fastifyPlugin(errorHandlerPlugin, {
    name: 'error-handler',
});
