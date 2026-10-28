const keys = new Map<string, Promise<CryptoKey>>();

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    return bytes;
}

function importKey(publicKey: string): Promise<CryptoKey> {
    let key = keys.get(publicKey);
    if (!key) {
        key = crypto.subtle.importKey('raw', hexToBytes(publicKey), { name: 'Ed25519' }, false, ['verify']);
        keys.set(publicKey, key);
    }
    return key;
}

/**
 * Checks the Ed25519 signature Discord puts on every interaction request.
 * Returns the raw body if it's valid, or null if it isn't.
 */
export async function verifyRequest(request: Request, publicKey: string): Promise<string | null> {
    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');
    const body = await request.text();
    if (!signature || !timestamp || !/^[0-9a-f]{128}$/i.test(signature)) return null;

    const valid = await crypto.subtle.verify(
        'Ed25519',
        await importKey(publicKey),
        hexToBytes(signature),
        new TextEncoder().encode(timestamp + body),
    );
    return valid ? body : null;
}
