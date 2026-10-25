import type { APIInteraction } from 'discord-api-types/v10';
import type { Env } from './env';
import { handleInteraction } from './interactions';
import { verifyRequest } from './verify';

export default {
    async fetch(request, env, ctx): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === 'POST' && url.pathname === '/interactions') {
            const body = await verifyRequest(request, env.DISCORD_PUBLIC_KEY);
            if (body === null) return new Response('Invalid request signature', { status: 401 });

            const response = await handleInteraction({
                interaction: JSON.parse(body) as APIInteraction,
                env,
                waitUntil: promise => ctx.waitUntil(promise),
                now: Date.now(),
            });
            return Response.json(response);
        }

        if (request.method === 'GET' && url.pathname === '/') {
            return new Response('Historian Bot is running.');
        }

        return new Response('Not found', { status: 404 });
    },
} satisfies ExportedHandler<Env>;
