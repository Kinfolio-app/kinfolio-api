import type { GenealogicalDate, NormalizedIdentifier } from './common/gedcom-parser.types.js';
import type { Gender, LivingStatus } from '../people/person.types.js';
import type { CoupleRelationshipEventType } from '../relationships/couple-relationship.types.js';
import type {
    ParentChildRelationshipEvidenceStatus,
    ParentChildRelationshipType,
} from '../relationships/parent-child-relationship.types.js';

export type PlannedPersonKey = `person:${number}`;
export type PlannedParentChildRelationshipKey = `parent-child:${number}`;
export type PlannedCoupleRelationshipKey = `couple:${number}`;
export type PlannedCoupleRelationshipEventKey = `couple-event:${number}`;

export type GedcomMappingProvenance = {
    gedcomId: string | null;
    path: string;
};

export type PlannedPersonData = {
    firstName: string | null;
    middleNames: null;
    lastName: string | null;
    birthName: string | null;
    gender: Gender;
    birthDate: GenealogicalDate | null;
    birthPlace: string | null;
    deathDate: GenealogicalDate | null;
    deathPlace: string | null;
    livingStatus: LivingStatus;
    biography: null;
};

export type PlannedPerson = {
    key: PlannedPersonKey;
    provenance: GedcomMappingProvenance;
    identifiers: NormalizedIdentifier[];
    data: PlannedPersonData;
};

export type PlannedParentChildRelationship = {
    key: PlannedParentChildRelationshipKey;
    provenance: GedcomMappingProvenance;
    data: {
        parentKey: PlannedPersonKey;
        childKey: PlannedPersonKey;
        relationshipType: ParentChildRelationshipType;
        evidenceStatus: ParentChildRelationshipEvidenceStatus;
    };
};

export type PlannedCoupleRelationship = {
    key: PlannedCoupleRelationshipKey;
    provenance: GedcomMappingProvenance;
    data: {
        partner1Key: PlannedPersonKey;
        partner2Key: PlannedPersonKey;
    };
};

export type PlannedCoupleRelationshipEvent = {
    key: PlannedCoupleRelationshipEventKey;
    provenance: GedcomMappingProvenance;
    data: {
        coupleRelationshipKey: PlannedCoupleRelationshipKey;
        eventType: CoupleRelationshipEventType;
        date: GenealogicalDate | null;
        place: string | null;
        description: string | null;
    };
};

export const GedcomMappingIssueKind = {
    Ignored: 'ignored',
    Ambiguous: 'ambiguous',
    Invalid: 'invalid',
} as const;

export type GedcomMappingIssueKind =
    (typeof GedcomMappingIssueKind)[keyof typeof GedcomMappingIssueKind];

export const GedcomMappingIssueCode = {
    MissingName: 'missing_name',
    AdditionalName: 'additional_name',
    AdditionalBirthName: 'additional_birth_name',
    UnsupportedNamePart: 'unsupported_name_part',
    UnsupportedSex: 'unsupported_sex',
    AdditionalBirthEvent: 'additional_birth_event',
    AdditionalDeathEvent: 'additional_death_event',
    UnsupportedPlaceDetails: 'unsupported_place_details',
    UnsupportedIndividualEvent: 'unsupported_individual_event',
    UnsupportedIndividualAttribute: 'unsupported_individual_attribute',
    MissingPersonReference: 'missing_person_reference',
    SelfParentChildRelationship: 'self_parent_child_relationship',
    UnknownPedigree: 'unknown_pedigree',
    DisprovenFamilyLink: 'disproven_family_link',
    UnknownEvidenceStatus: 'unknown_evidence_status',
    ParentChildCycle: 'parent_child_cycle',
    MissingCouplePartners: 'missing_couple_partners',
    DuplicateCouplePartner: 'duplicate_couple_partner',
    MultipleCouplePartners: 'multiple_couple_partners',
    UnsupportedFamilyEvent: 'unsupported_family_event',
    UnsupportedSources: 'unsupported_sources',
    UnsupportedRepositories: 'unsupported_repositories',
    UnsupportedNotes: 'unsupported_notes',
    UnsupportedMedia: 'unsupported_media',
    UnsupportedExtension: 'unsupported_extension',
    AmbiguousExtension: 'ambiguous_extension',
} as const;

export type GedcomMappingIssueCode =
    (typeof GedcomMappingIssueCode)[keyof typeof GedcomMappingIssueCode];

export type GedcomMappingIssue = {
    kind: GedcomMappingIssueKind;
    code: GedcomMappingIssueCode;
    message: string;
    provenance: GedcomMappingProvenance;
    count: number;
};

export type GedcomImportPlan = {
    people: PlannedPerson[];
    parentChildRelationships: PlannedParentChildRelationship[];
    coupleRelationships: PlannedCoupleRelationship[];
    coupleRelationshipEvents: PlannedCoupleRelationshipEvent[];
    issues: GedcomMappingIssue[];
};
