import { describe, expect, it } from 'vitest';
import { isAsciiDigits } from '../../../../src/modules/gedcom-import/gedcom-character-utils.js';

describe('isAsciiDigits', () => {
    it.each(['0', '1234567890'])('accepts ASCII digits in %s', (value) => {
        expect(isAsciiDigits(value)).toBe(true);
    });

    it.each(['', '12a', '１２', '1 2'])('rejects non-ASCII digit sequence %s', (value) => {
        expect(isAsciiDigits(value)).toBe(false);
    });
});
