import { Gender, LivingStatus } from '../people/person.types.js';
import { CoupleRelationshipEventType } from '../relationships/couple-relationship.types.js';
import {
    ParentChildRelationshipEvidenceStatus,
    ParentChildRelationshipType,
} from '../relationships/parent-child-relationship.types.js';
import type {
    NormalizedEvent,
    NormalizedExtension,
    NormalizedFamily,
    NormalizedGedcomDocument,
    NormalizedIndividual,
    NormalizedName,
    NormalizedSex,
} from './common/gedcom-parser.types.js';
import {
    GedcomMappingIssueCode,
    GedcomMappingIssueKind,
    type GedcomImportPlan,
    type GedcomMappingIssue,
    type PlannedCoupleRelationship,
    type PlannedCoupleRelationshipEvent,
    type PlannedParentChildRelationship,
    type PlannedPerson,
    type PlannedPersonKey,
} from './gedcom-import-plan.types.js';

const GENDER_BY_GEDCOM_SEX = {
    male: Gender.Male,
    female: Gender.Female,
    other: Gender.Unspecified,
    unknown: Gender.Unspecified,
} as const satisfies Record<NonNullable<NormalizedIndividual['sex']>['value'], Gender>;

const COUPLE_EVENT_TYPE_BY_TAG: Record<string, CoupleRelationshipEventType> = {
    ENGA: CoupleRelationshipEventType.Engagement,
    MARR: CoupleRelationshipEventType.Marriage,
    DIV: CoupleRelationshipEventType.Divorce,
    ANUL: CoupleRelationshipEventType.Annulment,
    MARB: CoupleRelationshipEventType.Other,
    MARC: CoupleRelationshipEventType.Other,
    MARL: CoupleRelationshipEventType.Other,
    MARS: CoupleRelationshipEventType.Other,
    DIVF: CoupleRelationshipEventType.Other,
};

const CIVIL_UNION_EVENT_TYPES = new Set([
    'civil union',
    'civil partnership',
    'registered partnership',
    'domestic partnership',
    'pacs',
    'union civile',
    'partenariat civil',
]);

const SEPARATION_EVENT_TYPES = new Set([
    'separation',
    'séparation',
    'legal separation',
    'séparation légale',
    'separated',
    'séparés',
]);

type PersonNameMappingResult = {
    firstName: string | null;
    lastName: string | null;
    birthName: string | null;
    usable: boolean;
    issues: GedcomMappingIssue[];
};

type ParsedPrimaryName = {
    givenNames: string | null;
    surname: string | null;
    suffix: string | null;
};

type IndividualIssueDetails = Omit<GedcomMappingIssue, 'kind' | 'provenance'> & {
    kind?: GedcomMappingIssue['kind'];
    path: string;
};

function createIndividualIssue(
    individual: NormalizedIndividual,
    index: number,
    details: IndividualIssueDetails,
): GedcomMappingIssue | null {
    if (details.count <= 0) return null;

    return {
        kind: details.kind ?? GedcomMappingIssueKind.Ignored,
        code: details.code,
        message: details.message,
        provenance: {
            gedcomId: individual.id,
            path: `individuals[${index}]${details.path}`,
        },
        count: details.count,
    };
}

function appendIndividualIssue(
    issues: GedcomMappingIssue[],
    individual: NormalizedIndividual,
    index: number,
    details: IndividualIssueDetails,
): void {
    const issue = createIndividualIssue(individual, index, details);
    if (issue !== null) issues.push(issue);
}

function partitionPersonNames(allNames: NormalizedName[]): {
    names: NormalizedName[];
    birthNames: NormalizedName[];
} {
    const [names, birthNames] = allNames.reduce<[NormalizedName[], NormalizedName[]]>(
        ([names, birthNames], name) => {
            const type = name.type?.trim().toUpperCase();

            if (type === 'BIRTH' || type === 'MAIDEN') {
                birthNames.push(name);
            } else {
                names.push(name);
            }

            return [names, birthNames];
        },
        [[], []],
    );

    return {
        names,
        birthNames,
    };
}

function parseNameValue(value: string): ParsedPrimaryName {
    const firstSlash = value.indexOf('/');
    const secondSlash = firstSlash === -1 ? -1 : value.indexOf('/', firstSlash + 1);

    if (firstSlash === -1 || secondSlash === -1) {
        const givenNames = value.trim();

        return {
            givenNames: givenNames || null,
            surname: null,
            suffix: null,
        };
    }

    const givenNames = value.slice(0, firstSlash).trim();
    const surname = value.slice(firstSlash + 1, secondSlash).trim();
    const suffix = value.slice(secondSlash + 1).trim();

    return {
        givenNames: givenNames || null,
        surname: surname || null,
        suffix: suffix || null,
    };
}

