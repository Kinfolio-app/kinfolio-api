import Fastify from 'fastify';
import dbConnector from './plugins/database.js'
import routes from './route.js';

export function buildApp() {
    const app = Fastify({
        logger: true,
    });

    app.register(dbConnector);
    app.register(routes);

    return app;
}