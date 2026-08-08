import { describe, expect, it } from 'vitest';
import { GedcomFileDetector } from '../../../../src/modules/gedcom-import/gedcom-file-detector.js';
import {
    GedcomImportAnalysisStatus,
    GedcomImportService,
} from '../../../../src/modules/gedcom-import/gedcom-import.service.js';
import { GedcomParserSelector } from '../../../../src/modules/gedcom-import/gedcom-parser-selector.js';

describe('GedcomImportService', () => {
    function createService(): GedcomImportService {
        return new GedcomImportService(new GedcomFileDetector(), new GedcomParserSelector());
    }

    it('classifies identified extensions as ignored and unidentified extensions as ambiguous', () => {
        const service = createService();
        const file = new TextEncoder().encode(
            [
                '0 HEAD',
                '1 GEDC',
                '2 VERS 7.0.18',
                '1 SCHMA',
                '2 TAG _IDENTIFIED https://example.com/extensions/identified',
                '0 @I1@ INDI',
                '1 _IDENTIFIED known value',
                '1 _UNIDENTIFIED unknown value',
                '0 TRLR',
            ].join('\n'),
        );

        const result = service.analyze(file);

        expect(result.status).toBe(GedcomImportAnalysisStatus.Parsed);

        if (result.status !== GedcomImportAnalysisStatus.Parsed) {
            throw new Error('Expected the GEDCOM file to reach the parsing stage.');
        }

        expect(result.ignored).toEqual([
            expect.objectContaining({
                kind: 'extension',
                tag: '_IDENTIFIED',
                uri: 'https://example.com/extensions/identified',
                reason: 'The extension is identified but is not supported by Genealaine.',
            }),
        ]);
        expect(result.ambiguous).toEqual([
            expect.objectContaining({
                kind: 'extension',
                tag: '_UNIDENTIFIED',
                uri: null,
                reason: 'The extension could not be identified uniquely.',
            }),
        ]);
    });

    it('summarizes the recognized records and events', () => {
        const service = createService();
        const file = new TextEncoder().encode(
            [
                '0 HEAD',
                '1 GEDC',
                '2 VERS 7.0.18',
                '0 @N1@ SNOTE Shared note',
                '0 @S1@ SOUR',
                '1 TITL Civil register',
                '0 @R1@ REPO',
                '1 NAME Municipal archive',
                '0 @M1@ OBJE',
                '1 FILE certificate.jpg',
                '2 FORM image/jpeg',
                '0 @I1@ INDI',
                '1 NAME Alice /Martin/',
                '1 BIRT',
                '2 DATE 1900',
                '0 @F1@ FAM',
                '1 MARR',
                '2 DATE 1920',
                '0 TRLR',
            ].join('\n'),
        );

        const result = service.analyze(file);

        expect(result.status).toBe(GedcomImportAnalysisStatus.Parsed);

        if (result.status !== GedcomImportAnalysisStatus.Parsed) {
            throw new Error('Expected the GEDCOM file to reach the parsing stage.');
        }

        expect(result.parseResult.document).not.toBeNull();
        expect(result.summary).toEqual({
            individuals: 1,
            families: 1,
            events: 2,
            sources: 1,
            repositories: 1,
            media: 1,
            notes: 1,
        });
    });
});
