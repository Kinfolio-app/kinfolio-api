import { describe, expect, it } from 'vitest';
import { createGedcomImportPlan } from '../../../../src/modules/gedcom-import/gedcom-import-plan.mapper.js';
import {
    GedcomMappingIssueCode,
    GedcomMappingIssueKind,
    type GedcomMappingIssue,
} from '../../../../src/modules/gedcom-import/gedcom-import-plan.types.js';
import type {
    GenealogicalDate,
    NormalizedEvent,
    NormalizedExtension,
    NormalizedFamily,
    NormalizedGedcomDocument,
    NormalizedIndividual,
    NormalizedName,
} from '../../../../src/modules/gedcom-import/common/gedcom-parser.types.js';
import { Gender, LivingStatus } from '../../../../src/modules/people/person.types.js';
import { CoupleRelationshipEventType } from '../../../../src/modules/relationships/couple-relationship.types.js';
import {
    ParentChildRelationshipEvidenceStatus,
    ParentChildRelationshipType,
} from '../../../../src/modules/relationships/parent-child-relationship.types.js';

function createName(overrides: Partial<NormalizedName> = {}): NormalizedName {
    return {
        value: '',
        type: null,
        givenNames: null,
        surname: null,
        surnamePrefix: null,
        prefix: null,
        suffix: null,
        nickname: null,
        isPrimary: true,
        extensions: [],
        ...overrides,
    };
}

function createEvent(tag: string, overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
    return {
        tag,
        type: null,
        value: null,
        date: null,
        place: null,
        description: null,
        sourceCitations: [],
        noteReferences: [],
        mediaReferences: [],
        extensions: [],
        ...overrides,
    };
}

function createExtension(
    tag: string,
    path: string,
    uri: string | null,
    children: NormalizedExtension[] = [],
): NormalizedExtension {
    return {
        tag,
        uri,
        value: null,
        path,
        location: { line: 1, column: 1 },
        children,
    };
}

function createIndividual(overrides: Partial<NormalizedIndividual> = {}): NormalizedIndividual {
    return {
        id: null,
        names: [],
        sex: null,
        events: [],
        attributes: [],
        parentFamilyLinks: [],
        partnerFamilyIds: [],
        sourceCitations: [],
        noteReferences: [],
        mediaReferences: [],
        identifiers: [],
        extensions: [],
        ...overrides,
    };
}

function createFamily(overrides: Partial<NormalizedFamily> = {}): NormalizedFamily {
    return {
        id: null,
        partners: [],
        children: [],
        events: [],
        sourceCitations: [],
        noteReferences: [],
        mediaReferences: [],
        extensions: [],
        ...overrides,
    };
}

function createDocument(
    individuals: NormalizedIndividual[],
    families: NormalizedFamily[] = [],
    overrides: Partial<NormalizedGedcomDocument> = {},
): NormalizedGedcomDocument {
    return {
        metadata: {
            version: '7.0.18',
            sourceProduct: null,
            sourceProductVersion: null,
            characterEncoding: 'UTF-8',
            language: null,
            fileName: null,
        },
        individuals,
        families,
        sources: [],
        repositories: [],
        media: [],
        sharedNotes: [],
        extensions: [],
        ...overrides,
    };
}

function excludeMissingCouplePartnerIssues(issues: GedcomMappingIssue[]): GedcomMappingIssue[] {
    return issues.filter((issue) => issue.code !== GedcomMappingIssueCode.MissingCouplePartners);
}

