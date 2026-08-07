import { Pool, type PoolClient } from 'pg';

export type QueryableDatabase = Pick<Pool, 'query'>;
export type Database = Pool | PoolClient;

export async function runInTransaction<T>(
    database: Database,
    operation: (transaction: QueryableDatabase) => Promise<T>,
): Promise<T> {
    if (!(database instanceof Pool)) {
        return operation(database);
    }

    const client = await database.connect();

    try {
        await client.query('BEGIN');
        const result = await operation(client);
        await client.query('COMMIT');

        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