function selectIndividualEvent(
    individual: NormalizedIndividual,
    index: number,
    tag: 'BIRT' | 'DEAT',
): {
    event: NormalizedEvent | null;
    issue: GedcomMappingIssue | null;
} {
    let issue: GedcomMappingIssue | null = null;
    const filteredEvent = individual.events.filter((event) => event.tag === tag);

    if (filteredEvent.length > 1) {
        issue = createIndividualIssue(individual, index, {
            code:
                tag === 'BIRT'
                    ? GedcomMappingIssueCode.AdditionalBirthEvent
                    : GedcomMappingIssueCode.AdditionalDeathEvent,
            message: `Additional ${tag === 'BIRT' ? 'birth' : 'death'} events are not imported.`,
            path: '.events',
            count: filteredEvent.length - 1,
        });
    }

    return { event: filteredEvent[0] ?? null, issue };
}

function countUnsupportedPlaceDetails(event: NormalizedEvent | null): number {
    const place = event?.place;

    if (place === null || place === undefined) {
        return 0;
    }

    const unsupportedFields = [
        place.format !== null && place.format.length > 0,
        place.latitude !== null && place.latitude.trim().length > 0,
        place.longitude !== null && place.longitude.trim().length > 0,
        place.language !== null && place.language.trim().length > 0,
    ];

    return unsupportedFields.filter(Boolean).length + place.extensions.length;
}

function collectIndividualExtensions(individual: NormalizedIndividual): NormalizedExtension[] {
    const extensions: NormalizedExtension[] = [];

    const appendExtensions = (values: NormalizedExtension[]): void => {
        values.forEach((extension) => {
            extensions.push(extension);
            appendExtensions(extension.children);
        });
    };

    const appendReferenceExtensions = (
        sourceCitations: NormalizedIndividual['sourceCitations'],
        noteReferences: NormalizedIndividual['noteReferences'],
        mediaReferences: NormalizedIndividual['mediaReferences'] = [],
    ): void => {
        sourceCitations.forEach((citation) => appendExtensions(citation.extensions));
        noteReferences.forEach((reference) => {
            if (reference.inlineNote !== null) appendExtensions(reference.inlineNote.extensions);
        });
        mediaReferences.forEach((reference) => {
            if (reference.inlineMedia === null) return;

            appendExtensions(reference.inlineMedia.extensions);
            reference.inlineMedia.files.forEach((file) => appendExtensions(file.extensions));
        });
    };

    appendExtensions(individual.extensions);
    individual.names.forEach((name) => appendExtensions(name.extensions));
    appendReferenceExtensions(
        individual.sourceCitations,
        individual.noteReferences,
        individual.mediaReferences,
    );

    individual.events.forEach((event) => {
        appendExtensions(event.extensions);
        appendReferenceExtensions(
            event.sourceCitations,
            event.noteReferences,
            event.mediaReferences,
        );
    });

    individual.attributes.forEach((attribute) => {
        appendExtensions(attribute.extensions);
        appendReferenceExtensions(attribute.sourceCitations, attribute.noteReferences);
    });

    return extensions;
}

function countIndividualReferences(individual: NormalizedIndividual): {
    sources: number;
    notes: number;
    media: number;
} {
    const sourceAndNoteContainers = [individual, ...individual.events, ...individual.attributes];
    const mediaContainers = [individual, ...individual.events];

    return {
        sources: sourceAndNoteContainers.reduce(
            (count, container) => count + container.sourceCitations.length,
            0,
        ),
        notes: sourceAndNoteContainers.reduce(
            (count, container) => count + container.noteReferences.length,
            0,
        ),
        media: mediaContainers.reduce(
            (count, container) => count + container.mediaReferences.length,
            0,
        ),
    };
}

function countUnsupportedNameParts(names: NormalizedName[]): number {
    const unsupportedNamePartCount = names.reduce((count, name) => {
        const unsupportedParts = [name.prefix, name.suffix, name.nickname].filter(
            (value) => value !== null && value.trim().length > 0,
        );

        const parsedSuffix = parseNameValue(name.value).suffix;
        const hasStructuredSuffix = Boolean(name.suffix?.trim());
        const parsedSuffixCount = parsedSuffix !== null && !hasStructuredSuffix ? 1 : 0;

        return count + unsupportedParts.length + parsedSuffixCount;
    }, 0);

    return unsupportedNamePartCount;
}

