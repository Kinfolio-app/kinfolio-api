import { isAsciiDigits } from './gedcom-character-utils.js';
import {
    GedcomDetectionDiagnosticCode,
    type GedcomDetectionDiagnostic,
    type GedcomDetectionResult,
    type SupportedGedcomVersion,
} from './gedcom-file.types.js';

export const MAX_GEDCOM_HEADER_BYTES = 64 * 1024;
export const MAX_GEDCOM_HEADER_LINES = 1_000;

const UTF8_BYTE_ORDER_MARK = [0xef, 0xbb, 0xbf] as const;

type BasicGedcomLine = {
    level: number;
    tag: string;
    value: string | null;
    lineNumber: number;
};

type GedcomHeaderProbe = {
    hasHeader: boolean;
    version: { value: string; line: number } | null;
    characterEncoding: { value: string; line: number } | null;
    invalid: { message: string; line: number } | null;
    truncated: boolean;
};

function error(
    code: GedcomDetectionDiagnostic['code'],
    message: string,
    line: number | null = null,
): GedcomDetectionResult {
    return {
        success: false,
        diagnostics: [
            {
                severity: 'error',
                code,
                message,
                line,
            },
        ],
    };
}

function startsWithBytes(input: Uint8Array, expected: readonly number[]): boolean {
    if (input.length < expected.length) {
        return false;
    }

    return expected.every((byte, index) => input[index] === byte);
}

function hasZipSignature(input: Uint8Array): boolean {
    return (
        startsWithBytes(input, [0x50, 0x4b, 0x03, 0x04]) ||
        startsWithBytes(input, [0x50, 0x4b, 0x05, 0x06]) ||
        startsWithBytes(input, [0x50, 0x4b, 0x07, 0x08])
    );
}

function hasUtf16ByteOrderMark(input: Uint8Array): boolean {
    return startsWithBytes(input, [0xff, 0xfe]) || startsWithBytes(input, [0xfe, 0xff]);
}

function toBytePreservingString(input: Uint8Array): string {
    let content = '';

    for (const byte of input) {
        content += String.fromCharCode(byte);
    }

    return content;
}

function splitLines(
    content: string,
    maximumLines: number,
): { lines: string[]; truncated: boolean } {
    const lines: string[] = [];
    let lineStart = 0;

    for (let index = 0; index < content.length; index += 1) {
        const character = content.charCodeAt(index);

        if (character !== 0x0a && character !== 0x0d) {
            continue;
        }

        lines.push(content.slice(lineStart, index));

        if (lines.length >= maximumLines) {
            return { lines, truncated: index < content.length - 1 };
        }

        if (character === 0x0d && content.charCodeAt(index + 1) === 0x0a) {
            index += 1;
        }

        lineStart = index + 1;
    }

    lines.push(content.slice(lineStart));

    return { lines, truncated: false };
}

function parseBasicLine(content: string, lineNumber: number): BasicGedcomLine | null {
    const levelSeparator = content.indexOf(' ');

    if (levelSeparator <= 0) {
        return null;
    }

    const levelValue = content.slice(0, levelSeparator);

    if (!isAsciiDigits(levelValue)) {
        return null;
    }

    const remainder = content.slice(levelSeparator + 1);
    const valueSeparator = remainder.indexOf(' ');
    const tag = valueSeparator === -1 ? remainder : remainder.slice(0, valueSeparator);

    if (tag.length === 0) {
        return null;
    }

    return {
        level: Number(levelValue),
        tag,
        value: valueSeparator === -1 ? null : remainder.slice(valueSeparator + 1),
        lineNumber,
    };
}

function probeHeader(input: Uint8Array, byteOffset: number): GedcomHeaderProbe {
    const availableBytes = input.length - byteOffset;
    const headerByteLength = Math.min(availableBytes, MAX_GEDCOM_HEADER_BYTES);
    const headerBytes = input.subarray(byteOffset, byteOffset + headerByteLength);
    const headerContent = toBytePreservingString(headerBytes);
    const splitResult = splitLines(headerContent, MAX_GEDCOM_HEADER_LINES);
    const firstLine = parseBasicLine(splitResult.lines[0] ?? '', 1);

    if (firstLine === null || firstLine.level !== 0 || firstLine.tag !== 'HEAD') {
        return {
            hasHeader: false,
            version: null,
            characterEncoding: null,
            invalid: null,
            truncated: splitResult.truncated || availableBytes > headerByteLength,
        };
    }

    let insideGedcomMetadata = false;
    let gedcomMetadataCount = 0;
    let version: GedcomHeaderProbe['version'] = null;
    let characterEncoding: GedcomHeaderProbe['characterEncoding'] = null;
    let invalid: GedcomHeaderProbe['invalid'] = null;
    let reachedHeaderEnd = false;

    for (let index = 1; index < splitResult.lines.length; index += 1) {
        const line = parseBasicLine(splitResult.lines[index] ?? '', index + 1);

        if (line === null) {
            continue;
        }

        if (line.level === 0) {
            reachedHeaderEnd = true;
            break;
        }

        if (line.level === 1) {
            insideGedcomMetadata = line.tag === 'GEDC';

            if (line.tag === 'GEDC') {
                gedcomMetadataCount += 1;

                if (gedcomMetadataCount > 1 && invalid === null) {
                    invalid = {
                        message: 'The GEDCOM header must contain exactly one GEDC structure.',
                        line: line.lineNumber,
                    };
                }
            }

            if (line.tag === 'CHAR' && line.value !== null) {
                if (characterEncoding === null) {
                    characterEncoding = { value: line.value, line: line.lineNumber };
                } else if (invalid === null) {
                    invalid = {
                        message: 'The GEDCOM header must not declare CHAR more than once.',
                        line: line.lineNumber,
                    };
                }
            }

            continue;
        }

        if (
            insideGedcomMetadata &&
            line.level === 2 &&
            line.tag === 'VERS' &&
            line.value !== null
        ) {
            if (version === null) {
                version = { value: line.value, line: line.lineNumber };
            } else if (invalid === null) {
                invalid = {
                    message: 'The GEDCOM header must not declare GEDC.VERS more than once.',
                    line: line.lineNumber,
                };
            }
        }
    }

    return {
        hasHeader: true,
        version,
        characterEncoding,
        invalid,
        truncated:
            !reachedHeaderEnd && (splitResult.truncated || availableBytes > headerByteLength),
    };
}

