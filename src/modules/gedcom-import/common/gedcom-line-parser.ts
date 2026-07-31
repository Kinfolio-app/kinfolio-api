import { isAsciiDigits } from './gedcom-character-utils.js';
import type { GedcomNode, GedcomSourceLocation } from './gedcom-parser.types.js';

export type GedcomLineParseResult =
    | { success: true; node: GedcomNode }
    | { success: false; message: string; location: GedcomSourceLocation };

export type GedcomLineRules = {
    dialectName: string;
    maximumLevel: number;
    maximumLevelMessage: string;
    isValidTag: (tag: string) => boolean;
    isValidXref: (value: string) => boolean;
    decodeLeadingAtSign: boolean;
};

function failure(message: string, line: number, column = 1): GedcomLineParseResult {
    return { success: false, message, location: { line, column } };
}

export function parseGedcomLineWithRules(
    content: string,
    lineNumber: number,
    rules: GedcomLineRules,
): GedcomLineParseResult {
    const levelSeparator = content.indexOf(' ');

    if (levelSeparator <= 0) {
        return failure(
            `A ${rules.dialectName} line must start with a level followed by one space.`,
            lineNumber,
        );
    }

    const levelText = content.slice(0, levelSeparator);

    if (!isAsciiDigits(levelText) || (levelText.length > 1 && levelText.startsWith('0'))) {
        return failure(
            `A ${rules.dialectName} level must be an integer without leading zeroes.`,
            lineNumber,
        );
    }

    const level = Number(levelText);

    if (!Number.isSafeInteger(level) || level > rules.maximumLevel) {
        return failure(rules.maximumLevelMessage, lineNumber);
    }

    const remainder = content.slice(levelSeparator + 1);

    if (remainder.length === 0 || remainder.startsWith(' ')) {
        return failure(
            `A ${rules.dialectName} line must contain a tag after its level.`,
            lineNumber,
        );
    }

    const firstTokenEnd = remainder.indexOf(' ');
    const firstToken = firstTokenEnd === -1 ? remainder : remainder.slice(0, firstTokenEnd);
    let xref: string | null = null;
    let tag: string;
    let value: string | null;

    if (firstToken.startsWith('@')) {
        if (!rules.isValidXref(firstToken)) {
            return failure(
                `The ${rules.dialectName} cross-reference identifier is invalid.`,
                lineNumber,
            );
        }

        if (firstTokenEnd === -1) {
            return failure(
                `A ${rules.dialectName} record identifier must be followed by a tag.`,
                lineNumber,
            );
        }

        xref = firstToken;
        const afterXref = remainder.slice(firstTokenEnd + 1);

        if (afterXref.length === 0 || afterXref.startsWith(' ')) {
            return failure(
                `A ${rules.dialectName} record identifier must be followed by a tag.`,
                lineNumber,
            );
        }

        const tagEnd = afterXref.indexOf(' ');
        tag = tagEnd === -1 ? afterXref : afterXref.slice(0, tagEnd);
        value = tagEnd === -1 ? null : afterXref.slice(tagEnd + 1);
    } else {
        tag = firstToken;
        value = firstTokenEnd === -1 ? null : remainder.slice(firstTokenEnd + 1);
    }

    if (!rules.isValidTag(tag)) {
        return failure(`The ${rules.dialectName} tag is invalid.`, lineNumber, levelSeparator + 2);
    }

    if (value === '') {
        return failure(
            `A ${rules.dialectName} line must not end with an empty value delimiter.`,
            lineNumber,
        );
    }

    if (rules.decodeLeadingAtSign && value?.startsWith('@@')) {
        value = value.slice(1);
    }

    return {
        success: true,
        node: {
            level,
            tag,
            xref,
            value,
            children: [],
            location: { line: lineNumber, column: 1 },
        },
    };
}