function joinSurname(name: string | null, prefix: string | null): string | null {
    const normalizedPrefix = prefix?.trim() || null;
    const normalizedSurname = name?.trim() || null;

    if (normalizedSurname === null) {
        return null;
    }

    if (
        normalizedPrefix === null ||
        normalizedSurname.toLocaleLowerCase().startsWith(`${normalizedPrefix.toLocaleLowerCase()} `)
    ) {
        return normalizedSurname;
    }

    return `${normalizedPrefix} ${normalizedSurname}`;
}

function createPersonKeyByGedcomId(people: PlannedPerson[]): Map<string, PlannedPersonKey> {
    const personKeyByGedcomId = new Map<string, PlannedPersonKey>();

    people.forEach((person) => {
        const gedcomId = person.provenance.gedcomId;
        if (gedcomId !== null) {
            personKeyByGedcomId.set(gedcomId, person.key);
        }
    });

    return personKeyByGedcomId;
}

function mapParentChildRelationshipType(pedigree: string | null): {
    relationshipType: ParentChildRelationshipType;
    unknownValue: string | null;
} {
    const normalizedPedigree = pedigree?.trim().toUpperCase() || null;

    if (normalizedPedigree === null || normalizedPedigree === 'BIRTH') {
        return {
            relationshipType: ParentChildRelationshipType.Unspecified,
            unknownValue: null,
        };
    }

    const relationshipTypeByPedigree: Record<string, ParentChildRelationshipType> = {
        ADOPTED: ParentChildRelationshipType.Adoptive,
        FOSTER: ParentChildRelationshipType.Foster,
        SEALING: ParentChildRelationshipType.Other,
        OTHER: ParentChildRelationshipType.Other,
    };
    const relationshipType = relationshipTypeByPedigree[normalizedPedigree];

    return relationshipType === undefined
        ? {
              relationshipType: ParentChildRelationshipType.Unspecified,
              unknownValue: pedigree,
          }
        : { relationshipType, unknownValue: null };
}

function mapParentChildEvidenceStatus(status: string | null): {
    evidenceStatus: ParentChildRelationshipEvidenceStatus;
    isDisproven: boolean;
    unknownValue: string | null;
} {
    const normalizedStatus = status?.trim().toUpperCase() || null;

    if (normalizedStatus === null) {
        return {
            evidenceStatus: ParentChildRelationshipEvidenceStatus.Unassessed,
            isDisproven: false,
            unknownValue: null,
        };
    }

    if (normalizedStatus === 'DISPROVEN') {
        return {
            evidenceStatus: ParentChildRelationshipEvidenceStatus.Unassessed,
            isDisproven: true,
            unknownValue: null,
        };
    }

    const evidenceStatusByGedcomStatus: Record<string, ParentChildRelationshipEvidenceStatus> = {
        PROVEN: ParentChildRelationshipEvidenceStatus.Proven,
        CHALLENGED: ParentChildRelationshipEvidenceStatus.Challenged,
    };
    const evidenceStatus = evidenceStatusByGedcomStatus[normalizedStatus];

    return evidenceStatus === undefined
        ? {
              evidenceStatus: ParentChildRelationshipEvidenceStatus.Unassessed,
              isDisproven: false,
              unknownValue: status,
          }
        : { evidenceStatus, isDisproven: false, unknownValue: null };
}

function mapGender(sex: NormalizedSex | null): Gender {
    if (sex === null) return Gender.Unspecified;

    return GENDER_BY_GEDCOM_SEX[sex.value];
}

