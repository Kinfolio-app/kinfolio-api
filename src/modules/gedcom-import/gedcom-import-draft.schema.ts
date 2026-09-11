import Type from 'typebox';
import { GenealogicalDateSchema } from '../../shared/genealogy/genealogical-date.schema.js';
import { Gender, LivingStatus } from '../people/person.types.js';
import { CoupleRelationshipEventType } from '../relationships/couple-relationship.types.js';
import {
    ParentChildRelationshipEvidenceStatus,
    ParentChildRelationshipType,
} from '../relationships/parent-child-relationship.types.js';
import { GedcomAnalysisDiagnosticDtoSchema } from './gedcom-analysis.schema.js';
import { SupportedGedcomVersionSchema } from './gedcom-file.schema.js';
import { GedcomImportDraftStatus } from './gedcom-import-persistence.types.js';
import { GedcomMappingIssueKind } from './gedcom-import-plan.types.js';

const GedcomFileSchema = Type.Unsafe<Uint8Array>({ type: 'object' });

export const CreateGedcomImportDraftBodyDtoSchema = Type.Union([
    Type.Object(
        {
            file: GedcomFileSchema,
            sourceId: Type.String({ format: 'uuid' }),
        },
        { additionalProperties: false },
    ),
    Type.Object(
        {
            file: GedcomFileSchema,
            sourceName: Type.String({ minLength: 1, maxLength: 255 }),
        },
        { additionalProperties: false },
    ),
]);

export type CreateGedcomImportDraftBodyDto = Type.Static<
    typeof CreateGedcomImportDraftBodyDtoSchema
>;

export const GedcomImportDraftIdParamsDtoSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
    },
    { additionalProperties: false },
);

export type GedcomImportDraftIdParamsDto = Type.Static<typeof GedcomImportDraftIdParamsDtoSchema>;

const GedcomImportDraftStatusSchema = Type.Union([
    Type.Literal(GedcomImportDraftStatus.Blocked),
    Type.Literal(GedcomImportDraftStatus.NeedsResolution),
    Type.Literal(GedcomImportDraftStatus.Ready),
]);

const ProvenanceSchema = Type.Object(
    {
        gedcomId: Type.Union([Type.String(), Type.Null()]),
        path: Type.String(),
    },
    { additionalProperties: false },
);

const IdentifierSchema = Type.Object(
    {
        type: Type.String(),
        value: Type.String(),
    },
    { additionalProperties: false },
);

const GenderSchema = Type.Union([
    Type.Literal(Gender.Male),
    Type.Literal(Gender.Female),
    Type.Literal(Gender.NonBinary),
    Type.Literal(Gender.Unspecified),
]);

const LivingStatusSchema = Type.Union([
    Type.Literal(LivingStatus.Unknown),
    Type.Literal(LivingStatus.Living),
    Type.Literal(LivingStatus.Deceased),
]);

const PlannedPersonSchema = Type.Object(
    {
        key: Type.String({ minLength: 1 }),
        provenance: ProvenanceSchema,
        identifiers: Type.Array(IdentifierSchema),
        data: Type.Object(
            {
                firstName: Type.Union([Type.String(), Type.Null()]),
                middleNames: Type.Null(),
                lastName: Type.Union([Type.String(), Type.Null()]),
                birthName: Type.Union([Type.String(), Type.Null()]),
                gender: GenderSchema,
                birthDate: Type.Union([GenealogicalDateSchema, Type.Null()]),
                birthPlace: Type.Union([Type.String(), Type.Null()]),
                deathDate: Type.Union([GenealogicalDateSchema, Type.Null()]),
                deathPlace: Type.Union([Type.String(), Type.Null()]),
                livingStatus: LivingStatusSchema,
                biography: Type.Null(),
            },
            { additionalProperties: false },
        ),
    },
    { additionalProperties: false },
);

const ParentChildRelationshipTypeSchema = Type.Union([
    Type.Literal(ParentChildRelationshipType.Biological),
    Type.Literal(ParentChildRelationshipType.Adoptive),
    Type.Literal(ParentChildRelationshipType.Step),
    Type.Literal(ParentChildRelationshipType.Foster),
    Type.Literal(ParentChildRelationshipType.Other),
    Type.Literal(ParentChildRelationshipType.Unspecified),
]);

const ParentChildEvidenceStatusSchema = Type.Union([
    Type.Literal(ParentChildRelationshipEvidenceStatus.Unassessed),
    Type.Literal(ParentChildRelationshipEvidenceStatus.Proven),
    Type.Literal(ParentChildRelationshipEvidenceStatus.Challenged),
]);

const PlannedParentChildRelationshipSchema = Type.Object(
    {
        key: Type.String({ minLength: 1 }),
        provenance: ProvenanceSchema,
        data: Type.Object(
            {
                parentKey: Type.String({ minLength: 1 }),
                childKey: Type.String({ minLength: 1 }),
                relationshipType: ParentChildRelationshipTypeSchema,
                evidenceStatus: ParentChildEvidenceStatusSchema,
            },
            { additionalProperties: false },
        ),
    },
    { additionalProperties: false },
);

