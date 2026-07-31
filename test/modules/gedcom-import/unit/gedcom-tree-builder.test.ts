import { describe, expect, it } from 'vitest';
import { buildGedcomTree } from '../../../../src/modules/gedcom-import/gedcom-tree-builder.js';
import { GedcomDiagnosticCode } from '../../../../src/modules/gedcom-import/gedcom-parser.types.js';

describe('buildGedcomTree', () => {
    it('builds parent-child relationships across common line endings', () => {
        const result = buildGedcomTree('0 HEAD\r\n1 GEDC\r2 VERS 5.5.1\n0 TRLR');

        expect(result.diagnostics).toEqual([]);
        expect(result.roots).toHaveLength(2);
        expect(result.roots[0]?.children[0]?.tag).toBe('GEDC');
        expect(result.roots[0]?.children[0]?.children[0]?.value).toBe('5.5.1');
    });

    it('reports a level whose parent does not exist', () => {
        const result = buildGedcomTree('0 HEAD\n2 VERS 5.5.1\n0 TRLR');

        expect(result.diagnostics).toContainEqual(
            expect.objectContaining({ code: GedcomDiagnosticCode.InvalidHierarchy }),
        );
    });

    it('reports empty lines instead of silently ignoring them', () => {
        const result = buildGedcomTree('0 HEAD\n\n0 TRLR');

        expect(result.diagnostics).toContainEqual(
            expect.objectContaining({
                code: GedcomDiagnosticCode.InvalidLine,
                location: { line: 2, column: 1 },
            }),
        );
    });
});