function mapPersonNames(individual: NormalizedIndividual, index: number): PersonNameMappingResult {
    const issues: GedcomMappingIssue[] = [];

    const { names, birthNames } = partitionPersonNames(individual.names);
    const primaryName = individual.names.find((name) => name.isPrimary) ?? individual.names[0];
    const additionalNames = names.filter((name) => name !== primaryName);

    const parsedPrimaryName =
        primaryName === undefined
            ? { givenNames: null, surname: null, suffix: null }
            : parseNameValue(primaryName.value);

    const unsupportedNamePartCount = countUnsupportedNameParts(individual.names);

    appendIndividualIssue(issues, individual, index, {
        code: GedcomMappingIssueCode.AdditionalName,
        message: 'Additional names are not imported.',
        path: '.names',
        count: additionalNames.length,
    });
    appendIndividualIssue(issues, individual, index, {
        code: GedcomMappingIssueCode.AdditionalBirthName,
        message: 'Additional birth names are not imported.',
        path: '.names',
        count: birthNames.length - 1,
    });
    appendIndividualIssue(issues, individual, index, {
        code: GedcomMappingIssueCode.UnsupportedNamePart,
        message: 'Name prefixes, suffixes, and nicknames are not imported.',
        path: '.names',
        count: unsupportedNamePartCount,
    });

    const parsedBirthName =
        birthNames[0] === undefined
            ? { givenNames: null, surname: null }
            : parseNameValue(birthNames[0].value);

    const firstName = primaryName?.givenNames?.trim() || parsedPrimaryName.givenNames;
    const lastName = primaryName?.surname?.trim() || parsedPrimaryName.surname;
    const birthName = birthNames[0]?.surname?.trim() || parsedBirthName.surname;

    return {
        firstName,
        lastName:
            primaryName === undefined
                ? null
                : joinSurname(lastName, primaryName?.surnamePrefix ?? null),
        birthName:
            birthNames[0] === undefined
                ? null
                : joinSurname(birthName, birthNames[0].surnamePrefix ?? null),
        usable: firstName !== null || lastName !== null || birthName !== null,
        issues,
    };
}

function createPlannedPerson(
    individual: NormalizedIndividual,
    index: number,
): { person: PlannedPerson | null; issues: GedcomMappingIssue[] } {
    const names = mapPersonNames(individual, index);

    const issues: GedcomMappingIssue[] = [...names.issues];

    if (individual.sex?.value === 'other') {
        appendIndividualIssue(issues, individual, index, {
            code: GedcomMappingIssueCode.UnsupportedSex,
            message: `GEDCOM sex value "${individual.sex.originalValue}" cannot be mapped to a Kinfolio gender.`,
            path: '.sex',
            count: 1,
        });
    }

    if (!names.usable) {
        appendIndividualIssue(issues, individual, index, {
            kind: GedcomMappingIssueKind.Invalid,
            code: GedcomMappingIssueCode.MissingName,
            message: 'The individual has no usable name.',
            path: '.names',
            count: 1,
        });

        return {
            person: null,
            issues,
        };
    }

    const birthEvent = selectIndividualEvent(individual, index, 'BIRT');
    if (birthEvent.issue !== null) issues.push(birthEvent.issue);
    const deathEvent = selectIndividualEvent(individual, index, 'DEAT');
    if (deathEvent.issue !== null) issues.push(deathEvent.issue);

    const unsupportedPlaceDetailsCount =
        countUnsupportedPlaceDetails(birthEvent.event) +
        countUnsupportedPlaceDetails(deathEvent.event);

    appendIndividualIssue(issues, individual, index, {
        code: GedcomMappingIssueCode.UnsupportedPlaceDetails,
        message: 'Place format, coordinates, language, and extensions are not imported.',
        path: '.events',
        count: unsupportedPlaceDetailsCount,
    });

    const unsupportedIndividualEventCount = individual.events.filter(
        (event) => event.tag !== 'BIRT' && event.tag !== 'DEAT',
    ).length;

    appendIndividualIssue(issues, individual, index, {
        code: GedcomMappingIssueCode.UnsupportedIndividualEvent,
        message: 'Individual events other than birth and death are not imported.',
        path: '.events',
        count: unsupportedIndividualEventCount,
    });
    appendIndividualIssue(issues, individual, index, {
        code: GedcomMappingIssueCode.UnsupportedIndividualAttribute,
        message: 'Individual attributes are not imported.',
        path: '.attributes',
        count: individual.attributes.length,
    });

    const referenceCounts = countIndividualReferences(individual);
    const unsupportedReferences = [
        {
            code: GedcomMappingIssueCode.UnsupportedSources,
            message: 'Source citations are not imported.',
            count: referenceCounts.sources,
        },
        {
            code: GedcomMappingIssueCode.UnsupportedNotes,
            message: 'Note references are not imported.',
            count: referenceCounts.notes,
        },
        {
            code: GedcomMappingIssueCode.UnsupportedMedia,
            message: 'Media references are not imported.',
            count: referenceCounts.media,
        },
    ];

    unsupportedReferences.forEach((reference) => {
        appendIndividualIssue(issues, individual, index, {
            ...reference,
            path: '',
        });
    });

    collectIndividualExtensions(individual).forEach((extension) => {
        const hasResolvedUri = extension.uri !== null && extension.uri.trim().length > 0;

        issues.push({
            kind: hasResolvedUri
                ? GedcomMappingIssueKind.Ignored
                : GedcomMappingIssueKind.Ambiguous,
            code: hasResolvedUri
                ? GedcomMappingIssueCode.UnsupportedExtension
                : GedcomMappingIssueCode.AmbiguousExtension,
            message: hasResolvedUri
                ? `Extension "${extension.tag}" is not imported.`
                : `Extension "${extension.tag}" has no identifiable URI.`,
            provenance: {
                gedcomId: individual.id,
                path: extension.path,
            },
            count: 1,
        });
    });

    return {
        person: {
            key: `person:${index}`,
            identifiers: individual.identifiers,
            provenance: {
                gedcomId: individual.id,
                path: `individuals[${index}]`,
            },
            data: {
                firstName: names.firstName,
                middleNames: null,
                lastName: names.lastName,
                gender: mapGender(individual.sex),
                livingStatus:
                    deathEvent.event === null ? LivingStatus.Unknown : LivingStatus.Deceased,
                birthDate: birthEvent.event?.date ?? null,
                birthPlace: birthEvent.event?.place?.value.trim() || null,
                birthName: names.birthName,
                deathDate: deathEvent.event?.date ?? null,
                deathPlace: deathEvent.event?.place?.value.trim() || null,
                biography: null,
            },
        },
        issues,
    };
}

