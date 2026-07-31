import type { GedcomNode, GedcomSourceLocation } from './gedcom-parser.types.js';
import { isAsciiDigits } from './gedcom-character-utils.js';

export type GedcomLineParseResult =
    | {
          success: true;
          node: GedcomNode;
      }
    | {
          success: false;
          message: string;
          location: GedcomSourceLocation;
      };

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

function failure(message: string, line: number, column = 1): GedcomLineParseResult {
    return {
        success: false,
        message,
        location: { line, column },
    };
}

export function parseGedcomLine(content: string, lineNumber: number): GedcomLineParseResult {
    const levelSeparator = content.indexOf(' ');

    if (levelSeparator <= 0) {
        return failure('A GEDCOM line must start with a level followed by a space.', lineNumber);
    }

    const levelText = content.slice(0, levelSeparator);

    if (!isAsciiDigits(levelText) || (levelText.length > 1 && levelText.startsWith('0'))) {
        return failure('A GEDCOM level must be an integer without leading zeroes.', lineNumber);
    }

    const level = Number(levelText);

    if (level > 99) {
        return failure('A GEDCOM level must be between 0 and 99.', lineNumber);
    }

    const remainder = content.slice(levelSeparator + 1);

    if (remainder.length === 0 || remainder.startsWith(' ')) {
        return failure('A GEDCOM line must contain a tag after its level.', lineNumber);
    }

    const firstTokenEnd = remainder.indexOf(' ');
    const firstToken = firstTokenEnd === -1 ? remainder : remainder.slice(0, firstTokenEnd);
    let xref: string | null = null;
    let tag: string;
    let value: string | null;

    if (firstToken.startsWith('@')) {
        if (!isValidXref(firstToken)) {
            return failure('The GEDCOM cross-reference identifier is invalid.', lineNumber);
        }

        if (firstTokenEnd === -1) {
            return failure('A GEDCOM record identifier must be followed by a tag.', lineNumber);
        }

        xref = firstToken;
        const afterXref = remainder.slice(firstTokenEnd + 1);

        if (afterXref.length === 0 || afterXref.startsWith(' ')) {
            return failure('A GEDCOM record identifier must be followed by a tag.', lineNumber);
        }

        const tagEnd = afterXref.indexOf(' ');
        tag = tagEnd === -1 ? afterXref : afterXref.slice(0, tagEnd);
        value = tagEnd === -1 ? null : afterXref.slice(tagEnd + 1);
    } else {
        tag = firstToken;
        value = firstTokenEnd === -1 ? null : remainder.slice(firstTokenEnd + 1);
    }

    if (!isValidTag(tag)) {
        return failure('The GEDCOM tag is invalid.', lineNumber, levelSeparator + 2);
    }

    if (value === '') {
        return failure('A GEDCOM line must not end with an empty value delimiter.', lineNumber);
    }

    return {
        success: true,
        node: {
            level,
            tag,
            xref,
            value,
            children: [],
            location: {
                line: lineNumber,
                column: 1,
            },
        },
    };
}
