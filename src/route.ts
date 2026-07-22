import type { FastifyPluginAsync } from 'fastify';

const routes: FastifyPluginAsync = async (fastify, _options) => {
    fastify.get('/', async (_request, _reply) => {
        return { hello: "world" }
    });

    fastify.get('/ping', async (_request, _reply) => {
        return 'pong\n'
    })
}

export default routes;