function createPlannedParentChildRelationships(
    family: NormalizedFamily,
    index: number,
    personKeyByGedcomId: Map<string, PlannedPersonKey>,
    relationshipStartIndex: number,
): {
    relationships: PlannedParentChildRelationship[];
    issues: GedcomMappingIssue[];
} {
    const issues: GedcomMappingIssue[] = [];
    const relationships: PlannedParentChildRelationship[] = [];

    const resolvedPartners = family.partners
        .map((partner, partnerIndex) => {
            const key = personKeyByGedcomId.get(partner.individualId);

            if (key === undefined) {
                issues.push({
                    kind: GedcomMappingIssueKind.Invalid,
                    code: GedcomMappingIssueCode.MissingPersonReference,
                    message: `Partner reference "${partner.individualId}" does not match a planned person.`,
                    provenance: {
                        gedcomId: family.id,
                        path: `families[${index}].partners[${partnerIndex}]`,
                    },
                    count: 1,
                });
                return null;
            }

            return key;
        })
        .filter((key): key is PlannedPersonKey => key !== null);

    const resolvedChildren = family.children
        .map((child, childIndex) => {
            const key = personKeyByGedcomId.get(child.individualId);

            if (key === undefined) {
                issues.push({
                    kind: GedcomMappingIssueKind.Invalid,
                    code: GedcomMappingIssueCode.MissingPersonReference,
                    message: `Child reference "${child.individualId}" does not match a planned person.`,
                    provenance: {
                        gedcomId: family.id,
                        path: `families[${index}].children[${childIndex}]`,
                    },
                    count: 1,
                });
                return null;
            }

            const pedigreeMapping = mapParentChildRelationshipType(child.pedigree);
            const evidenceStatusMapping = mapParentChildEvidenceStatus(child.status);

            if (pedigreeMapping.unknownValue !== null) {
                issues.push({
                    kind: GedcomMappingIssueKind.Ambiguous,
                    code: GedcomMappingIssueCode.UnknownPedigree,
                    message: `PEDI value "${pedigreeMapping.unknownValue}" cannot be mapped to a Kinfolio relationship type.`,
                    provenance: {
                        gedcomId: family.id,
                        path: `families[${index}].children[${childIndex}].pedigree`,
                    },
                    count: 1,
                });
            }

            if (evidenceStatusMapping.unknownValue !== null) {
                issues.push({
                    kind: GedcomMappingIssueKind.Ambiguous,
                    code: GedcomMappingIssueCode.UnknownEvidenceStatus,
                    message: `STAT value "${evidenceStatusMapping.unknownValue}" cannot be mapped to a Kinfolio evidence status.`,
                    provenance: {
                        gedcomId: family.id,
                        path: `families[${index}].children[${childIndex}].status`,
                    },
                    count: 1,
                });
            }

            if (evidenceStatusMapping.isDisproven) {
                issues.push({
                    kind: GedcomMappingIssueKind.Ignored,
                    code: GedcomMappingIssueCode.DisprovenFamilyLink,
                    message: 'A family link marked as disproven is not imported.',
                    provenance: {
                        gedcomId: family.id,
                        path: `families[${index}].children[${childIndex}].status`,
                    },
                    count: 1,
                });
            }

            return {
                key,
                relationshipType: pedigreeMapping.relationshipType,
                evidenceStatus: evidenceStatusMapping.evidenceStatus,
                isDisproven: evidenceStatusMapping.isDisproven,
                childIndex,
            };
        })
        .filter((resolvedChild) => resolvedChild !== null);

    resolvedPartners.forEach((parentKey) => {
        resolvedChildren.forEach(
            ({ key: childKey, relationshipType, evidenceStatus, isDisproven, childIndex }) => {
                if (isDisproven) return;

                if (parentKey === childKey) {
                    issues.push({
                        kind: GedcomMappingIssueKind.Invalid,
                        code: GedcomMappingIssueCode.SelfParentChildRelationship,
                        message: 'A person cannot be their own parent.',
                        provenance: {
                            gedcomId: family.id,
                            path: `families[${index}].children[${childIndex}]`,
                        },
                        count: 1,
                    });
                    return;
                }

                relationships.push({
                    key: `parent-child:${relationshipStartIndex + relationships.length}`,
                    provenance: {
                        gedcomId: family.id,
                        path: `families[${index}]`,
                    },
                    data: {
                        parentKey,
                        childKey,
                        relationshipType,
                        evidenceStatus,
                    },
                });
            },
        );
    });

    return {
        relationships,
        issues,
    };
}

