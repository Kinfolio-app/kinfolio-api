import { HttpStatus } from '../http/http-status.js';
import { AppError } from './app-error.js';

export type HttpError = {
    detail: string;
    cause?: unknown;
};

export class BadRequestError extends AppError {
    constructor({ detail, cause }: HttpError) {
        super({
            type: 'about:blank',
            title: 'Bad Request',
            status: HttpStatus.BadRequest,
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
            status: HttpStatus.NotFound,
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
            status: HttpStatus.Conflict,
            detail,
            cause,
        });

        this.name = 'ConflictError';
    }
}

export class PayloadTooLargeError extends AppError {
    constructor({ detail, cause }: HttpError) {
        super({
            type: 'about:blank',
            title: 'Payload Too Large',
            status: HttpStatus.PayloadTooLarge,
            detail,
            cause,
        });

        this.name = 'PayloadTooLargeError';
    }
}

export class InternalServerError extends AppError {
    constructor(cause?: unknown) {
        super({
            type: 'about:blank',
            title: 'Internal Server Error',
            status: HttpStatus.InternalServerError,
            detail: 'An unexpected error occurred.',
            cause,
        });

        this.name = 'InternalServerError';
    }
}
