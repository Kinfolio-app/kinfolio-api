import { describe, expect, it } from 'vitest';
import {
    GedcomFileDetector,
    MAX_GEDCOM_HEADER_BYTES,
} from '../../../../src/modules/gedcom-import/gedcom-file-detector.js';
import { GedcomDetectionDiagnosticCode } from '../../../../src/modules/gedcom-import/gedcom-file.types.js';

const detector = new GedcomFileDetector();
const encoder = new TextEncoder();

function encode(content: string): Uint8Array {
    return encoder.encode(content);
}

function expectError(
    input: Uint8Array,
    code: (typeof GedcomDetectionDiagnosticCode)[keyof typeof GedcomDetectionDiagnosticCode],
): void {
    const result = detector.detect(input);

    expect(result.success).toBe(false);

    if (result.success) {
        throw new Error('Expected GEDCOM detection to fail.');
    }

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(code);
}

describe('GedcomFileDetector', () => {
    it('detects a GEDCOM 5.5.1 file encoded as UTF-8', () => {
        const input = encode(
            [
                '0 HEAD',
                '1 SOUR HEREDIS',
                '1 GEDC',
                '2 VERS 5.5.1',
                '2 FORM LINEAGE-LINKED',
                '1 CHAR UTF-8',
                '0 @I1@ INDI',
                '1 NAME Élodie /Martin/',
                '0 TRLR',
            ].join('\n'),
        );

        const result = detector.detect(input);

        expect(result).toEqual({
            success: true,
            file: {
                descriptor: {
                    container: 'gedcom',
                    version: '5.5.1',
                    characterEncoding: 'utf-8',
                    hasByteOrderMark: false,
                },
                content: new TextDecoder().decode(input),
            },
        });
    });

    it.each(['7.0', '7.0.18'])('detects GEDCOM version %s', (version) => {
        const content = ['0 HEAD', '1 GEDC', `2 VERS ${version}`, '0 TRLR'].join('\r\n');
        const encodedContent = encode(content);
        const input = new Uint8Array([0xef, 0xbb, 0xbf, ...encodedContent]);

        const result = detector.detect(input);

        expect(result.success).toBe(true);

        if (!result.success) {
            throw new Error('Expected GEDCOM detection to succeed.');
        }

        expect(result.file.descriptor).toEqual({
            container: 'gedcom',
            version,
            characterEncoding: 'utf-8',
            hasByteOrderMark: true,
        });
        expect(result.file.content).toBe(content);
    });

    it('rejects an ANSEL GEDCOM file before decoding its genealogy data', () => {
        const header = encode(
            ['0 HEAD', '1 GEDC', '2 VERS 5.5.1', '1 CHAR ANSEL', '0 @I1@ INDI', '1 NAME '].join(
                '\n',
            ),
        );
        const input = new Uint8Array([...header, 0xff]);

        expectError(input, GedcomDetectionDiagnosticCode.UnsupportedCharacterEncoding);
    });

    it('rejects a GEDCOM 5.5.1 file without a character encoding', () => {
        const input = encode(['0 HEAD', '1 GEDC', '2 VERS 5.5.1', '0 TRLR'].join('\n'));

        expectError(input, GedcomDetectionDiagnosticCode.MissingCharacterEncoding);
    });

    it('rejects a GEDCOM 7 file declaring HEAD.CHAR', () => {
        const input = encode(
            ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 CHAR UTF-8', '0 TRLR'].join('\n'),
        );

        expectError(input, GedcomDetectionDiagnosticCode.VersionEncodingMismatch);
    });

    it('rejects a file without a GEDCOM header', () => {
        expectError(encode('not a GEDCOM file'), GedcomDetectionDiagnosticCode.MissingHeader);
    });

    it('rejects a GEDCOM file without a declared version', () => {
        const input = encode(['0 HEAD', '1 CHAR UTF-8', '0 TRLR'].join('\n'));

        expectError(input, GedcomDetectionDiagnosticCode.MissingGedcomVersion);
    });

    it.each([
        [
            'duplicate GEDC structures',
            ['0 HEAD', '1 GEDC', '2 VERS 5.5.1', '1 GEDC', '2 VERS 5.5.1', '1 CHAR UTF-8'],
        ],
        [
            'duplicate version declarations',
            ['0 HEAD', '1 GEDC', '2 VERS 5.5.1', '2 VERS 5.5.1', '1 CHAR UTF-8'],
        ],
        [
            'duplicate character encoding declarations',
            ['0 HEAD', '1 GEDC', '2 VERS 5.5.1', '1 CHAR UTF-8', '1 CHAR UTF-8'],
        ],
    ])('rejects an invalid header containing %s', (_description, lines) => {
        const input = encode([...lines, '0 TRLR'].join('\n'));

        expectError(input, GedcomDetectionDiagnosticCode.InvalidHeader);
    });

    it.each(['5.5', '7.1', '7.0.01', 'invalid'])('rejects unsupported version %s', (version) => {
        const input = encode(['0 HEAD', '1 GEDC', `2 VERS ${version}`, '0 TRLR'].join('\n'));

        expectError(input, GedcomDetectionDiagnosticCode.UnsupportedGedcomVersion);
    });

    it('rejects invalid UTF-8 after accepting the header contract', () => {
        const header = encode(
            ['0 HEAD', '1 GEDC', '2 VERS 5.5.1', '1 CHAR UTF-8', '0 @I1@ INDI', '1 NAME '].join(
                '\n',
            ),
        );
        const input = new Uint8Array([...header, 0xff]);

        expectError(input, GedcomDetectionDiagnosticCode.InvalidUtf8);
    });

    it.each([
        new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
        new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
        new Uint8Array([0x50, 0x4b, 0x07, 0x08]),
    ])('rejects ZIP and GEDZIP signatures', (input) => {
        expectError(input, GedcomDetectionDiagnosticCode.UnsupportedContainer);
    });

    it.each([new Uint8Array([0xff, 0xfe, 0x30, 0x00]), new Uint8Array([0xfe, 0xff, 0x00, 0x30])])(
        'rejects UTF-16 byte-order marks',
        (input) => {
            expectError(input, GedcomDetectionDiagnosticCode.UnsupportedCharacterEncoding);
        },
    );

    it('stops inspecting an oversized header', () => {
        const input = encode(`0 HEAD\n1 NOTE ${'a'.repeat(MAX_GEDCOM_HEADER_BYTES)}\n0 TRLR`);

        expectError(input, GedcomDetectionDiagnosticCode.HeaderLimitExceeded);
    });
});
