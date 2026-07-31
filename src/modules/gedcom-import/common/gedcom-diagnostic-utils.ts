import {
    GedcomDiagnosticCode,
    GedcomDiagnosticSeverity,
    type GedcomDiagnostic,
    type GedcomNode,
} from './gedcom-parser.types.js';
import { childNodes } from './gedcom-node-utils.js';

export type GedcomDiagnosticContext = {
    diagnostics: GedcomDiagnostic[];
};

export function makeGedcomDiagnostic(
    severity: GedcomDiagnostic['severity'],
    code: GedcomDiagnostic['code'],
    message: string,
    node: GedcomNode | null,
    recordId: string | null = null,
    path: string | null = null,
): GedcomDiagnostic {
    return {
        severity,
        code,
        message,
        location: node?.location ?? null,
        recordId,
        path,
    };
}

export function addGedcomError(
    context: GedcomDiagnosticContext,
    code: GedcomDiagnostic['code'],
    message: string,
    node: GedcomNode | null,
    recordId: string | null = null,
    path: string | null = null,
): void {
    context.diagnostics.push(
        makeGedcomDiagnostic(GedcomDiagnosticSeverity.Error, code, message, node, recordId, path),
    );
}

export function addGedcomWarning(
    context: GedcomDiagnosticContext,
    code: GedcomDiagnostic['code'],
    message: string,
    node: GedcomNode | null,
    recordId: string | null = null,
    path: string | null = null,
): void {
    context.diagnostics.push(
        makeGedcomDiagnostic(GedcomDiagnosticSeverity.Warning, code, message, node, recordId, path),
    );
}

export function validateMaximumCardinality(
    node: GedcomNode,
    tag: string,
    maximum: number,
    context: GedcomDiagnosticContext,
    recordId: string | null,
): void {
    const matches = childNodes(node, tag);

    if (matches.length > maximum) {
        addGedcomError(
            context,
            GedcomDiagnosticCode.InvalidCardinality,
            `${tag} occurs ${matches.length} times but permits at most ${maximum}.`,
            matches[maximum] ?? node,
            recordId,
            tag,
        );
    }
}

export function hasGedcomErrors(diagnostics: readonly GedcomDiagnostic[]): boolean {
    return diagnostics.some((item) => item.severity === GedcomDiagnosticSeverity.Error);
}
