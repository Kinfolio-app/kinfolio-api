import { describe, expect, it } from 'vitest';
import {
    isValidGedcom7Pointer,
    parseGedcom7Line,
} from '../../../../src/modules/gedcom-import/v7/line-parser.js';

describe('parseGedcom7Line', () => {
    it('accepts long extension tags and unbounded levels', () => {
        const result = parseGedcom7Line('123 _A_VERY_LONG_EXTENSION_TAG value', 8);

        expect(result).toEqual(
            expect.objectContaining({
                success: true,
                node: expect.objectContaining({
                    level: 123,
                    tag: '_A_VERY_LONG_EXTENSION_TAG',
                    value: 'value',
                }),
            }),
        );
    });

    it('decodes a leading escaped at sign in a string payload', () => {
        const result = parseGedcom7Line('1 NOTE @@person', 1);

        expect(result).toEqual(
            expect.objectContaining({
                success: true,
                node: expect.objectContaining({ value: '@person' }),
            }),
        );
    });

    it('preserves a leading space after the single delimiter', () => {
        const result = parseGedcom7Line('1 NOTE  indented', 1);

        expect(result).toEqual(
            expect.objectContaining({
                success: true,
                node: expect.objectContaining({ value: ' indented' }),
            }),
        );
    });

    it('accepts @VOID@ as a pointer but not as an identifier', () => {
        expect(isValidGedcom7Pointer('@VOID@')).toBe(true);
        expect(parseGedcom7Line('0 @VOID@ INDI', 1).success).toBe(false);
    });

    it.each(['01 HEAD', '0 __bad', '0 @I-1@ INDI', '0 HEAD '])(
        'rejects malformed line %s',
        (line) => {
            expect(parseGedcom7Line(line, 1).success).toBe(false);
        },
    );

    it('rejects a nesting level that could exhaust memory', () => {
        expect(parseGedcom7Line('1001 NOTE value', 1).success).toBe(false);
    });
});
