import { buildApp } from './app.js';

const host: string = process.env.HOST || '0.0.0.0';
const port: number = Number(process.env.PORT || 3000);

const app = buildApp();

const run = async () => {
    try {
        const address = await app.listen({ host, port });
        app.log.info(`server listening on ${address}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
run();