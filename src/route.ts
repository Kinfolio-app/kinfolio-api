import type { FastifyPluginCallback } from 'fastify';

const routes: FastifyPluginCallback = (fastify, options, done) => {
    void options;

    fastify.get('/health', () => {
        return {
            status: 'ok',
        };
    });

    done();
};

export default routes;
