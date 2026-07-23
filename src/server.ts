import { buildApp } from './app.js';
import { loadConfig } from './config/env.js';

const config = loadConfig();
const app = buildApp({ config });

const run = async () => {
    try {
        const address = await app.listen({ host: config.host, port: config.port });
        app.log.info(`server listening on ${address}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
await run();