const PlannedCoupleRelationshipSchema = Type.Object(
    {
        key: Type.String({ minLength: 1 }),
        provenance: ProvenanceSchema,
        data: Type.Object(
            {
                partner1Key: Type.String({ minLength: 1 }),
                partner2Key: Type.String({ minLength: 1 }),
            },
            { additionalProperties: false },
        ),
    },
    { additionalProperties: false },
);

const CoupleRelationshipEventTypeSchema = Type.Union([
    Type.Literal(CoupleRelationshipEventType.Engagement),
    Type.Literal(CoupleRelationshipEventType.Marriage),
    Type.Literal(CoupleRelationshipEventType.CivilUnion),
    Type.Literal(CoupleRelationshipEventType.Separation),
    Type.Literal(CoupleRelationshipEventType.Divorce),
    Type.Literal(CoupleRelationshipEventType.Annulment),
    Type.Literal(CoupleRelationshipEventType.Other),
]);

const PlannedCoupleRelationshipEventSchema = Type.Object(
    {
        key: Type.String({ minLength: 1 }),
        provenance: ProvenanceSchema,
        data: Type.Object(
            {
                coupleRelationshipKey: Type.String({ minLength: 1 }),
                eventType: CoupleRelationshipEventTypeSchema,
                date: Type.Union([GenealogicalDateSchema, Type.Null()]),
                place: Type.Union([Type.String(), Type.Null()]),
                description: Type.Union([Type.String(), Type.Null()]),
            },
            { additionalProperties: false },
        ),
    },
    { additionalProperties: false },
);

const GedcomMappingIssueSchema = Type.Object(
    {
        kind: Type.Union([
            Type.Literal(GedcomMappingIssueKind.Ignored),
            Type.Literal(GedcomMappingIssueKind.Ambiguous),
            Type.Literal(GedcomMappingIssueKind.Invalid),
        ]),
        code: Type.String({ minLength: 1 }),
        message: Type.String({ minLength: 1 }),
        provenance: ProvenanceSchema,
        count: Type.Integer({ minimum: 1 }),
    },
    { additionalProperties: false },
);

const GedcomImportPlanSchema = Type.Object(
    {
        people: Type.Array(PlannedPersonSchema),
        parentChildRelationships: Type.Array(PlannedParentChildRelationshipSchema),
        coupleRelationships: Type.Array(PlannedCoupleRelationshipSchema),
        coupleRelationshipEvents: Type.Array(PlannedCoupleRelationshipEventSchema),
        issues: Type.Array(GedcomMappingIssueSchema),
    },
    { additionalProperties: false },
);

const StoredDataSchema = Type.Record(Type.String({ minLength: 1 }), Type.Unknown());

export const GedcomImportDraftResponseDtoSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
        sourceId: Type.String({ format: 'uuid' }),
        status: GedcomImportDraftStatusSchema,
        fileSha256: Type.String({ minLength: 64, maxLength: 64 }),
        gedcomVersion: SupportedGedcomVersionSchema,
        plan: GedcomImportPlanSchema,
        resolutions: StoredDataSchema,
        baseVersions: StoredDataSchema,
        revision: Type.Integer({ minimum: 0 }),
        expiresAt: Type.String({ format: 'date-time' }),
        createdAt: Type.String({ format: 'date-time' }),
        updatedAt: Type.String({ format: 'date-time' }),
    },
    { additionalProperties: false },
);

export type GedcomImportDraftResponseDto = Type.Static<typeof GedcomImportDraftResponseDtoSchema>;

export const UpdateGedcomImportDraftResolutionsBodyDtoSchema = Type.Object(
    {
        revision: Type.Integer({ minimum: 0 }),
        resolutions: StoredDataSchema,
    },
    { additionalProperties: false },
);

export type UpdateGedcomImportDraftResolutionsBodyDto = Type.Static<
    typeof UpdateGedcomImportDraftResolutionsBodyDtoSchema
>;

export const AlreadyImportedGedcomResponseDtoSchema = Type.Object(
    {
        status: Type.Literal('already_imported'),
        runId: Type.String({ format: 'uuid' }),
        sourceId: Type.String({ format: 'uuid' }),
        report: StoredDataSchema,
        createdAt: Type.String({ format: 'date-time' }),
    },
    { additionalProperties: false },
);

export type AlreadyImportedGedcomResponseDto = Type.Static<
    typeof AlreadyImportedGedcomResponseDtoSchema
>;

export const InvalidGedcomDraftProblemDtoSchema = Type.Object(
    {
        type: Type.Literal('about:blank'),
        title: Type.Literal('Bad Request'),
        status: Type.Literal(400),
        detail: Type.String({ minLength: 1 }),
        requestId: Type.String({ minLength: 1 }),
        diagnostics: Type.Optional(Type.Array(GedcomAnalysisDiagnosticDtoSchema)),
    },
    { additionalProperties: false },
);

export type InvalidGedcomDraftProblemDto = Type.Static<typeof InvalidGedcomDraftProblemDtoSchema>;
