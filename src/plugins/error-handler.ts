import type { FastifyPluginCallback } from 'fastify';
import { AppError } from '../shared/errors/app-error.js';
import { BadRequestError, InternalServerError } from '../shared/errors/http-error.js';
import { HttpStatus } from '../shared/http/http-status.js';
import { MediaType } from '../shared/http/media-type.js';
import fastifyPlugin from 'fastify-plugin';

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

        if (appError.status >= HttpStatus.InternalServerError) {
            request.log.error(
                {
                    err: appError,
                },
                'Unhandled error',
            );
        }

        return reply.status(appError.status).type(MediaType.ProblemJson).send({
            type: appError.type,
            title: appError.title,
            status: appError.status,
            detail: appError.detail,
            requestId: request.id,
        });
    });

    fastify.setNotFoundHandler((request, reply) => {
        return reply.status(HttpStatus.NotFound).type(MediaType.ProblemJson).send({
            type: 'about:blank',
            title: 'Not Found',
            status: HttpStatus.NotFound,
            detail: 'The requested route does not exist.',
            requestId: request.id,
        });
    });

    done();
};

export default fastifyPlugin(errorHandlerPlugin, {
    name: 'error-handler',
});