function detectParentChildCycles(
    relationships: PlannedParentChildRelationship[],
): GedcomMappingIssue[] {
    const issues: GedcomMappingIssue[] = [];
    const relationshipsByParent = new Map<PlannedPersonKey, PlannedParentChildRelationship[]>();
    const visitStates = new Map<PlannedPersonKey, 'visiting' | 'visited'>();

    relationships.forEach((relationship) => {
        const parentRelationships = relationshipsByParent.get(relationship.data.parentKey) ?? [];

        parentRelationships.push(relationship);
        relationshipsByParent.set(relationship.data.parentKey, parentRelationships);
    });

    const visit = (personKey: PlannedPersonKey): void => {
        visitStates.set(personKey, 'visiting');

        const outgoingRelationships = relationshipsByParent.get(personKey) ?? [];

        outgoingRelationships.forEach((relationship) => {
            const childKey = relationship.data.childKey;
            const childState = visitStates.get(childKey);

            if (childState === 'visiting') {
                issues.push({
                    kind: GedcomMappingIssueKind.Invalid,
                    code: GedcomMappingIssueCode.ParentChildCycle,
                    message: 'Parent-child relationships contain a cycle.',
                    provenance: relationship.provenance,
                    count: 1,
                });
                return;
            }

            if (childState === undefined) {
                visit(childKey);
            }
        });

        visitStates.set(personKey, 'visited');
    };

    relationshipsByParent.forEach((_relationships, parentKey) => {
        if (!visitStates.has(parentKey)) {
            visit(parentKey);
        }
    });

    return issues;
}

function getPersonKeyIndex(key: PlannedPersonKey): number {
    return Number(key.slice('person:'.length));
}

function createPlannedCoupleRelationship(
    family: NormalizedFamily,
    familyIndex: number,
    personKeyByGedcomId: Map<string, PlannedPersonKey>,
    coupleIndex: number,
): {
    relationship: PlannedCoupleRelationship | null;
    issues: GedcomMappingIssue[];
} {
    if (family.partners.length < 2) {
        return {
            relationship: null,
            issues: [
                {
                    kind: GedcomMappingIssueKind.Ignored,
                    code: GedcomMappingIssueCode.MissingCouplePartners,
                    message: 'A couple relationship requires two partners.',
                    provenance: {
                        gedcomId: family.id,
                        path: `families[${familyIndex}].partners`,
                    },
                    count: 2 - family.partners.length,
                },
            ],
        };
    }

    if (family.partners.length > 2) {
        return {
            relationship: null,
            issues: [
                {
                    kind: GedcomMappingIssueKind.Ambiguous,
                    code: GedcomMappingIssueCode.MultipleCouplePartners,
                    message: 'A couple relationship cannot select among more than two partners.',
                    provenance: {
                        gedcomId: family.id,
                        path: `families[${familyIndex}].partners`,
                    },
                    count: family.partners.length - 2,
                },
            ],
        };
    }

    const partnerKeys = family.partners.map((partner) =>
        personKeyByGedcomId.get(partner.individualId),
    );
    const firstPartnerKey = partnerKeys[0];
    const secondPartnerKey = partnerKeys[1];

    if (firstPartnerKey === undefined || secondPartnerKey === undefined) {
        return { relationship: null, issues: [] };
    }

    if (firstPartnerKey === secondPartnerKey) {
        return {
            relationship: null,
            issues: [
                {
                    kind: GedcomMappingIssueKind.Invalid,
                    code: GedcomMappingIssueCode.DuplicateCouplePartner,
                    message: 'A person cannot occupy both sides of a couple relationship.',
                    provenance: {
                        gedcomId: family.id,
                        path: `families[${familyIndex}].partners`,
                    },
                    count: 1,
                },
            ],
        };
    }

    const firstPartnerComesFirst =
        getPersonKeyIndex(firstPartnerKey) < getPersonKeyIndex(secondPartnerKey);
    const partner1Key = firstPartnerComesFirst ? firstPartnerKey : secondPartnerKey;
    const partner2Key = firstPartnerComesFirst ? secondPartnerKey : firstPartnerKey;

    return {
        relationship: {
            key: `couple:${coupleIndex}`,
            provenance: {
                gedcomId: family.id,
                path: `families[${familyIndex}]`,
            },
            data: {
                partner1Key,
                partner2Key,
            },
        },
        issues: [],
    };
}