describe('createGedcomImportPlan', () => {
    it('maps structured and raw individual data without losing genealogical dates', () => {
        const birthDate: GenealogicalDate = {
            kind: 'about',
            first: {
                calendar: 'gregorian',
                year: 1900,
                month: 3,
                day: null,
                epoch: 'common',
            },
            second: null,
            phrase: null,
            originalText: 'ABT MAR 1900',
        };
        const document = createDocument([
            createIndividual({
                id: '@I1@',
                names: [
                    createName({
                        value: 'Jean Pierre /de La Roche/',
                        givenNames: ' Jean Pierre ',
                        surname: ' de La Roche ',
                        surnamePrefix: ' de ',
                    }),
                    createName({
                        value: 'Jean Pierre /Martin/',
                        type: 'BIRTH',
                        isPrimary: false,
                    }),
                ],
                sex: { value: 'male', originalValue: 'M' },
                events: [
                    createEvent('BIRT', {
                        date: birthDate,
                        place: {
                            value: ' Paris ',
                            format: null,
                            latitude: null,
                            longitude: null,
                            language: null,
                            extensions: [],
                        },
                    }),
                    createEvent('DEAT'),
                ],
                identifiers: [{ type: 'UID', value: 'person-1' }],
            }),
            createIndividual({
                id: '@I2@',
                names: [createName({ value: 'Alice /Durand/' })],
            }),
        ]);

        const plan = createGedcomImportPlan(document);

        expect(plan.people).toEqual([
            {
                key: 'person:0',
                identifiers: [{ type: 'UID', value: 'person-1' }],
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0]',
                },
                data: {
                    firstName: 'Jean Pierre',
                    middleNames: null,
                    lastName: 'de La Roche',
                    birthName: 'Martin',
                    gender: Gender.Male,
                    birthDate,
                    birthPlace: 'Paris',
                    deathDate: null,
                    deathPlace: null,
                    livingStatus: LivingStatus.Deceased,
                    biography: null,
                },
            },
            {
                key: 'person:1',
                identifiers: [],
                provenance: {
                    gedcomId: '@I2@',
                    path: 'individuals[1]',
                },
                data: {
                    firstName: 'Alice',
                    middleNames: null,
                    lastName: 'Durand',
                    birthName: null,
                    gender: Gender.Unspecified,
                    birthDate: null,
                    birthPlace: null,
                    deathDate: null,
                    deathPlace: null,
                    livingStatus: LivingStatus.Unknown,
                    biography: null,
                },
            },
        ]);
        expect(plan.issues).toEqual([]);
    });

    it('excludes an individual without a usable name', () => {
        const document = createDocument([
            createIndividual({
                id: '@I1@',
                names: [createName({ value: '   ' })],
            }),
        ]);

        const plan = createGedcomImportPlan(document);

        expect(plan.people).toEqual([]);
        expect(plan.issues).toEqual([
            {
                kind: GedcomMappingIssueKind.Invalid,
                code: GedcomMappingIssueCode.MissingName,
                message: 'The individual has no usable name.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].names',
                },
                count: 1,
            },
        ]);
    });

    it('keeps an individual whose GEDCOM sex cannot be mapped to a Kinfolio gender', () => {
        const document = createDocument([
            createIndividual({
                id: '@I1@',
                names: [createName({ value: 'Alex /Martin/' })],
                sex: { value: 'other', originalValue: 'X' },
            }),
        ]);

        const plan = createGedcomImportPlan(document);

        expect(plan.people).toHaveLength(1);
        expect(plan.people[0]?.data.gender).toBe(Gender.Unspecified);
        expect(plan.issues).toEqual([
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedSex,
                message: 'GEDCOM sex value "X" cannot be mapped to a Kinfolio gender.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].sex',
                },
                count: 1,
            },
        ]);
    });

    it.each([
        { sex: 'female' as const, originalValue: 'F', expectedGender: Gender.Female },
        {
            sex: 'unknown' as const,
            originalValue: 'U',
            expectedGender: Gender.Unspecified,
        },
    ])('maps the normalized $sex sex value', ({ sex, originalValue, expectedGender }) => {
        const document = createDocument([
            createIndividual({
                names: [createName({ value: 'Alice /Durand/' })],
                sex: { value: sex, originalValue },
            }),
        ]);

        const plan = createGedcomImportPlan(document);

        expect(plan.people[0]?.data.gender).toBe(expectedGender);
        expect(plan.issues).toEqual([]);
    });

    it('ignores additional regular and birth names while keeping the selected names', () => {
        const document = createDocument([
            createIndividual({
                id: '@I1@',
                names: [
                    createName({ value: 'Alice /Durand/' }),
                    createName({ value: 'Alice /Martin/', isPrimary: false }),
                    createName({ value: 'Alice /Bernard/', type: 'BIRTH', isPrimary: false }),
                    createName({ value: 'Alice /Petit/', type: 'MAIDEN', isPrimary: false }),
                ],
            }),
        ]);

        const plan = createGedcomImportPlan(document);

        expect(plan.people[0]?.data).toMatchObject({
            firstName: 'Alice',
            lastName: 'Durand',
            birthName: 'Bernard',
        });
        expect(plan.issues).toEqual([
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.AdditionalName,
                message: 'Additional names are not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].names',
                },
                count: 1,
            },
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.AdditionalBirthName,
                message: 'Additional birth names are not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].names',
                },
                count: 1,
            },
        ]);
    });

    it('counts unsupported name parts without counting a structured suffix twice', () => {
        const document = createDocument([
            createIndividual({
                id: '@I1@',
                names: [
                    createName({
                        value: 'Doctor Alice /Durand/ Jr.',
                        surnamePrefix: 'de',
                        prefix: 'Doctor',
                        suffix: 'Jr.',
                        nickname: 'Ally',
                    }),
                ],
            }),
            createIndividual({
                id: '@I2@',
                names: [createName({ value: 'Bob /Martin/ III' })],
            }),
        ]);

        const plan = createGedcomImportPlan(document);

        expect(plan.people[0]?.data.lastName).toBe('de Durand');
        expect(plan.issues).toEqual([
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedNamePart,
                message: 'Name prefixes, suffixes, and nicknames are not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].names',
                },
                count: 3,
            },
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedNamePart,
                message: 'Name prefixes, suffixes, and nicknames are not imported.',
                provenance: {
                    gedcomId: '@I2@',
                    path: 'individuals[1].names',
                },
                count: 1,
            },
        ]);
    });

    it('keeps the first birth and death events and reports additional events', () => {
        const document = createDocument([
            createIndividual({
                id: '@I1@',
                names: [createName({ value: 'Alice /Durand/' })],
                events: [
                    createEvent('BIRT', {
                        place: {
                            value: 'Paris',
                            format: null,
                            latitude: null,
                            longitude: null,
                            language: null,
                            extensions: [],
                        },
                    }),
                    createEvent('BIRT', {
                        place: {
                            value: 'Lyon',
                            format: null,
                            latitude: null,
                            longitude: null,
                            language: null,
                            extensions: [],
                        },
                    }),
                    createEvent('BIRT'),
                    createEvent('DEAT', {
                        place: {
                            value: 'Nantes',
                            format: null,
                            latitude: null,
                            longitude: null,
                            language: null,
                            extensions: [],
                        },
                    }),
                    createEvent('DEAT', {
                        place: {
                            value: 'Bordeaux',
                            format: null,
                            latitude: null,
                            longitude: null,
                            language: null,
                            extensions: [],
                        },
                    }),
                ],
            }),
        ]);

        const plan = createGedcomImportPlan(document);

        expect(plan.people[0]?.data).toMatchObject({
            birthPlace: 'Paris',
            deathPlace: 'Nantes',
            livingStatus: LivingStatus.Deceased,
        });
        expect(plan.issues).toEqual([
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.AdditionalBirthEvent,
                message: 'Additional birth events are not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].events',
                },
                count: 2,
            },
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.AdditionalDeathEvent,
                message: 'Additional death events are not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].events',
                },
                count: 1,
            },
        ]);
    });

    it('keeps place values and reports unsupported details from selected events', () => {
        const document = createDocument([
            createIndividual({
                id: '@I1@',
                names: [createName({ value: 'Alice /Durand/' })],
                events: [
                    createEvent('BIRT', {
                        place: {
                            value: ' Paris ',
                            format: ['City', 'Country'],
                            latitude: 'N48.8566',
                            longitude: '   ',
                            language: 'fr',
                            extensions: [
                                {
                                    tag: '_CUSTOM',
                                    uri: null,
                                    value: 'detail',
                                    path: 'individuals[0].events[0].place.extensions[0]',
                                    location: { line: 1, column: 1 },
                                    children: [],
                                },
                            ],
                        },
                    }),
                    createEvent('DEAT', {
                        place: {
                            value: ' Nantes ',
                            format: null,
                            latitude: null,
                            longitude: 'W1.5536',
                            language: null,
                            extensions: [],
                        },
                    }),
                ],
            }),
        ]);

        const plan = createGedcomImportPlan(document);

        expect(plan.people[0]?.data).toMatchObject({
            birthPlace: 'Paris',
            deathPlace: 'Nantes',
        });
        expect(plan.issues).toEqual([
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedPlaceDetails,
                message: 'Place format, coordinates, language, and extensions are not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].events',
                },
                count: 5,
            },
        ]);
    });

    it('reports unsupported individual events and attributes without recounting birth and death', () => {
        const document = createDocument([
            createIndividual({
                id: '@I1@',
                names: [createName({ value: 'Alice /Durand/' })],
                events: [
                    createEvent('BIRT'),
                    createEvent('DEAT'),
                    createEvent('RESI'),
                    createEvent('EVEN'),
                ],
                attributes: [
                    {
                        tag: 'OCCU',
                        type: null,
                        value: 'Carpenter',
                        date: null,
                        place: null,
                        sourceCitations: [],
                        noteReferences: [],
                        extensions: [],
                    },
                    {
                        tag: 'EDUC',
                        type: null,
                        value: 'University',
                        date: null,
                        place: null,
                        sourceCitations: [],
                        noteReferences: [],
                        extensions: [],
                    },
                ],
            }),
        ]);

        const plan = createGedcomImportPlan(document);

        expect(plan.people).toHaveLength(1);
        expect(plan.issues).toEqual([
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedIndividualEvent,
                message: 'Individual events other than birth and death are not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].events',
                },
                count: 2,
            },
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedIndividualAttribute,
                message: 'Individual attributes are not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].attributes',
                },
                count: 2,
            },
        ]);
    });

    it('reports references and classifies non-place extensions while retaining identifiers', () => {
        const sourceCitation = {
            sourceId: '@S1@',
            page: null,
            data: null,
            quality: null,
            extensions: [],
        };
        const noteReference = { noteId: '@N1@', inlineNote: null };
        const mediaReference = { mediaId: '@M1@', inlineMedia: null };
        const nestedAmbiguousExtension = createExtension(
            '_CHILD',
            'individuals[0].events[0].extensions[0].children[0]',
            null,
        );

        const document = createDocument([
            createIndividual({
                id: '@I1@',
                names: [
                    createName({
                        value: 'Alice /Durand/',
                        extensions: [
                            createExtension('_NAME', 'individuals[0].names[0].extensions[0]', null),
                        ],
                    }),
                ],
                events: [
                    createEvent('BIRT', {
                        sourceCitations: [sourceCitation],
                        noteReferences: [noteReference],
                        mediaReferences: [mediaReference],
                        extensions: [
                            createExtension(
                                '_EVENT',
                                'individuals[0].events[0].extensions[0]',
                                'https://example.com/event',
                                [nestedAmbiguousExtension],
                            ),
                        ],
                    }),
                ],
                attributes: [
                    {
                        tag: 'OCCU',
                        type: null,
                        value: 'Carpenter',
                        date: null,
                        place: null,
                        sourceCitations: [sourceCitation],
                        noteReferences: [noteReference],
                        extensions: [],
                    },
                ],
                sourceCitations: [sourceCitation],
                noteReferences: [noteReference],
                mediaReferences: [mediaReference],
                identifiers: [{ type: 'UID', value: 'person-1' }],
                extensions: [
                    createExtension(
                        '_INDI',
                        'individuals[0].extensions[0]',
                        'https://example.com/individual',
                    ),
                ],
            }),
        ]);

        const plan = createGedcomImportPlan(document);

        expect(plan.people[0]?.identifiers).toEqual([{ type: 'UID', value: 'person-1' }]);
        expect(plan.issues).toEqual([
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedIndividualAttribute,
                message: 'Individual attributes are not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].attributes',
                },
                count: 1,
            },
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedSources,
                message: 'Source citations are not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0]',
                },
                count: 3,
            },
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedNotes,
                message: 'Note references are not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0]',
                },
                count: 3,
            },
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedMedia,
                message: 'Media references are not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0]',
                },
                count: 2,
            },
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedExtension,
                message: 'Extension "_INDI" is not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].extensions[0]',
                },
                count: 1,
            },
            {
                kind: GedcomMappingIssueKind.Ambiguous,
                code: GedcomMappingIssueCode.AmbiguousExtension,
                message: 'Extension "_NAME" has no identifiable URI.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].names[0].extensions[0]',
                },
                count: 1,
            },
            {
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedExtension,
                message: 'Extension "_EVENT" is not imported.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].events[0].extensions[0]',
                },
                count: 1,
            },
            {
                kind: GedcomMappingIssueKind.Ambiguous,
                code: GedcomMappingIssueCode.AmbiguousExtension,
                message: 'Extension "_CHILD" has no identifiable URI.',
                provenance: {
                    gedcomId: '@I1@',
                    path: 'individuals[0].events[0].extensions[0].children[0]',
                },
                count: 1,
            },
        ]);
    });

    it('creates one parent-child relationship for each partner and child combination', () => {
        const individuals = [
            createIndividual({
                id: '@I1@',
                names: [createName({ value: 'Alice /Durand/' })],
            }),
            createIndividual({
                id: '@I2@',
                names: [createName({ value: 'Bob /Martin/' })],
            }),
            createIndividual({
                id: '@I3@',
                names: [createName({ value: 'Charlie /Martin/' })],
            }),
        ];
        const families: NormalizedFamily[] = [
            {
                id: '@F1@',
                partners: [
                    { individualId: '@I1@', sourceRole: 'wife' },
                    { individualId: '@I2@', sourceRole: 'husband' },
                ],
                children: [{ individualId: '@I3@', pedigree: null, status: null }],
                events: [],
                sourceCitations: [],
                noteReferences: [],
                mediaReferences: [],
                extensions: [],
            },
        ];

        const plan = createGedcomImportPlan(createDocument(individuals, families));

        expect(plan.parentChildRelationships).toEqual([
            {
                key: 'parent-child:0',
                provenance: {
                    gedcomId: '@F1@',
                    path: 'families[0]',
                },
                data: {
                    parentKey: 'person:0',
                    childKey: 'person:2',
                    relationshipType: ParentChildRelationshipType.Unspecified,
                    evidenceStatus: ParentChildRelationshipEvidenceStatus.Unassessed,
                },
            },
            {
                key: 'parent-child:1',
                provenance: {
                    gedcomId: '@F1@',
                    path: 'families[0]',
                },
                data: {
                    parentKey: 'person:1',
                    childKey: 'person:2',
                    relationshipType: ParentChildRelationshipType.Unspecified,
                    evidenceStatus: ParentChildRelationshipEvidenceStatus.Unassessed,
                },
            },
        ]);
        expect(plan.issues).toEqual([]);
    });

    it.each([
        { pedigree: 'BIRTH', expectedType: ParentChildRelationshipType.Unspecified },
        { pedigree: 'ADOPTED', expectedType: ParentChildRelationshipType.Adoptive },
        { pedigree: 'FOSTER', expectedType: ParentChildRelationshipType.Foster },
        { pedigree: 'SEALING', expectedType: ParentChildRelationshipType.Other },
        { pedigree: 'OTHER', expectedType: ParentChildRelationshipType.Other },
    ])('maps the $pedigree PEDI value', ({ pedigree, expectedType }) => {
        const individuals = [
            createIndividual({
                id: '@I1@',
                names: [createName({ value: 'Alice /Durand/' })],
            }),
            createIndividual({
                id: '@I2@',
                names: [createName({ value: 'Bob /Durand/' })],
            }),
        ];
        const family = createFamily({
            id: '@F1@',
            partners: [{ individualId: '@I1@', sourceRole: 'partner' }],
            children: [{ individualId: '@I2@', pedigree, status: null }],
        });

        const plan = createGedcomImportPlan(createDocument(individuals, [family]));

        expect(plan.parentChildRelationships[0]?.data.relationshipType).toBe(expectedType);
        expect(excludeMissingCouplePartnerIssues(plan.issues)).toEqual([]);
    });

    it.each([
        { status: null, expectedStatus: ParentChildRelationshipEvidenceStatus.Unassessed },
        { status: 'PROVEN', expectedStatus: ParentChildRelationshipEvidenceStatus.Proven },
        {
            status: 'CHALLENGED',
            expectedStatus: ParentChildRelationshipEvidenceStatus.Challenged,
        },
    ])('maps the $status STAT value', ({ status, expectedStatus }) => {
        const individuals = [
            createIndividual({
                id: '@I1@',
                names: [createName({ value: 'Alice /Durand/' })],
            }),
            createIndividual({
                id: '@I2@',
                names: [createName({ value: 'Bob /Durand/' })],
            }),
        ];
        const family = createFamily({
            id: '@F1@',
            partners: [{ individualId: '@I1@', sourceRole: 'partner' }],
            children: [{ individualId: '@I2@', pedigree: null, status }],
        });

        const plan = createGedcomImportPlan(createDocument(individuals, [family]));

        expect(plan.parentChildRelationships[0]?.data.evidenceStatus).toBe(expectedStatus);
        expect(excludeMissingCouplePartnerIssues(plan.issues)).toEqual([]);
    });

    it('reports unknown PEDI and STAT values while retaining an unassessed relationship', () => {
        const individuals = [
            createIndividual({
                id: '@I1@',
                names: [createName({ value: 'Alice /Durand/' })],
            }),
            createIndividual({
                id: '@I2@',
                names: [createName({ value: 'Bob /Durand/' })],
            }),
        ];
        const family = createFamily({
            id: '@F1@',
            partners: [{ individualId: '@I1@', sourceRole: 'partner' }],
            children: [{ individualId: '@I2@', pedigree: 'CUSTOM', status: 'UNCERTAIN' }],
        });

        const plan = createGedcomImportPlan(createDocument(individuals, [family]));

        expect(plan.parentChildRelationships[0]?.data).toMatchObject({
            relationshipType: ParentChildRelationshipType.Unspecified,
            evidenceStatus: ParentChildRelationshipEvidenceStatus.Unassessed,
        });
        expect(excludeMissingCouplePartnerIssues(plan.issues).map((issue) => issue.code)).toEqual([
            GedcomMappingIssueCode.UnknownPedigree,
            GedcomMappingIssueCode.UnknownEvidenceStatus,
        ]);
        expect(
            excludeMissingCouplePartnerIssues(plan.issues).every(
                (issue) => issue.kind === GedcomMappingIssueKind.Ambiguous,
            ),
        ).toBe(true);
    });

    it('does not create a disproven parent-child relationship', () => {
        const individuals = [
            createIndividual({
                id: '@I1@',
                names: [createName({ value: 'Alice /Durand/' })],
            }),
            createIndividual({
                id: '@I2@',
                names: [createName({ value: 'Bob /Durand/' })],
            }),
        ];
        const family = createFamily({
            id: '@F1@',
            partners: [{ individualId: '@I1@', sourceRole: 'partner' }],
            children: [{ individualId: '@I2@', pedigree: null, status: 'DISPROVEN' }],
        });

        const plan = createGedcomImportPlan(createDocument(individuals, [family]));

        expect(plan.parentChildRelationships).toEqual([]);
        expect(excludeMissingCouplePartnerIssues(plan.issues)).toEqual([
            expect.objectContaining({
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.DisprovenFamilyLink,
                count: 1,
            }),
        ]);
    });

    it('reports and excludes a self parent-child relationship', () => {
        const individual = createIndividual({
            id: '@I1@',
            names: [createName({ value: 'Alice /Durand/' })],
        });
        const family = createFamily({
            id: '@F1@',
            partners: [{ individualId: '@I1@', sourceRole: 'partner' }],
            children: [{ individualId: '@I1@', pedigree: null, status: null }],
        });

        const plan = createGedcomImportPlan(createDocument([individual], [family]));

        expect(plan.parentChildRelationships).toEqual([]);
        expect(excludeMissingCouplePartnerIssues(plan.issues)).toEqual([
            expect.objectContaining({
                kind: GedcomMappingIssueKind.Invalid,
                code: GedcomMappingIssueCode.SelfParentChildRelationship,
                count: 1,
            }),
        ]);
    });

    it('reports missing partner and child references once each', () => {
        const family = createFamily({
            id: '@F1@',
            partners: [{ individualId: '@MISSING_PARENT@', sourceRole: 'partner' }],
            children: [
                {
                    individualId: '@MISSING_CHILD@',
                    pedigree: null,
                    status: null,
                },
            ],
        });

        const plan = createGedcomImportPlan(createDocument([], [family]));

        expect(plan.parentChildRelationships).toEqual([]);
        expect(excludeMissingCouplePartnerIssues(plan.issues).map((issue) => issue.code)).toEqual([
            GedcomMappingIssueCode.MissingPersonReference,
            GedcomMappingIssueCode.MissingPersonReference,
        ]);
        expect(excludeMissingCouplePartnerIssues(plan.issues).map((issue) => issue.count)).toEqual([
            1, 1,
        ]);
    });

    it('does not create a parent-child relationship for a family without a partner', () => {
        const child = createIndividual({
            id: '@I1@',
            names: [createName({ value: 'Alice /Durand/' })],
        });
        const family = createFamily({
            id: '@F1@',
            children: [{ individualId: '@I1@', pedigree: null, status: null }],
        });

        const plan = createGedcomImportPlan(createDocument([child], [family]));

        expect(plan.parentChildRelationships).toEqual([]);
        expect(excludeMissingCouplePartnerIssues(plan.issues)).toEqual([]);
    });

    it('retains the same parent-child link from separate families', () => {
        const individuals = [
            createIndividual({
                id: '@I1@',
                names: [createName({ value: 'Alice /Durand/' })],
            }),
            createIndividual({
                id: '@I2@',
                names: [createName({ value: 'Bob /Durand/' })],
            }),
        ];
        const familyLink = {
            partners: [{ individualId: '@I1@', sourceRole: 'partner' as const }],
            children: [{ individualId: '@I2@', pedigree: null, status: null }],
        };
        const families = [
            createFamily({ id: '@F1@', ...familyLink }),
            createFamily({ id: '@F2@', ...familyLink }),
        ];

        const plan = createGedcomImportPlan(createDocument(individuals, families));

        expect(plan.parentChildRelationships).toHaveLength(2);
        expect(plan.parentChildRelationships.map((relationship) => relationship.key)).toEqual([
            'parent-child:0',
            'parent-child:1',
        ]);
        expect(
            plan.parentChildRelationships.map((relationship) => relationship.provenance.gedcomId),
        ).toEqual(['@F1@', '@F2@']);
        expect(plan.parentChildRelationships[0]?.data).toEqual(
            plan.parentChildRelationships[1]?.data,
        );
        expect(excludeMissingCouplePartnerIssues(plan.issues)).toEqual([]);
    });

    it('does not report a cycle for an acyclic parent-child graph', () => {
        const individuals = ['@I1@', '@I2@', '@I3@'].map((id) =>
            createIndividual({
                id,
                names: [createName({ value: `Person ${id} /Test/` })],
            }),
        );
        const families = [
            createFamily({
                id: '@F1@',
                partners: [{ individualId: '@I1@', sourceRole: 'partner' }],
                children: [{ individualId: '@I2@', pedigree: null, status: null }],
            }),
            createFamily({
                id: '@F2@',
                partners: [{ individualId: '@I2@', sourceRole: 'partner' }],
                children: [{ individualId: '@I3@', pedigree: null, status: null }],
            }),
        ];

        const plan = createGedcomImportPlan(createDocument(individuals, families));

        expect(plan.parentChildRelationships).toHaveLength(2);
        expect(excludeMissingCouplePartnerIssues(plan.issues)).toEqual([]);
    });

    it('retains relationships and reports a two-person parent-child cycle', () => {
        const individuals = ['@I1@', '@I2@'].map((id) =>
            createIndividual({
                id,
                names: [createName({ value: `Person ${id} /Test/` })],
            }),
        );
        const families = [
            createFamily({
                id: '@F1@',
                partners: [{ individualId: '@I1@', sourceRole: 'partner' }],
                children: [{ individualId: '@I2@', pedigree: null, status: null }],
            }),
            createFamily({
                id: '@F2@',
                partners: [{ individualId: '@I2@', sourceRole: 'partner' }],
                children: [{ individualId: '@I1@', pedigree: null, status: null }],
            }),
        ];

        const plan = createGedcomImportPlan(createDocument(individuals, families));

        expect(plan.parentChildRelationships).toHaveLength(2);
        expect(excludeMissingCouplePartnerIssues(plan.issues)).toEqual([
            {
                kind: GedcomMappingIssueKind.Invalid,
                code: GedcomMappingIssueCode.ParentChildCycle,
                message: 'Parent-child relationships contain a cycle.',
                provenance: {
                    gedcomId: '@F2@',
                    path: 'families[1]',
                },
                count: 1,
            },
        ]);
    });

    it('retains relationships and reports an indirect parent-child cycle', () => {
        const individuals = ['@I1@', '@I2@', '@I3@'].map((id) =>
            createIndividual({
                id,
                names: [createName({ value: `Person ${id} /Test/` })],
            }),
        );
        const families = [
            createFamily({
                id: '@F1@',
                partners: [{ individualId: '@I1@', sourceRole: 'partner' }],
                children: [{ individualId: '@I2@', pedigree: null, status: null }],
            }),
            createFamily({
                id: '@F2@',
                partners: [{ individualId: '@I2@', sourceRole: 'partner' }],
                children: [{ individualId: '@I3@', pedigree: null, status: null }],
            }),
            createFamily({
                id: '@F3@',
                partners: [{ individualId: '@I3@', sourceRole: 'partner' }],
                children: [{ individualId: '@I1@', pedigree: null, status: null }],
            }),
        ];

        const plan = createGedcomImportPlan(createDocument(individuals, families));

        expect(plan.parentChildRelationships).toHaveLength(3);
        expect(excludeMissingCouplePartnerIssues(plan.issues)).toEqual([
            expect.objectContaining({
                kind: GedcomMappingIssueKind.Invalid,
                code: GedcomMappingIssueCode.ParentChildCycle,
                provenance: {
                    gedcomId: '@F3@',
                    path: 'families[2]',
                },
                count: 1,
            }),
        ]);
    });

    it('creates a canonically ordered couple without deriving meaning from GEDCOM roles', () => {
        const individuals = [
            createIndividual({
                id: '@I1@',
                names: [createName({ value: 'Alice /Durand/' })],
            }),
            createIndividual({
                id: '@I2@',
                names: [createName({ value: 'Bob /Martin/' })],
            }),
        ];
        const family = createFamily({
            id: '@F1@',
            partners: [
                { individualId: '@I2@', sourceRole: 'wife' },
                { individualId: '@I1@', sourceRole: 'husband' },
            ],
        });

        const plan = createGedcomImportPlan(createDocument(individuals, [family]));

        expect(plan.coupleRelationships).toEqual([
            {
                key: 'couple:0',
                provenance: {
                    gedcomId: '@F1@',
                    path: 'families[0]',
                },
                data: {
                    partner1Key: 'person:0',
                    partner2Key: 'person:1',
                },
            },
        ]);
        expect(plan.issues).toEqual([]);
    });

    it('reports families with zero or one couple partner', () => {
        const individual = createIndividual({
            id: '@I1@',
            names: [createName({ value: 'Alice /Durand/' })],
        });
        const families = [
            createFamily({ id: '@F1@' }),
            createFamily({
                id: '@F2@',
                partners: [{ individualId: '@I1@', sourceRole: 'partner' }],
            }),
        ];

        const plan = createGedcomImportPlan(createDocument([individual], families));

        expect(plan.coupleRelationships).toEqual([]);
        expect(plan.issues).toEqual([
            expect.objectContaining({
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.MissingCouplePartners,
                provenance: {
                    gedcomId: '@F1@',
                    path: 'families[0].partners',
                },
                count: 2,
            }),
            expect.objectContaining({
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.MissingCouplePartners,
                provenance: {
                    gedcomId: '@F2@',
                    path: 'families[1].partners',
                },
                count: 1,
            }),
        ]);
    });

    it('reports a duplicated couple partner', () => {
        const individual = createIndividual({
            id: '@I1@',
            names: [createName({ value: 'Alice /Durand/' })],
        });
        const family = createFamily({
            id: '@F1@',
            partners: [
                { individualId: '@I1@', sourceRole: 'wife' },
                { individualId: '@I1@', sourceRole: 'husband' },
            ],
        });

        const plan = createGedcomImportPlan(createDocument([individual], [family]));

        expect(plan.coupleRelationships).toEqual([]);
        expect(plan.issues).toEqual([
            expect.objectContaining({
                kind: GedcomMappingIssueKind.Invalid,
                code: GedcomMappingIssueCode.DuplicateCouplePartner,
                count: 1,
            }),
        ]);
    });

    it('reports a family with more than two couple partners', () => {
        const individuals = ['@I1@', '@I2@', '@I3@'].map((id) =>
            createIndividual({
                id,
                names: [createName({ value: `Person ${id} /Test/` })],
            }),
        );
        const family = createFamily({
            id: '@F1@',
            partners: [
                { individualId: '@I1@', sourceRole: 'partner' },
                { individualId: '@I2@', sourceRole: 'partner' },
                { individualId: '@I3@', sourceRole: 'partner' },
            ],
        });

        const plan = createGedcomImportPlan(createDocument(individuals, [family]));

        expect(plan.coupleRelationships).toEqual([]);
        expect(plan.issues).toEqual([
            expect.objectContaining({
                kind: GedcomMappingIssueKind.Ambiguous,
                code: GedcomMappingIssueCode.MultipleCouplePartners,
                count: 1,
            }),
        ]);
    });

    it('retains the same couple from separate families', () => {
        const individuals = ['@I1@', '@I2@'].map((id) =>
            createIndividual({
                id,
                names: [createName({ value: `Person ${id} /Test/` })],
            }),
        );
        const familyPartners = [
            { individualId: '@I1@', sourceRole: 'partner' as const },
            { individualId: '@I2@', sourceRole: 'partner' as const },
        ];
        const families = [
            createFamily({ id: '@F1@', partners: familyPartners }),
            createFamily({ id: '@F2@', partners: familyPartners }),
        ];

        const plan = createGedcomImportPlan(createDocument(individuals, families));

        expect(plan.coupleRelationships).toHaveLength(2);
        expect(plan.coupleRelationships.map((relationship) => relationship.key)).toEqual([
            'couple:0',
            'couple:1',
        ]);
        expect(
            plan.coupleRelationships.map((relationship) => relationship.provenance.gedcomId),
        ).toEqual(['@F1@', '@F2@']);
        expect(plan.coupleRelationships[0]?.data).toEqual(plan.coupleRelationships[1]?.data);
        expect(plan.issues).toEqual([]);
    });

    it('maps standard couple events in GEDCOM order without losing their data', () => {
        const individuals = ['@I1@', '@I2@'].map((id) =>
            createIndividual({
                id,
                names: [createName({ value: `Person ${id} /Test/` })],
            }),
        );
        const eventDate: GenealogicalDate = {
            kind: 'about',
            first: {
                calendar: 'gregorian',
                year: 2000,
                month: null,
                day: null,
                epoch: 'common',
            },
            second: null,
            phrase: null,
            originalText: 'ABT 2000',
        };
        const tags = ['ENGA', 'MARR', 'DIV', 'ANUL', 'MARB', 'MARC', 'MARL', 'MARS', 'DIVF'];
        const family = createFamily({
            id: '@F1@',
            partners: [
                { individualId: '@I1@', sourceRole: 'partner' },
                { individualId: '@I2@', sourceRole: 'partner' },
            ],
            events: tags.map((tag, index) =>
                createEvent(tag, {
                    date: index === 0 ? eventDate : null,
                    description: index === 0 ? ' Engagement description ' : null,
                    place:
                        index === 0
                            ? {
                                  value: ' Paris ',
                                  format: null,
                                  latitude: null,
                                  longitude: null,
                                  language: null,
                                  extensions: [],
                              }
                            : null,
                }),
            ),
        });

        const plan = createGedcomImportPlan(createDocument(individuals, [family]));

        expect(plan.coupleRelationshipEvents.map((event) => event.data.eventType)).toEqual([
            CoupleRelationshipEventType.Engagement,
            CoupleRelationshipEventType.Marriage,
            CoupleRelationshipEventType.Divorce,
            CoupleRelationshipEventType.Annulment,
            CoupleRelationshipEventType.Other,
            CoupleRelationshipEventType.Other,
            CoupleRelationshipEventType.Other,
            CoupleRelationshipEventType.Other,
            CoupleRelationshipEventType.Other,
        ]);
        expect(plan.coupleRelationshipEvents.map((event) => event.key)).toEqual(
            tags.map((_tag, index) => `couple-event:${index}`),
        );
        expect(plan.coupleRelationshipEvents[0]).toMatchObject({
            provenance: {
                gedcomId: '@F1@',
                path: 'families[0].events[0]',
            },
            data: {
                coupleRelationshipKey: 'couple:0',
                date: eventDate,
                place: 'Paris',
                description: 'Engagement description',
            },
        });
        expect(plan.issues).toEqual([]);
    });

    it('maps known EVEN types and reports unsupported family events', () => {
        const individuals = ['@I1@', '@I2@'].map((id) =>
            createIndividual({
                id,
                names: [createName({ value: `Person ${id} /Test/` })],
            }),
        );
        const family = createFamily({
            id: '@F1@',
            partners: [
                { individualId: '@I1@', sourceRole: 'partner' },
                { individualId: '@I2@', sourceRole: 'partner' },
            ],
            events: [
                createEvent('EVEN', { type: '  Registered   Partnership  ' }),
                createEvent('EVEN', { type: ' SÉPARATION   LÉGALE ' }),
                createEvent('EVEN', { type: 'Custom ceremony' }),
                createEvent('CENS'),
                createEvent('RESI'),
            ],
        });

        const plan = createGedcomImportPlan(createDocument(individuals, [family]));

        expect(plan.coupleRelationshipEvents.map((event) => event.data.eventType)).toEqual([
            CoupleRelationshipEventType.CivilUnion,
            CoupleRelationshipEventType.Separation,
        ]);
        expect(plan.issues.map((issue) => issue.code)).toEqual([
            GedcomMappingIssueCode.UnsupportedFamilyEvent,
            GedcomMappingIssueCode.UnsupportedFamilyEvent,
            GedcomMappingIssueCode.UnsupportedFamilyEvent,
        ]);
        expect(plan.issues.every((issue) => issue.kind === GedcomMappingIssueKind.Ignored)).toBe(
            true,
        );
    });

    it('reports unsupported couple event details and family references', () => {
        const individuals = ['@I1@', '@I2@'].map((id) =>
            createIndividual({
                id,
                names: [createName({ value: `Person ${id} /Test/` })],
            }),
        );
        const sourceCitation = {
            sourceId: '@S1@',
            page: null,
            data: null,
            quality: null,
            extensions: [],
        };
        const family = createFamily({
            id: '@F1@',
            partners: [
                { individualId: '@I1@', sourceRole: 'partner' },
                { individualId: '@I2@', sourceRole: 'partner' },
            ],
            events: [
                createEvent('MARR', {
                    place: {
                        value: 'Paris',
                        format: ['City'],
                        latitude: 'N48',
                        longitude: null,
                        language: null,
                        extensions: [
                            createExtension(
                                '_PLACE',
                                'families[0].events[0].place.extensions[0]',
                                null,
                            ),
                        ],
                    },
                    noteReferences: [{ noteId: '@N1@', inlineNote: null }],
                    mediaReferences: [{ mediaId: '@M1@', inlineMedia: null }],
                    extensions: [
                        createExtension('_EVENT', 'families[0].events[0].extensions[0]', null),
                    ],
                }),
            ],
            sourceCitations: [sourceCitation],
            extensions: [
                createExtension(
                    '_FAMILY',
                    'families[0].extensions[0]',
                    'https://example.com/family',
                ),
            ],
        });

        const plan = createGedcomImportPlan(createDocument(individuals, [family]));

        expect(plan.coupleRelationshipEvents).toHaveLength(1);
        expect(plan.issues.map((issue) => [issue.code, issue.count])).toEqual([
            [GedcomMappingIssueCode.UnsupportedPlaceDetails, 3],
            [GedcomMappingIssueCode.UnsupportedSources, 1],
            [GedcomMappingIssueCode.UnsupportedNotes, 1],
            [GedcomMappingIssueCode.UnsupportedMedia, 1],
            [GedcomMappingIssueCode.UnsupportedExtension, 1],
            [GedcomMappingIssueCode.AmbiguousExtension, 1],
        ]);
    });

    it('returns an empty plan for an empty normalized document', () => {
        const plan = createGedcomImportPlan(createDocument([]));

        expect(plan).toEqual({
            people: [],
            parentChildRelationships: [],
            coupleRelationships: [],
            coupleRelationshipEvents: [],
            issues: [],
        });
    });

    it('reports unsupported document records and their extensions in stable order', () => {
        const documentExtension = createExtension('_DOCUMENT', 'extensions[0]', null);
        const sourceExtension = createExtension(
            '_SOURCE',
            'sources[0].extensions[0]',
            'https://example.com/source',
        );
        const fileExtension = createExtension(
            '_FILE',
            'media[0].files[0].extensions[0]',
            'https://example.com/file',
        );
        const document = createDocument([], [], {
            sources: [
                {
                    id: '@S1@',
                    title: null,
                    author: null,
                    publication: null,
                    repositoryReferences: [],
                    noteReferences: [],
                    mediaReferences: [],
                    extensions: [sourceExtension],
                },
            ],
            repositories: [
                {
                    id: '@R1@',
                    name: null,
                    address: null,
                    extensions: [],
                },
            ],
            sharedNotes: [
                {
                    id: '@N1@',
                    text: 'Shared note',
                    language: null,
                    mediaType: null,
                    extensions: [],
                },
            ],
            media: [
                {
                    id: '@M1@',
                    files: [
                        {
                            path: 'certificate.jpg',
                            mediaType: 'image/jpeg',
                            title: null,
                            extensions: [fileExtension],
                        },
                    ],
                    title: null,
                    extensions: [],
                },
            ],
            extensions: [documentExtension],
        });

        const firstPlan = createGedcomImportPlan(document);
        const secondPlan = createGedcomImportPlan(document);

        expect(secondPlan).toEqual(firstPlan);
        expect(firstPlan.issues.map((issue) => [issue.code, issue.count])).toEqual([
            [GedcomMappingIssueCode.UnsupportedSources, 1],
            [GedcomMappingIssueCode.UnsupportedRepositories, 1],
            [GedcomMappingIssueCode.UnsupportedNotes, 1],
            [GedcomMappingIssueCode.UnsupportedMedia, 1],
            [GedcomMappingIssueCode.AmbiguousExtension, 1],
            [GedcomMappingIssueCode.UnsupportedExtension, 1],
            [GedcomMappingIssueCode.UnsupportedExtension, 1],
        ]);
        expect(firstPlan.issues.slice(4).map((issue) => issue.provenance)).toEqual([
            { gedcomId: null, path: 'extensions[0]' },
            { gedcomId: '@S1@', path: 'sources[0].extensions[0]' },
            { gedcomId: '@M1@', path: 'media[0].files[0].extensions[0]' },
        ]);
    });

    it('reports mapped, ignored, ambiguous, and invalid document content together', () => {
        const individuals = [
            createIndividual({
                id: '@I1@',
                names: [createName({ value: 'Alice /Durand/' })],
            }),
            createIndividual({
                id: '@I2@',
                names: [createName({ value: 'Bob /Martin/' })],
            }),
            createIndividual({
                id: '@I3@',
                names: [createName({ value: '   ' })],
            }),
        ];
        const family = createFamily({
            id: '@F1@',
            partners: [
                { individualId: '@I1@', sourceRole: 'partner' },
                { individualId: '@I2@', sourceRole: 'partner' },
            ],
            events: [createEvent('CENS')],
        });
        const document = createDocument(individuals, [family], {
            extensions: [createExtension('_UNKNOWN', 'extensions[0]', null)],
        });

        const plan = createGedcomImportPlan(document);

        expect(plan.people).toHaveLength(2);
        expect(plan.coupleRelationships).toHaveLength(1);
        expect(new Set(plan.issues.map((issue) => issue.kind))).toEqual(
            new Set([
                GedcomMappingIssueKind.Ignored,
                GedcomMappingIssueKind.Ambiguous,
                GedcomMappingIssueKind.Invalid,
            ]),
        );
    });
});
