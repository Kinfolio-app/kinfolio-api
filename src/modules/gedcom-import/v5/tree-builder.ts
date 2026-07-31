import { parseGedcomLine } from './line-parser.js';
import { splitGedcomLines } from '../common/gedcom-text-utils.js';
import {
    GedcomDiagnosticCode,
    GedcomDiagnosticSeverity,
    type GedcomDiagnostic,
    type GedcomNode,
} from '../common/gedcom-parser.types.js';

export type GedcomTreeBuildResult = {
    roots: GedcomNode[];
    diagnostics: GedcomDiagnostic[];
};

function diagnostic(
    code: GedcomDiagnosticCode,
    message: string,
    node: GedcomNode | null,
    line: number | null = null,
): GedcomDiagnostic {
    return {
        severity: GedcomDiagnosticSeverity.Error,
        code,
        message,
        location: node?.location ?? (line === null ? null : { line, column: 1 }),
        recordId: null,
        path: null,
    };
}

export function buildGedcomTree(content: string): GedcomTreeBuildResult {
    const lines = splitGedcomLines(content);
    const roots: GedcomNode[] = [];
    const stack: GedcomNode[] = [];
    const diagnostics: GedcomDiagnostic[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const lineNumber = index + 1;
        const lineContent = lines[index] ?? '';

        if (lineContent.length === 0) {
            diagnostics.push(
                diagnostic(
                    GedcomDiagnosticCode.InvalidLine,
                    'Empty lines are not permitted in a GEDCOM data stream.',
                    null,
                    lineNumber,
                ),
            );
            continue;
        }

        const result = parseGedcomLine(lineContent, lineNumber);

        if (!result.success) {
            diagnostics.push({
                severity: GedcomDiagnosticSeverity.Error,
                code: GedcomDiagnosticCode.InvalidLine,
                message: result.message,
                location: result.location,
                recordId: null,
                path: null,
            });
            continue;
        }

        const node = result.node;

        if (node.level === 0) {
            roots.push(node);
            stack.length = 0;
            stack[0] = node;
            continue;
        }

        const parent = stack[node.level - 1];

        if (parent === undefined) {
            diagnostics.push(
                diagnostic(
                    GedcomDiagnosticCode.InvalidHierarchy,
                    `Level ${node.level} has no parent at level ${node.level - 1}.`,
                    node,
                ),
            );
            continue;
        }

        parent.children.push(node);
        stack.length = node.level;
        stack[node.level] = node;
    }

    return { roots, diagnostics };
}
