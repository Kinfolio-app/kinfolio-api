export type AppConfig = {
    host: string;
    port: number;
    databaseUrl: string;
};

function parseHost(value: string | undefined): string {
    const host = value?.trim() || '0.0.0.0';

    if (host.length === 0) {
        throw new Error('HOST must not be empty');
    }

    return host;
}

function parsePort(value: string | undefined): number {
    const rawPort = value ?? '3000';

    if (!/^\d+$/.test(rawPort)) {
        throw new Error('PORT must be an integer');
    }

    const port = Number(rawPort);

    if (port < 1 || port > 65_535) {
        throw new Error('PORT must be between 1 and 65535');
    }

    return port;
}

function parseDatabaseUrl(value: string | undefined): string {
    if (value === undefined || value.trim() === '') {
        throw new Error('DATABASE_URL is required');
    }

    let url: URL;

    try {
        url = new URL(value);
    } catch {
        throw new Error('DATABASE_URL must be a valid URL');
    }

    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
        throw new Error('DATABASE_URL must use the postgres or postgresql protocol');
    }

    if (url.pathname === '' || url.pathname === '/') {
        throw new Error('DATABASE_URL must specify a database');
    }

    return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
    const host = parseHost(env.HOST);
    const port = parsePort(env.PORT);
    const databaseUrl = parseDatabaseUrl(env.DATABASE_URL);

    return {
        host,
        port,
        databaseUrl,
    };
}
