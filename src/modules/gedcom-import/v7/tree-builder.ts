import {
    GedcomDiagnosticCode,
    GedcomDiagnosticSeverity,
    type GedcomDiagnostic,
    type GedcomNode,
} from '../common/gedcom-parser.types.js';
import { splitGedcomLines } from '../common/gedcom-text-utils.js';
import { parseGedcom7Line } from './line-parser.js';

export type Gedcom7TreeBuildResult = {
    roots: GedcomNode[];
    diagnostics: GedcomDiagnostic[];
};

function error(code: GedcomDiagnosticCode, message: string, line: number): GedcomDiagnostic {
    return {
        severity: GedcomDiagnosticSeverity.Error,
        code,
        message,
        location: { line, column: 1 },
        recordId: null,
        path: null,
    };
}

export function buildGedcom7Tree(content: string): Gedcom7TreeBuildResult {
    const roots: GedcomNode[] = [];
    const stack: GedcomNode[] = [];
    const diagnostics: GedcomDiagnostic[] = [];
    let previousNode: GedcomNode | null = null;
    let continuationOpen = false;
    const lines = splitGedcomLines(content);

    for (let index = 0; index < lines.length; index += 1) {
        const lineNumber = index + 1;
        const line = lines[index] ?? '';

        if (line.length === 0) {
            diagnostics.push(
                error(
                    GedcomDiagnosticCode.InvalidLine,
                    'Empty lines are not permitted.',
                    lineNumber,
                ),
            );
            continuationOpen = false;
            continue;
        }

        const result = parseGedcom7Line(line, lineNumber);

        if (!result.success) {
            diagnostics.push(error(GedcomDiagnosticCode.InvalidLine, result.message, lineNumber));
            continuationOpen = false;
            continue;
        }

        const node = result.node;

        if (node.tag === 'CONC') {
            diagnostics.push(
                error(
                    GedcomDiagnosticCode.UnsupportedStructure,
                    'CONC is reserved and not permitted in GEDCOM 7.',
                    lineNumber,
                ),
            );
            continuationOpen = false;
            continue;
        }

        if (node.tag === 'CONT') {
            if (
                previousNode === null ||
                node.level !== previousNode.level + 1 ||
                (!continuationOpen && previousNode.children.length > 0)
            ) {
                diagnostics.push(
                    error(
                        GedcomDiagnosticCode.InvalidHierarchy,
                        'CONT must immediately follow the payload it continues.',
                        lineNumber,
                    ),
                );
                continue;
            }

            previousNode.value = `${previousNode.value ?? ''}\n${node.value ?? ''}`;
            continuationOpen = true;
            continue;
        }

        continuationOpen = false;

        if (node.level === 0) {
            roots.push(node);
            stack.length = 0;
            stack[0] = node;
            previousNode = node;
            continue;
        }

        if (node.xref !== null) {
            diagnostics.push(
                error(
                    GedcomDiagnosticCode.InvalidLine,
                    'A GEDCOM 7 substructure must not have a cross-reference identifier.',
                    lineNumber,
                ),
            );
        }

        const parent = stack[node.level - 1];

        if (parent === undefined) {
            diagnostics.push(
                error(
                    GedcomDiagnosticCode.InvalidHierarchy,
                    `Level ${node.level} has no parent at level ${node.level - 1}.`,
                    lineNumber,
                ),
            );
            previousNode = node;
            continue;
        }

        parent.children.push(node);
        stack.length = node.level;
        stack[node.level] = node;
        previousNode = node;
    }

    return { roots, diagnostics };
}
