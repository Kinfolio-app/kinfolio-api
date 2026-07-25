export type AppErrorOptions = {
    status: number;
    title: string;
    detail: string;
    type?: string;
    cause?: unknown;
};

export class AppError extends Error {
    readonly status: number;
    readonly title: string;
    readonly detail: string;
    readonly type: string;

    constructor({ status, title, detail, type = 'about:blank', cause }: AppErrorOptions) {
        super(detail, { cause });

        this.name = 'AppError';
        this.status = status;
        this.title = title;
        this.detail = detail;
        this.type = type;
    }
}
