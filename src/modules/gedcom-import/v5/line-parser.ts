import {
    parseGedcomLineWithRules,
    type GedcomLineParseResult,
} from '../common/gedcom-line-parser.js';

export type { GedcomLineParseResult } from '../common/gedcom-line-parser.js';

function isValidTag(tag: string): boolean {
    if (tag.length === 0 || tag.length > 31) {
        return false;
    }

    for (const character of tag) {
        const isUppercaseLetter = character >= 'A' && character <= 'Z';
        const isDigit = character >= '0' && character <= '9';

        if (!isUppercaseLetter && !isDigit && character !== '_') {
            return false;
        }
    }

    return true;
}

export function isValidXref(value: string): boolean {
    if (value.length < 3 || value[0] !== '@' || value[value.length - 1] !== '@') {
        return false;
    }

    for (let index = 1; index < value.length - 1; index += 1) {
        const character = value[index];

        if (character === '@' || character === ' ' || character === undefined) {
            return false;
        }
    }

    return true;
}

export function parseGedcomLine(content: string, lineNumber: number): GedcomLineParseResult {
    return parseGedcomLineWithRules(content, lineNumber, {
        dialectName: 'GEDCOM',
        maximumLevel: 99,
        maximumLevelMessage: 'A GEDCOM level must be between 0 and 99.',
        isValidTag,
        isValidXref,
        decodeLeadingAtSign: false,
    });
}
