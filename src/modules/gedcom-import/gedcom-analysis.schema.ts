import Type from 'typebox';
import { GedcomDiagnosticSeverity } from './common/gedcom-parser.types.js';

const GedcomDiagnosticSeveritySchema = Type.Union([
    Type.Literal(GedcomDiagnosticSeverity.Error),
    Type.Literal(GedcomDiagnosticSeverity.Warning),
    Type.Literal(GedcomDiagnosticSeverity.Information),
]);

const GedcomLocationDtoSchema = Type.Object(
    {
        line: Type.Integer({ minimum: 1 }),
        column: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    },
    {
        additionalProperties: false,
    },
);

export const GedcomAnalysisDiagnosticDtoSchema = Type.Object(
    {
        severity: GedcomDiagnosticSeveritySchema,
        code: Type.String({ minLength: 1 }),
        message: Type.String({ minLength: 1 }),
        location: Type.Union([GedcomLocationDtoSchema, Type.Null()]),
        recordId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
        path: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    },
    {
        additionalProperties: false,
    },
);

export type GedcomAnalysisDiagnosticDto = Type.Static<typeof GedcomAnalysisDiagnosticDtoSchema>;

export const GedcomAnalysisBodyDtoSchema = Type.Object(
    {
        file: Type.Unsafe<Uint8Array>({ type: 'object' }),
    },
    {
        additionalProperties: false,
    },
);

export type GedcomAnalysisBodyDto = Type.Static<typeof GedcomAnalysisBodyDtoSchema>;

export const GedcomImportIssueDtoSchema = Type.Object(
    {
        kind: Type.Literal('extension'),
        tag: Type.String({ minLength: 1 }),
        uri: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
        reason: Type.String({ minLength: 1 }),
        path: Type.String({ minLength: 1 }),
        location: GedcomLocationDtoSchema,
    },
    {
        additionalProperties: false,
    },
);

export type GedcomImportIssueDto = Type.Static<typeof GedcomImportIssueDtoSchema>;

export const GedcomAnalysisResponseDtoSchema = Type.Object(
    {
        version: Type.Union([Type.String(), Type.Null()]),
        valid: Type.Boolean(),
        summary: Type.Object({
            individuals: Type.Integer({ minimum: 0 }),
            families: Type.Integer({ minimum: 0 }),
            events: Type.Integer({ minimum: 0 }),
            sources: Type.Integer({ minimum: 0 }),
            repositories: Type.Integer({ minimum: 0 }),
            media: Type.Integer({ minimum: 0 }),
            notes: Type.Integer({ minimum: 0 }),
        }),
        ignored: Type.Array(GedcomImportIssueDtoSchema),
        ambiguous: Type.Array(GedcomImportIssueDtoSchema),
        diagnostics: Type.Array(GedcomAnalysisDiagnosticDtoSchema),
    },
    {
        additionalProperties: false,
    },
);

export type GedcomAnalysisResponseDto = Type.Static<typeof GedcomAnalysisResponseDtoSchema>;
