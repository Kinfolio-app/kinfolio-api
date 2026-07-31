import { describe, expect, it } from 'vitest';
import { parseGedcomLine } from '../../../../src/modules/gedcom-import/gedcom-line-parser.js';

describe('parseGedcomLine', () => {
    it('parses a record without a value', () => {
        expect(parseGedcomLine('0 HEAD', 4)).toEqual({
            success: true,
            node: {
                level: 0,
                tag: 'HEAD',
                xref: null,
                value: null,
                children: [],
                location: { line: 4, column: 1 },
            },
        });
    });

    it('parses a record identifier before its tag', () => {
        const result = parseGedcomLine('0 @I1@ INDI', 1);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.node).toMatchObject({ level: 0, tag: 'INDI', xref: '@I1@', value: null });
        }
    });

    it('preserves the complete value after the tag', () => {
        const result = parseGedcomLine('1 NAME Alice Louise /Martin/', 2);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.node.value).toBe('Alice Louise /Martin/');
        }
    });

    it.each([
        ['00 HEAD', 'leading zeroes'],
        ['100 HEAD', 'between 0 and 99'],
        ['0 head', 'tag is invalid'],
        ['0 @I 1@ INDI', 'cross-reference identifier is invalid'],
        ['0 HEAD ', 'empty value delimiter'],
    ])('rejects malformed line %s', (content, expectedMessage) => {
        const result = parseGedcomLine(content, 7);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.message).toContain(expectedMessage);
            expect(result.location.line).toBe(7);
        }
    });
});
