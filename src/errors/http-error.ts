import { AppError } from './app-error.js';

export const BAD_REQUEST_STATUS = 400;
export const NOT_FOUND_STATUS = 404;
export const CONFLICT_STATUS = 409;

export const INTERNAL_SERVER_STATUS = 500;

export type HttpError = {
    detail: string;
    cause?: unknown;
};

export class BadRequestError extends AppError {
    constructor({ detail, cause }: HttpError) {
        super({
            type: 'about:blank',
            title: 'Bad Request',
            status: BAD_REQUEST_STATUS,
            detail,
            cause,
        });

        this.name = 'BadRequestError';
    }
}

export class NotFoundError extends AppError {
    constructor({ detail, cause }: HttpError) {
        super({
            type: 'about:blank',
            title: 'Not Found',
            status: NOT_FOUND_STATUS,
            detail,
            cause,
        });

        this.name = 'NotFoundError';
    }
}

export class ConflictError extends AppError {
    constructor({ detail, cause }: HttpError) {
        super({
            type: 'about:blank',
            title: 'Conflict',
            status: CONFLICT_STATUS,
            detail,
            cause,
        });

        this.name = 'ConflictError';
    }
}

export class InternalServerError extends AppError {
    constructor(cause?: unknown) {
        super({
            type: 'about:blank',
            title: 'Internal Server Error',
            status: INTERNAL_SERVER_STATUS,
            detail: 'An unexpected error occurred.',
            cause,
        });

        this.name = 'InternalServerError';
    }
}
