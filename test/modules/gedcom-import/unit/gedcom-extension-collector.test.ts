import { describe, expect, it } from 'vitest';
import { collectGedcomExtensions } from '../../../../src/modules/gedcom-import/gedcom-extension-collector.js';
import type { DetectedGedcomFile } from '../../../../src/modules/gedcom-import/gedcom-file.types.js';
import { Gedcom7Parser } from '../../../../src/modules/gedcom-import/v7/parser.js';

function parseDocument(lines: string[]) {
    const file: DetectedGedcomFile = {
        descriptor: {
            container: 'gedcom',
            version: '7.0.18',
            characterEncoding: 'utf-8',
            hasByteOrderMark: false,
        },
        content: lines.join('\n'),
    };
    const result = new Gedcom7Parser().parse(file);

    expect(result.diagnostics).toEqual([]);
    expect(result.document).not.toBeNull();

    if (result.document === null) {
        throw new Error('Expected the GEDCOM fixture to produce a normalized document.');
    }

    return result.document;
}

describe('collectGedcomExtensions', () => {
    it('collects extensions across the normalized document without counting children twice', () => {
        const document = parseDocument([
            '0 HEAD',
            '1 GEDC',
            '2 VERS 7.0.18',
            '0 @I1@ INDI',
            '1 NAME Alice /Martin/',
            '2 _NAME_DETAIL preferred',
            '1 BIRT',
            '2 PLAC Lyon, France',
            '3 _PLACE_DETAIL district',
            '2 _EVENT_DETAIL certificate',
            '1 _INDIVIDUAL_DETAIL profile',
            '0 _ROOT_DETAIL root',
            '1 _CHILD_DETAIL child',
            '0 TRLR',
        ]);

        const extensions = collectGedcomExtensions(document);

        expect(extensions.map((extension) => extension.tag)).toEqual([
            '_ROOT_DETAIL',
            '_INDIVIDUAL_DETAIL',
            '_NAME_DETAIL',
            '_EVENT_DETAIL',
            '_PLACE_DETAIL',
        ]);
        expect(extensions[0]?.children).toEqual([
            expect.objectContaining({ tag: '_CHILD_DETAIL' }),
        ]);
    });
});
