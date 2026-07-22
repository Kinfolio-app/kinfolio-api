import type { FastifyPluginCallback } from 'fastify';

const routes: FastifyPluginCallback = (fastify, options, done) => {
    void options;

    fastify.get('/', () => {
        return { hello: 'world' };
    });

    fastify.get('/ping', () => {
        return 'pong\n';
    });

    done();
};

export default routes;
