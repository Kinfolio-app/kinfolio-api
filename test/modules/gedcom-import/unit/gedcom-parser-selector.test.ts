import { describe, expect, it } from 'vitest';
import { GedcomFileDetector } from '../../../../src/modules/gedcom-import/gedcom-file-detector.js';
import { GedcomParserSelector } from '../../../../src/modules/gedcom-import/gedcom-parser-selector.js';
import { Gedcom551Parser } from '../../../../src/modules/gedcom-import/v5/parser.js';
import { Gedcom7Parser } from '../../../../src/modules/gedcom-import/v7/parser.js';

describe('GedcomParserSelector', () => {
    const selector = new GedcomParserSelector();

    it('selects the dedicated parser for each supported version', () => {
        expect(selector.select('5.5.1')).toBeInstanceOf(Gedcom551Parser);
        expect(selector.select('7.0')).toBeInstanceOf(Gedcom7Parser);
        expect(selector.select('7.0.18')).toBeInstanceOf(Gedcom7Parser);
    });

    it('runs the same detection and parsing pipeline used by scripts and API adapters', () => {
        const bytes = new TextEncoder().encode(
            [
                '0 HEAD',
                '1 GEDC',
                '2 VERS 7.0.18',
                '1 SOUR',
                '2 NAME Example',
                '0 INDI',
                '1 NAME Alice /Martin/',
                '0 TRLR',
            ].join('\n'),
        );
        const detection = new GedcomFileDetector().detect(bytes);

        expect(detection.success).toBe(true);
        if (!detection.success) throw new Error('Expected GEDCOM detection to succeed.');

        const result = selector.parse(detection.file);
        expect(result.document?.metadata.version).toBe('7.0.18');
        expect(result.document?.individuals[0]).toMatchObject({
            id: null,
            names: [{ value: 'Alice /Martin/' }],
        });
    });
});
