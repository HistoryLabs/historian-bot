import { generateKeyPairSync } from 'node:crypto';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
    const migrations = await readD1Migrations('./migrations');

    // A throwaway key pair so tests can sign interactions like Discord does
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const publicKeyHex = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');

    return {
        plugins: [
            cloudflareTest({
                wrangler: { configPath: './wrangler.jsonc' },
                miniflare: {
                    bindings: {
                        TEST_MIGRATIONS: migrations,
                        TEST_PRIVATE_KEY: privateKey.export({ format: 'jwk' }),
                        DISCORD_PUBLIC_KEY: publicKeyHex,
                        DISCORD_TOKEN: 'test-token',
                    },
                },
            }),
        ],
        test: {
            setupFiles: ['./test/setup.ts'],
            // discord-api-types is CommonJS; pre-bundle it so its enums load in the Workers runtime
            deps: { optimizer: { ssr: { enabled: true, include: ['discord-api-types/v10'] } } },
        },
    };
});
