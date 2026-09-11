import { Check } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import { SupportedGedcomVersionSchema } from '../../../../src/modules/gedcom-import/gedcom-file.schema.js';

describe('SupportedGedcomVersionSchema', () => {
    it.each(['5.5.1', '7.0', '7.0.0', '7.0.18'])('accepts supported version %s', (version) => {
        expect(Check(SupportedGedcomVersionSchema, version)).toBe(true);
    });

    it.each(['5.5', '7.1', '7.0.01', 'invalid'])('rejects unsupported version %s', (version) => {
        expect(Check(SupportedGedcomVersionSchema, version)).toBe(false);
    });
});
