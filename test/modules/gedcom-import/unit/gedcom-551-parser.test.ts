import { describe, expect, it } from 'vitest';
import { Gedcom551Parser } from '../../../../src/modules/gedcom-import/gedcom-551-parser.js';
import {
    GedcomDiagnosticCode,
    GedcomDiagnosticSeverity,
} from '../../../../src/modules/gedcom-import/gedcom-parser.types.js';
import type { DetectedGedcomFile } from '../../../../src/modules/gedcom-import/gedcom-file.types.js';

const parser = new Gedcom551Parser();

function detectedFile(lines: string[], version: '5.5.1' | '7.0.18' = '5.5.1'): DetectedGedcomFile {
    return {
        descriptor: {
            container: 'gedcom',
            version,
            characterEncoding: 'utf-8',
            hasByteOrderMark: false,
        },
        content: lines.join('\n'),
    };
}

function validDocumentLines(): string[] {
    return [
        '0 HEAD',
        '1 SOUR HEREDIS',
        '2 VERS 2026',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '1 LANG French',
        '0 @I1@ INDI',
        '1 NAME Alice Louise /Martin/',
        '2 GIVN Alice Louise',
        '2 SURN Martin',
        '1 SEX F',
        '1 BIRT',
        '2 DATE ABT 1900',
        '2 PLAC Lyon, France',
        '1 FAMS @F1@',
        '0 @I2@ INDI',
        '1 NAME Bob /Durand/',
        '1 SEX M',
        '1 FAMS @F1@',
        '0 @I3@ INDI',
        '1 NAME Charlie /Durand/',
        '1 FAMC @F1@',
        '2 PEDI birth',
        '0 @F1@ FAM',
        '1 HUSB @I2@',
        '1 WIFE @I1@',
        '1 CHIL @I3@',
        '1 MARR',
        '2 DATE 1920',
        '2 PLAC Paris, France',
        '2 HUSB',
        '3 AGE 20',
        '0 TRLR',
    ];
}

function expectDiagnostic(lines: string[], code: string): void {
    const result = parser.parse(detectedFile(lines));

    expect(result.document).toBeNull();
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code }));
}

describe('Gedcom551Parser', () => {
    it('normalizes individuals, families, events, dates and metadata', () => {
        const result = parser.parse(detectedFile(validDocumentLines()));

        expect(result.diagnostics).toEqual([]);
        expect(result.document).not.toBeNull();
        expect(result.document?.metadata).toMatchObject({
            version: '5.5.1',
            sourceProduct: 'HEREDIS',
            sourceProductVersion: '2026',
            language: 'French',
        });
        expect(result.document?.individuals[0]).toMatchObject({
            id: '@I1@',
            names: [{ givenNames: 'Alice Louise', surname: 'Martin', isPrimary: true }],
            sex: { value: 'female', originalValue: 'F' },
            events: [
                {
                    tag: 'BIRT',
                    date: { kind: 'about', first: { year: 1900 } },
                    place: { value: 'Lyon, France' },
                },
            ],
            partnerFamilyIds: ['@F1@'],
        });
        expect(result.document?.families[0]).toMatchObject({
            id: '@F1@',
            partners: [
                { individualId: '@I2@', sourceRole: 'husband' },
                { individualId: '@I1@', sourceRole: 'wife' },
            ],
            children: [{ individualId: '@I3@', pedigree: 'birth' }],
            events: [{ tag: 'MARR', date: { first: { year: 1920 } } }],
        });
    });

    it('resolves references declared later in the file', () => {
        const result = parser.parse(detectedFile(validDocumentLines()));

        expect(result.document?.families[0]?.partners).toHaveLength(2);
        expect(result.diagnostics).toEqual([]);
    });

    it('does not interpret an event-specific HUSB structure as a pointer', () => {
        const result = parser.parse(detectedFile(validDocumentLines()));

        expect(result.diagnostics).not.toContainEqual(
            expect.objectContaining({ code: GedcomDiagnosticCode.InvalidPointer }),
        );
    });

    it('rejects use with a GEDCOM 7 file', () => {
        const result = parser.parse(detectedFile(['0 HEAD', '0 TRLR'], '7.0.18'));

        expect(result.document).toBeNull();
        expect(result.diagnostics).toEqual([
            expect.objectContaining({ code: GedcomDiagnosticCode.UnsupportedParserVersion }),
        ]);
    });

    it('rejects a duplicate record identifier', () => {
        const lines = validDocumentLines();
        lines.splice(-1, 0, '0 @I1@ INDI');

        expectDiagnostic(lines, GedcomDiagnosticCode.DuplicateRecordIdentifier);
    });

    it('rejects a missing pointer target', () => {
        const lines = validDocumentLines().map((line) =>
            line === '1 CHIL @I3@' ? '1 CHIL @I404@' : line,
        );

        expectDiagnostic(lines, GedcomDiagnosticCode.MissingReference);
    });

    it('rejects a pointer to the wrong record type', () => {
        const lines = validDocumentLines().map((line) =>
            line === '1 CHIL @I3@' ? '1 CHIL @F1@' : line,
        );

        expectDiagnostic(lines, GedcomDiagnosticCode.ReferenceTypeMismatch);
    });

    it.each([
        [GedcomDiagnosticCode.MissingHeader, ['0 @I1@ INDI', '0 TRLR']],
        [GedcomDiagnosticCode.MissingTrailer, ['0 HEAD', '0 @I1@ INDI']],
        [GedcomDiagnosticCode.InvalidHierarchy, ['0 HEAD', '2 SOUR TEST', '0 TRLR']],
        [GedcomDiagnosticCode.InvalidLine, ['0 HEAD', '1 name Alice', '0 TRLR']],
    ] as const)('rejects an invalid document with %s', (code, lines) => {
        expectDiagnostic([...lines], code);
    });

    it('returns a document with a warning for a non-standard sex value', () => {
        const lines = validDocumentLines().map((line) => (line === '1 SEX F' ? '1 SEX X' : line));
        const result = parser.parse(detectedFile(lines));

        expect(result.document).not.toBeNull();
        expect(result.diagnostics).toContainEqual(
            expect.objectContaining({
                severity: GedcomDiagnosticSeverity.Warning,
                code: GedcomDiagnosticCode.UnknownValue,
            }),
        );
    });

    it('rejects an invalid genealogical date', () => {
        const lines = validDocumentLines().map((line) =>
            line === '2 DATE ABT 1900' ? '2 DATE 32 JAN 1900' : line,
        );

        expectDiagnostic(lines, GedcomDiagnosticCode.InvalidDate);
    });
});
