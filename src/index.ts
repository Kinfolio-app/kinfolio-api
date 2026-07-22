import Fastify from 'fastify';
import dbConnector from './config/db.js'
import routes from './route.js';

const server = Fastify({
    logger: true,
});

server.register(dbConnector);
server.register(routes);

const host: string = process.env.HOST || '0.0.0.0';
const port: number = Number(process.env.PORT || 3000);

const start = async () => {
    try {
        let address = await server.listen({ host, port });
        server.log.info(`server listening on ${address}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}

start();
