import {
    GedcomImportAnalysisStatus,
    type GedcomImportAnalysisResult,
} from './gedcom-import.service.js';
import type { GedcomImportIssue } from './gedcom-import.types.js';
import type { GedcomAnalysisResponseDto, GedcomImportIssueDto } from './gedcom-analysis.schema.js';

function toGedcomImportIssueDto(issue: GedcomImportIssue): GedcomImportIssueDto {
    return {
        kind: issue.kind,
        tag: issue.tag,
        path: issue.path,
        reason: issue.reason,
        location: issue.location,
        uri: issue.uri,
    };
}

export function toGedcomAnalysisResponseDto(
    result: GedcomImportAnalysisResult,
): GedcomAnalysisResponseDto {
    if (result.status === GedcomImportAnalysisStatus.DetectionFailed) {
        return {
            version: null,
            valid: false,
            summary: result.summary,
            ambiguous: [],
            ignored: [],
            diagnostics: result.diagnostics.map((diagnostic) => ({
                severity: diagnostic.severity,
                code: diagnostic.code,
                message: diagnostic.message,
                location:
                    diagnostic.line === null
                        ? null
                        : {
                              line: diagnostic.line,
                              column: null,
                          },
                recordId: null,
                path: null,
            })),
        };
    }

    const document = result.parseResult.document;

    return {
        version: result.version,
        valid: !!document,
        summary: result.summary,
        ambiguous: result.ambiguous.map((value) => toGedcomImportIssueDto(value)),
        ignored: result.ignored.map((value) => toGedcomImportIssueDto(value)),
        diagnostics: result.parseResult.diagnostics,
    };
}
