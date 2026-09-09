// Matches exactly 32 bytes encoded as 64 lowercase or uppercase hexadecimal characters; it has no capture groups.
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

export function decodeSha256(value: string): Buffer {
    if (!SHA256_HEX_PATTERN.test(value)) {
        throw new Error('A SHA-256 fingerprint must contain exactly 64 hexadecimal characters.');
    }

    return Buffer.from(value, 'hex');
}

export function encodeSha256(value: Uint8Array): string {
    return Buffer.from(value).toString('hex');
}