function normalizeCoupleEventType(value: string): string {
    // Matches one or more whitespace characters; there are no capture groups.
    return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function mapCoupleRelationshipEventType(
    event: NormalizedEvent,
): CoupleRelationshipEventType | null {
    const tag = event.tag.trim().toUpperCase();

    if (tag === 'EVEN') {
        const normalizedType = normalizeCoupleEventType(event.type ?? '');

        if (CIVIL_UNION_EVENT_TYPES.has(normalizedType)) {
            return CoupleRelationshipEventType.CivilUnion;
        }
        if (SEPARATION_EVENT_TYPES.has(normalizedType)) {
            return CoupleRelationshipEventType.Separation;
        }

        return null;
    }

    return COUPLE_EVENT_TYPE_BY_TAG[tag] ?? null;
}

function collectFamilyExtensions(family: NormalizedFamily): NormalizedExtension[] {
    const extensions: NormalizedExtension[] = [];

    const appendExtensions = (values: NormalizedExtension[]): void => {
        values.forEach((extension) => {
            extensions.push(extension);
            appendExtensions(extension.children);
        });
    };
    const appendReferenceExtensions = (
        sourceCitations: NormalizedFamily['sourceCitations'],
        noteReferences: NormalizedFamily['noteReferences'],
        mediaReferences: NormalizedFamily['mediaReferences'],
    ): void => {
        sourceCitations.forEach((citation) => appendExtensions(citation.extensions));
        noteReferences.forEach((reference) => {
            if (reference.inlineNote !== null) appendExtensions(reference.inlineNote.extensions);
        });
        mediaReferences.forEach((reference) => {
            if (reference.inlineMedia === null) return;

            appendExtensions(reference.inlineMedia.extensions);
            reference.inlineMedia.files.forEach((file) => appendExtensions(file.extensions));
        });
    };

    appendExtensions(family.extensions);
    appendReferenceExtensions(
        family.sourceCitations,
        family.noteReferences,
        family.mediaReferences,
    );
    family.events.forEach((event) => {
        appendExtensions(event.extensions);
        appendReferenceExtensions(
            event.sourceCitations,
            event.noteReferences,
            event.mediaReferences,
        );
    });

    return extensions;
}

function createPlannedCoupleRelationshipEvents(
    family: NormalizedFamily,
    familyIndex: number,
    coupleRelationship: PlannedCoupleRelationship,
    eventStartIndex: number,
): {
    events: PlannedCoupleRelationshipEvent[];
    issues: GedcomMappingIssue[];
} {
    const events: PlannedCoupleRelationshipEvent[] = [];
    const issues: GedcomMappingIssue[] = [];

    family.events.forEach((event, eventIndex) => {
        const eventType = mapCoupleRelationshipEventType(event);
        const eventPath = `families[${familyIndex}].events[${eventIndex}]`;

        if (eventType === null) {
            issues.push({
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedFamilyEvent,
                message: `Family event "${event.tag}" is not imported.`,
                provenance: {
                    gedcomId: family.id,
                    path: eventPath,
                },
                count: 1,
            });
            return;
        }

        events.push({
            key: `couple-event:${eventStartIndex + events.length}`,
            provenance: {
                gedcomId: family.id,
                path: eventPath,
            },
            data: {
                coupleRelationshipKey: coupleRelationship.key,
                eventType,
                date: event.date,
                place: event.place?.value.trim() || null,
                description: event.description?.trim() || null,
            },
        });

        const unsupportedPlaceDetailsCount = countUnsupportedPlaceDetails(event);
        if (unsupportedPlaceDetailsCount > 0) {
            issues.push({
                kind: GedcomMappingIssueKind.Ignored,
                code: GedcomMappingIssueCode.UnsupportedPlaceDetails,
                message: 'Place format, coordinates, language, and extensions are not imported.',
                provenance: {
                    gedcomId: family.id,
                    path: `${eventPath}.place`,
                },
                count: unsupportedPlaceDetailsCount,
            });
        }
    });

    const sourceCount =
        family.sourceCitations.length +
        family.events.reduce((count, event) => count + event.sourceCitations.length, 0);
    const noteCount =
        family.noteReferences.length +
        family.events.reduce((count, event) => count + event.noteReferences.length, 0);
    const mediaCount =
        family.mediaReferences.length +
        family.events.reduce((count, event) => count + event.mediaReferences.length, 0);
    const referenceIssues = [
        {
            code: GedcomMappingIssueCode.UnsupportedSources,
            message: 'Family source citations are not imported.',
            count: sourceCount,
        },
        {
            code: GedcomMappingIssueCode.UnsupportedNotes,
            message: 'Family note references are not imported.',
            count: noteCount,
        },
        {
            code: GedcomMappingIssueCode.UnsupportedMedia,
            message: 'Family media references are not imported.',
            count: mediaCount,
        },
    ];

    referenceIssues.forEach((referenceIssue) => {
        if (referenceIssue.count <= 0) return;

        issues.push({
            kind: GedcomMappingIssueKind.Ignored,
            ...referenceIssue,
            provenance: {
                gedcomId: family.id,
                path: `families[${familyIndex}]`,
            },
        });
    });

    collectFamilyExtensions(family).forEach((extension) => {
        const hasResolvedUri = extension.uri !== null && extension.uri.trim().length > 0;

        issues.push({
            kind: hasResolvedUri
                ? GedcomMappingIssueKind.Ignored
                : GedcomMappingIssueKind.Ambiguous,
            code: hasResolvedUri
                ? GedcomMappingIssueCode.UnsupportedExtension
                : GedcomMappingIssueCode.AmbiguousExtension,
            message: hasResolvedUri
                ? `Extension "${extension.tag}" is not imported.`
                : `Extension "${extension.tag}" has no identifiable URI.`,
            provenance: {
                gedcomId: family.id,
                path: extension.path,
            },
            count: 1,
        });
    });

    return { events, issues };
}

export function createGedcomImportPlan(
    document: NormalizedGedcomDocument | null,
): GedcomImportPlan {
    if (document === null) {
        return {
            people: [],
            parentChildRelationships: [],
            coupleRelationships: [],
            coupleRelationshipEvents: [],
            issues: [],
        };
    }

    const issues: GedcomMappingIssue[] = [];
    const people: PlannedPerson[] = [];
    const parentChildRelationships: PlannedParentChildRelationship[] = [];
    const coupleRelationships: PlannedCoupleRelationship[] = [];
    const coupleRelationshipEvents: PlannedCoupleRelationshipEvent[] = [];

    document.individuals.forEach((individual, index) => {
        const result = createPlannedPerson(individual, index);
        issues.push(...result.issues);
        if (result.person !== null) {
            people.push(result.person);
        }
    });

    const personKeyByGedcomId = createPersonKeyByGedcomId(people);

    document.families.forEach((family, index) => {
        const result = createPlannedParentChildRelationships(
            family,
            index,
            personKeyByGedcomId,
            parentChildRelationships.length,
        );
        issues.push(...result.issues);
        parentChildRelationships.push(...result.relationships);

        const coupleResult = createPlannedCoupleRelationship(
            family,
            index,
            personKeyByGedcomId,
            coupleRelationships.length,
        );
        issues.push(...coupleResult.issues);
        if (coupleResult.relationship !== null) {
            coupleRelationships.push(coupleResult.relationship);

            const eventResult = createPlannedCoupleRelationshipEvents(
                family,
                index,
                coupleResult.relationship,
                coupleRelationshipEvents.length,
            );
            coupleRelationshipEvents.push(...eventResult.events);
            issues.push(...eventResult.issues);
        }
    });

    issues.push(...detectParentChildCycles(parentChildRelationships));

    return {
        people,
        parentChildRelationships,
        coupleRelationships,
        coupleRelationshipEvents,
        issues,
    };
}
