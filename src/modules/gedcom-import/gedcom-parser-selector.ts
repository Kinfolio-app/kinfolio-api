import {
    GedcomDiagnosticCode,
    GedcomDiagnosticSeverity,
    type GedcomParseResult,
    type GedcomParser,
} from './common/gedcom-parser.types.js';
import type { DetectedGedcomFile, SupportedGedcomVersion } from './gedcom-file.types.js';
import { Gedcom551Parser } from './v5/parser.js';
import { Gedcom7Parser } from './v7/parser.js';

export class GedcomParserSelector {
    private readonly parsers: readonly GedcomParser[];

    constructor(parsers: readonly GedcomParser[] = [new Gedcom551Parser(), new Gedcom7Parser()]) {
        this.parsers = parsers;
    }

    select(version: SupportedGedcomVersion): GedcomParser | null {
        return this.parsers.find((parser) => parser.supports(version)) ?? null;
    }

    parse(file: DetectedGedcomFile): GedcomParseResult {
        const parser = this.select(file.descriptor.version);

        if (parser !== null) {
            return parser.parse(file);
        }

        return {
            document: null,
            diagnostics: [
                {
                    severity: GedcomDiagnosticSeverity.Error,
                    code: GedcomDiagnosticCode.UnsupportedParserVersion,
                    message: `No parser supports GEDCOM version ${file.descriptor.version}.`,
                    location: null,
                    recordId: null,
                    path: null,
                },
            ],
        };
    }
}
