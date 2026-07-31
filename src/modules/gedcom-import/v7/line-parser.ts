import {
    parseGedcomLineWithRules,
    type GedcomLineParseResult,
} from '../common/gedcom-line-parser.js';

export type Gedcom7LineParseResult = GedcomLineParseResult;

export const MAX_GEDCOM_7_NESTING_LEVEL = 1_000;

function isTagCharacter(character: string): boolean {
    return (
        (character >= 'A' && character <= 'Z') ||
        (character >= '0' && character <= '9') ||
        character === '_'
    );
}

function isValidTag(tag: string): boolean {
    if (tag.length === 0) {
        return false;
    }

    const firstCharacter = tag[0];

    if (
        firstCharacter === undefined ||
        !((firstCharacter >= 'A' && firstCharacter <= 'Z') || firstCharacter === '_')
    ) {
        return false;
    }

    if (tag === '_') {
        return false;
    }

    return [...tag].every(isTagCharacter);
}

export function isValidGedcom7Xref(value: string): boolean {
    if (
        value === '@VOID@' ||
        value.length < 3 ||
        value[0] !== '@' ||
        value[value.length - 1] !== '@'
    ) {
        return false;
    }

    return [...value.slice(1, -1)].every(isTagCharacter);
}

export function isValidGedcom7Pointer(value: string): boolean {
    return value === '@VOID@' || isValidGedcom7Xref(value);
}

export function parseGedcom7Line(content: string, lineNumber: number): Gedcom7LineParseResult {
    return parseGedcomLineWithRules(content, lineNumber, {
        dialectName: 'GEDCOM 7',
        maximumLevel: MAX_GEDCOM_7_NESTING_LEVEL,
        maximumLevelMessage: `A GEDCOM 7 level must not exceed the safety limit of ${MAX_GEDCOM_7_NESTING_LEVEL}.`,
        isValidTag,
        isValidXref: isValidGedcom7Xref,
        decodeLeadingAtSign: true,
    });
}
