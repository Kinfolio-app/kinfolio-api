import type { FastifyPluginCallback } from 'fastify';

const healthRoutes: FastifyPluginCallback = (fastify, options, done) => {
    void options;

    fastify.get('/health', () => {
        return {
            status: 'ok',
        };
    });

    done();
};

export default healthRoutes;
