import Fastify from 'fastify';
import routes from './route.js';

const server = Fastify({
    logger: true,
});

server.register(routes);

const start = async () => {
    try {
        let address = await server.listen({ host: '0.0.0.0', port: 3000 });
        server.log.info(`server listening on ${address}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}

start();
