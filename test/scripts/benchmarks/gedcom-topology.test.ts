import { describe, expect, it } from 'vitest';
import {
    loadGedcomTopology,
    parseGedcomTopology,
} from '../../../scripts/benchmarks/gedcom-topology.ts';

describe('GEDCOM benchmark topology', () => {
    it('extracts people and parent-child relationships without personal fields', () => {
        const topology = parseGedcomTopology(`0 HEAD
1 GEDC
2 VERS 5.5.1
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Private /Person/
1 BIRT
2 DATE 1 JAN 1900
0 @I2@ INDI
0 @I3@ INDI
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 TRLR`);

        expect(topology).toEqual({
            gedcomVersion: '5.5.1',
            characterSet: 'UTF-8',
            personExternalIds: ['@I1@', '@I2@', '@I3@'],
            relationships: [
                {
                    parentExternalId: '@I1@',
                    childExternalId: '@I3@',
                },
                {
                    parentExternalId: '@I2@',
                    childExternalId: '@I3@',
                },
            ],
            families: 1,
            duplicateRelationships: 0,
        });
    });

    it('deduplicates relationships found in multiple families', () => {
        const topology = parseGedcomTopology(`0 HEAD
0 @I1@ INDI
0 @I2@ INDI
0 @F1@ FAM
1 HUSB @I1@
1 CHIL @I2@
0 @F2@ FAM
1 HUSB @I1@
1 CHIL @I2@
0 TRLR`);

        expect(topology.relationships).toEqual([
            {
                parentExternalId: '@I1@',
                childExternalId: '@I2@',
            },
        ]);
        expect(topology.duplicateRelationships).toBe(1);
    });

    it('rejects a relationship referencing an unavailable person', () => {
        expect(() =>
            parseGedcomTopology(`0 HEAD
0 @I1@ INDI
0 @F1@ FAM
1 HUSB @I1@
1 CHIL @I2@
0 TRLR`),
        ).toThrow('The GEDCOM file contains 1 relationships with missing people.');
    });

    it('refuses to load data outside the dedicated benchmark database', async () => {
        await expect(
            loadGedcomTopology(
                'postgresql://test:test@localhost:5432/kinfolio_test',
                {
                    gedcomVersion: null,
                    characterSet: null,
                    personExternalIds: [],
                    relationships: [],
                    families: 0,
                    duplicateRelationships: 0,
                },
                false,
            ),
        ).rejects.toThrow('The topology loader only accepts the "kinfolio_benchmark" database.');
    });
});
