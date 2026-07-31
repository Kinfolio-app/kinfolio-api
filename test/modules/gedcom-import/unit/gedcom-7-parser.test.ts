import { describe, expect, it } from 'vitest';
import { GedcomDiagnosticCode } from '../../../../src/modules/gedcom-import/common/gedcom-parser.types.js';
import type { DetectedGedcomFile } from '../../../../src/modules/gedcom-import/gedcom-file.types.js';
import { Gedcom7Parser } from '../../../../src/modules/gedcom-import/v7/parser.js';

const parser = new Gedcom7Parser();

function file(lines: string[], version: '7.0' | '7.0.18' | '5.5.1' = '7.0.18'): DetectedGedcomFile {
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

function validLines(): string[] {
    return [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0.18',
        '1 SOUR',
        '2 NAME Example Exporter',
        '2 VERS 2.0',
        '1 SCHMA',
        '2 TAG _PROFILE https://example.com/profile',
        '1 LANG fr',
        '0 @N1@ SNOTE Shared context',
        '1 LANG en',
        '0 @S1@ SOUR',
        '1 TITL Civil register',
        '0 @R1@ REPO',
        '1 NAME Municipal archive',
        '0 @M1@ OBJE',
        '1 FILE media/certificate.jpg',
        '2 FORM image/jpeg',
        '2 TITL Birth certificate',
        '2 TRAN media/certificate.png',
        '3 FORM image/png',
        '0 @I1@ INDI',
        '1 NAME Alice /Martin/',
        '2 GIVN Alice',
        '2 SURN Martin',
        '2 TRAN Alice /Martin/',
        '3 LANG en',
        '1 SEX X',
        '1 BIRT',
        '2 DATE ABT 12 MAR 1900',
        '3 PHRASE according to the census',
        '2 PLAC Lyon, France',
        '3 LANG fr',
        '2 SOUR @S1@',
        '1 SNOTE @N1@',
        '1 OBJE @M1@',
        '1 FAMS @F1@',
        '1 _PROFILE public',
        '0 @I2@ INDI',
        '1 NAME Bob /Durand/',
        '1 SEX M',
        '1 FAMS @F1@',
        '0 @I3@ INDI',
        '1 NAME Charlie /Durand/',
        '1 SEX U',
        '1 FAMC @F1@',
        '2 PEDI BIRTH',
        '0 @F1@ FAM',
        '1 HUSB @I2@',
        '1 WIFE @I1@',
        '1 CHIL @I3@',
        '1 MARR',
        '2 DATE 1920',
        '2 HUSB',
        '3 AGE 20',
        '0 TRLR',
    ];
}

function expectError(lines: string[], code: string): void {
    const result = parser.parse(file(lines));
    expect(result.document).toBeNull();
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code }));
}

describe('Gedcom7Parser', () => {
    it.each(['7.0', '7.0.18'] as const)('supports version %s', (version) => {
        expect(parser.supports(version)).toBe(true);
    });

    it('normalizes GEDCOM 7 records and resolves forward references', () => {
        const result = parser.parse(file(validLines()));

        expect(result.diagnostics).toEqual([]);
        expect(result.document?.metadata).toMatchObject({
            version: '7.0.18',
            sourceProduct: 'Example Exporter',
            sourceProductVersion: '2.0',
            language: 'fr',
        });
        expect(result.document?.individuals[0]).toMatchObject({
            id: '@I1@',
            sex: { value: 'other', originalValue: 'X' },
            events: [
                {
                    tag: 'BIRT',
                    date: { kind: 'about', phrase: 'according to the census' },
                    place: { value: 'Lyon, France', language: 'fr' },
                    sourceCitations: [{ sourceId: '@S1@' }],
                },
            ],
            noteReferences: [{ noteId: '@N1@', inlineNote: null }],
            mediaReferences: [{ mediaId: '@M1@', inlineMedia: null }],
            extensions: [{ tag: '_PROFILE', uri: 'https://example.com/profile' }],
        });
        expect(result.document?.individuals[0]?.names[0]?.extensions).toContainEqual(
            expect.objectContaining({ tag: 'TRAN', value: 'Alice /Martin/' }),
        );
        expect(result.document?.families[0]).toMatchObject({
            partners: [
                { individualId: '@I2@', sourceRole: 'husband' },
                { individualId: '@I1@', sourceRole: 'wife' },
            ],
            children: [{ individualId: '@I3@', pedigree: 'BIRTH' }],
        });
        expect(result.document?.sharedNotes[0]).toMatchObject({
            id: '@N1@',
            text: 'Shared context',
        });
        expect(result.document?.media[0]?.files[0]).toMatchObject({
            path: 'media/certificate.jpg',
            mediaType: 'image/jpeg',
            extensions: [expect.objectContaining({ tag: 'TRAN', value: 'media/certificate.png' })],
        });
    });

    it('does not treat event-specific HUSB as a pointer', () => {
        const result = parser.parse(file(validLines()));

        expect(result.diagnostics).not.toContainEqual(
            expect.objectContaining({ code: GedcomDiagnosticCode.InvalidPointer }),
        );
    });

    it('rejects the obsolete CHAR and CONC structures', () => {
        const withCharacterEncoding = validLines();
        withCharacterEncoding.splice(3, 0, '1 CHAR UTF-8');
        expectError(withCharacterEncoding, GedcomDiagnosticCode.UnsupportedStructure);

        const withConc = validLines();
        withConc.splice(-1, 0, '0 @N2@ SNOTE first', '1 CONC second');
        expectError(withConc, GedcomDiagnosticCode.UnsupportedStructure);
    });

    it('rejects references to the wrong record type', () => {
        const lines = validLines().map((line) => (line === '1 CHIL @I3@' ? '1 CHIL @S1@' : line));
        expectError(lines, GedcomDiagnosticCode.ReferenceTypeMismatch);
    });

    it('rejects a multimedia record without FILE and FORM', () => {
        const withoutFile = validLines().filter(
            (line) =>
                ![
                    '1 FILE media/certificate.jpg',
                    '2 FORM image/jpeg',
                    '2 TITL Birth certificate',
                    '2 TRAN media/certificate.png',
                    '3 FORM image/png',
                ].includes(line),
        );
        expectError(withoutFile, GedcomDiagnosticCode.InvalidCardinality);

        const withoutForm = validLines().filter((line) => line !== '2 FORM image/jpeg');
        expectError(withoutForm, GedcomDiagnosticCode.InvalidCardinality);
    });

    it('rejects a GEDCOM 5.5.1 descriptor', () => {
        const result = parser.parse(file(['0 HEAD', '0 TRLR'], '5.5.1'));
        expect(result.diagnostics).toContainEqual(
            expect.objectContaining({ code: GedcomDiagnosticCode.UnsupportedParserVersion }),
        );
    });

    it('keeps a valid unreferenced record without inventing an identifier', () => {
        const lines = validLines();
        lines.splice(-1, 0, '0 INDI', '1 NAME Unreferenced /Person/');
        const result = parser.parse(file(lines));

        expect(result.document?.individuals.at(-1)?.id).toBeNull();
    });
});
