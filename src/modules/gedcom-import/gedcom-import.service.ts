import type {
    GedcomParseResult,
    NormalizedExtension,
    NormalizedGedcomDocument,
} from './common/gedcom-parser.types.js';
import { collectGedcomExtensions } from './gedcom-extension-collector.js';
import type { GedcomFileDetector } from './gedcom-file-detector.js';
import type { GedcomDetectionDiagnostic, SupportedGedcomVersion } from './gedcom-file.types.js';
import type { GedcomImportIssue, GedcomImportSummary } from './gedcom-import.types.js';
import type { GedcomParserSelector } from './gedcom-parser-selector.js';

export const GedcomImportAnalysisStatus = {
    DetectionFailed: 'detection_failed',
    Parsed: 'parsed',
} as const;

export type GedcomImportAnalysisResult =
    | {
          status: typeof GedcomImportAnalysisStatus.DetectionFailed;
          diagnostics: GedcomDetectionDiagnostic[];
          summary: GedcomImportSummary;
      }
    | {
          status: typeof GedcomImportAnalysisStatus.Parsed;
          version: SupportedGedcomVersion;
          parseResult: GedcomParseResult;
          summary: GedcomImportSummary;
          ignored: GedcomImportIssue[];
          ambiguous: GedcomImportIssue[];
      };

type GedcomExtensionClassification = {
    ignored: GedcomImportIssue[];
    ambiguous: GedcomImportIssue[];
};

function summarizeDocument(document: NormalizedGedcomDocument | null): GedcomImportSummary {
    if (document === null) {
        return {
            individuals: 0,
            families: 0,
            events: 0,
            media: 0,
            notes: 0,
            repositories: 0,
            sources: 0,
        };
    }

    const individualEvents = document.individuals.reduce(
        (total, individual) => total + individual.events.length,
        0,
    );

    const familyEvents = document.families.reduce(
        (total, family) => total + family.events.length,
        0,
    );

    return {
        individuals: document.individuals.length,
        families: document.families.length,
        events: individualEvents + familyEvents,
        sources: document.sources.length,
        repositories: document.repositories.length,
        media: document.media.length,
        notes: document.sharedNotes.length,
    };
}

function classifyGedcomExtensions(
    extensions: NormalizedExtension[],
): GedcomExtensionClassification {
    const ignored: GedcomImportIssue[] = [];
    const ambiguous: GedcomImportIssue[] = [];

    for (const extension of extensions) {
        const isAmbiguous = extension.uri === null;

        const issue: GedcomImportIssue = {
            kind: 'extension',
            tag: extension.tag,
            uri: extension.uri,
            path: extension.path,
            location: extension.location,
            reason: isAmbiguous
                ? 'The extension could not be identified uniquely.'
                : 'The extension is identified but is not supported by Genealaine.',
        };

        if (isAmbiguous) {
            ambiguous.push(issue);
        } else {
            ignored.push(issue);
        }
    }

    return { ambiguous, ignored };
}

export class GedcomImportService {
    constructor(
        private readonly fileDetector: GedcomFileDetector,
        private readonly parserService: GedcomParserSelector,
    ) {}

    analyze(file: Uint8Array): GedcomImportAnalysisResult {
        const detectedFile = this.fileDetector.detect(file);

        if (!detectedFile.success) {
            return {
                status: GedcomImportAnalysisStatus.DetectionFailed,
                diagnostics: detectedFile.diagnostics,
                summary: summarizeDocument(null),
            };
        }

        const parseResult = this.parserService.parse(detectedFile.file);

        const extensions =
            parseResult.document === null ? [] : collectGedcomExtensions(parseResult.document);

        const classification = classifyGedcomExtensions(extensions);

        return {
            status: GedcomImportAnalysisStatus.Parsed,
            version: detectedFile.file.descriptor.version,
            parseResult,
            summary: summarizeDocument(parseResult.document),
            ambiguous: classification.ambiguous,
            ignored: classification.ignored,
        };
    }
}
