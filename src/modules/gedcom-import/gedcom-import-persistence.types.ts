import type { NormalizedIdentifier } from './common/gedcom-parser.types.js';
import type { SupportedGedcomVersion } from './gedcom-file.types.js';
import type { GedcomImportPlan } from './gedcom-import-plan.types.js';

export type StoredGedcomImportData = Record<string, unknown>;

export const GedcomImportDraftStatus = {
    Blocked: 'blocked',
    NeedsResolution: 'needs_resolution',
    Ready: 'ready',
} as const;

export type GedcomImportDraftStatus =
    (typeof GedcomImportDraftStatus)[keyof typeof GedcomImportDraftStatus];

export type GedcomImportDraft = {
    id: string;
    sourceId: string;
    status: GedcomImportDraftStatus;
    fileSha256: string;
    fileContent: Uint8Array;
    gedcomVersion: SupportedGedcomVersion;
    plan: GedcomImportPlan;
    resolutions: StoredGedcomImportData;
    baseVersions: StoredGedcomImportData;
    revision: number;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
};

export type GedcomImportSource = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
};

export type GedcomImportRun = {
    id: string;
    sourceId: string;
    fileSha256: string;
    gedcomVersion: SupportedGedcomVersion;
    report: StoredGedcomImportData;
    createdAt: Date;
};

export type GedcomIndividualLink = {
    sourceId: string;
    gedcomId: string;
    personId: string;
    identifiers: NormalizedIdentifier[];
    lastImportedData: StoredGedcomImportData;
    lastSeenRunId: string;
    createdAt: Date;
    updatedAt: Date;
};

export type GedcomFamilyLink = {
    sourceId: string;
    gedcomId: string;
    coupleRelationshipId: string | null;
    lastImportedData: StoredGedcomImportData;
    lastSeenRunId: string;
    createdAt: Date;
    updatedAt: Date;
};

export type GedcomParentChildLink = {
    sourceId: string;
    familyGedcomId: string;
    parentGedcomId: string;
    childGedcomId: string;
    relationshipId: string;
    lastImportedData: StoredGedcomImportData;
    lastSeenRunId: string;
    createdAt: Date;
    updatedAt: Date;
};

export type GedcomCoupleEventLink = {
    sourceId: string;
    familyGedcomId: string;
    gedcomEventTag: string;
    occurrenceIndex: number;
    eventId: string;
    contentSha256: string;
    lastImportedData: StoredGedcomImportData;
    lastSeenRunId: string;
    createdAt: Date;
    updatedAt: Date;
};
