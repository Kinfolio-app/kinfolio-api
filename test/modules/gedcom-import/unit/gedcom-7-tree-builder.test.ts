import { describe, expect, it } from 'vitest';
import { GedcomDiagnosticCode } from '../../../../src/modules/gedcom-import/common/gedcom-parser.types.js';
import { buildGedcom7Tree } from '../../../../src/modules/gedcom-import/v7/tree-builder.js';

describe('buildGedcom7Tree', () => {
    it('folds CONT pseudo-structures into their payload', () => {
        const result = buildGedcom7Tree(
            ['0 HEAD', '1 NOTE first', '2 CONT second', '2 CONT', '2 CONT fourth', '0 TRLR'].join(
                '\n',
            ),
        );

        expect(result.diagnostics).toEqual([]);
        expect(result.roots[0]?.children[0]).toMatchObject({
            tag: 'NOTE',
            value: 'first\nsecond\n\nfourth',
            children: [],
        });
    });

    it('rejects CONC in GEDCOM 7', () => {
        const result = buildGedcom7Tree('0 HEAD\n1 NOTE first\n2 CONC second\n0 TRLR');

        expect(result.diagnostics).toContainEqual(
            expect.objectContaining({ code: GedcomDiagnosticCode.UnsupportedStructure }),
        );
    });

    it('rejects a cross-reference identifier on a substructure', () => {
        const result = buildGedcom7Tree('0 HEAD\n1 @X@ NOTE text\n0 TRLR');

        expect(result.diagnostics).toContainEqual(
            expect.objectContaining({ code: GedcomDiagnosticCode.InvalidLine }),
        );
    });
});