function parseSupportedVersion(value: string): SupportedGedcomVersion | null {
    if (value === '5.5.1' || value === '7.0') {
        return value;
    }

    const parts = value.split('.');

    if (
        parts.length !== 3 ||
        parts[0] !== '7' ||
        parts[1] !== '0' ||
        !isAsciiDigits(parts[2] ?? '')
    ) {
        return null;
    }

    const patchVersion = parts[2] ?? '';

    if (patchVersion.length > 1 && patchVersion.startsWith('0')) {
        return null;
    }

    return value as `7.0.${number}`;
}

function decodeUtf8(input: Uint8Array): string | null {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
        return null;
    }
}

export class GedcomFileDetector {
    detect(input: Uint8Array): GedcomDetectionResult {
        if (hasZipSignature(input)) {
            return error(
                GedcomDetectionDiagnosticCode.UnsupportedContainer,
                'ZIP and GEDZIP containers are not supported. Provide a raw GEDCOM file.',
            );
        }

        if (hasUtf16ByteOrderMark(input)) {
            return error(
                GedcomDetectionDiagnosticCode.UnsupportedCharacterEncoding,
                'UTF-16 is not supported. Provide a GEDCOM file encoded as UTF-8.',
            );
        }

        const hasByteOrderMark = startsWithBytes(input, UTF8_BYTE_ORDER_MARK);
        const header = probeHeader(input, hasByteOrderMark ? UTF8_BYTE_ORDER_MARK.length : 0);

        if (!header.hasHeader) {
            return error(
                GedcomDetectionDiagnosticCode.MissingHeader,
                'The file must start with a GEDCOM HEAD record.',
                1,
            );
        }

        if (header.invalid !== null) {
            return error(
                GedcomDetectionDiagnosticCode.InvalidHeader,
                header.invalid.message,
                header.invalid.line,
            );
        }

        if (header.version === null) {
            if (header.truncated) {
                return error(
                    GedcomDetectionDiagnosticCode.HeaderLimitExceeded,
                    'The GEDCOM version was not found within the header inspection limit.',
                );
            }

            return error(
                GedcomDetectionDiagnosticCode.MissingGedcomVersion,
                'The GEDCOM header must declare GEDC.VERS.',
            );
        }

        const version = parseSupportedVersion(header.version.value);

        if (version === null) {
            return error(
                GedcomDetectionDiagnosticCode.UnsupportedGedcomVersion,
                `GEDCOM version ${header.version.value} is not supported.`,
                header.version.line,
            );
        }

        if (version === '5.5.1') {
            if (header.characterEncoding === null) {
                if (header.truncated) {
                    return error(
                        GedcomDetectionDiagnosticCode.HeaderLimitExceeded,
                        'The character encoding was not found within the header inspection limit.',
                    );
                }

                return error(
                    GedcomDetectionDiagnosticCode.MissingCharacterEncoding,
                    'A GEDCOM 5.5.1 header must declare CHAR UTF-8.',
                );
            }

            if (header.characterEncoding.value !== 'UTF-8') {
                return error(
                    GedcomDetectionDiagnosticCode.UnsupportedCharacterEncoding,
                    `Character encoding ${header.characterEncoding.value} is not supported. Re-export the GEDCOM file as UTF-8.`,
                    header.characterEncoding.line,
                );
            }
        } else if (header.characterEncoding !== null) {
            return error(
                GedcomDetectionDiagnosticCode.VersionEncodingMismatch,
                'GEDCOM 7 is always UTF-8 and must not declare HEAD.CHAR.',
                header.characterEncoding.line,
            );
        }

        const content = decodeUtf8(input);

        if (content === null) {
            return error(
                GedcomDetectionDiagnosticCode.InvalidUtf8,
                'The GEDCOM file contains invalid UTF-8.',
            );
        }

        return {
            success: true,
            file: {
                descriptor: {
                    container: 'gedcom',
                    version,
                    characterEncoding: 'utf-8',
                    hasByteOrderMark,
                },
                content,
            },
        };
    }
}
