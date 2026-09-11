export const GEDCOM_551_VERSION = '5.5.1';
export const GEDCOM_7_BASE_VERSION = '7.0';

// Matches a canonical GEDCOM 7 patch version such as 7.0.18; it has no capture groups.
export const GEDCOM_7_PATCH_VERSION_PATTERN = '^7\\.0\\.(?:0|[1-9]\\d*)$';
const GEDCOM_7_PATCH_VERSION_REGEX = new RegExp(GEDCOM_7_PATCH_VERSION_PATTERN);

export type SupportedGedcomVersion =
    typeof GEDCOM_551_VERSION | typeof GEDCOM_7_BASE_VERSION | `7.0.${number}`;

export function parseSupportedGedcomVersion(value: string): SupportedGedcomVersion | null {
    if (value === GEDCOM_551_VERSION || value === GEDCOM_7_BASE_VERSION) {
        return value;
    }

    return GEDCOM_7_PATCH_VERSION_REGEX.test(value) ? (value as SupportedGedcomVersion) : null;
}

export type GedcomFileDescriptor = {
    container: 'gedcom';
    version: SupportedGedcomVersion;
    characterEncoding: 'utf-8';
    hasByteOrderMark: boolean;
};

export const GedcomDetectionDiagnosticCode = {
    UnsupportedContainer: 'unsupported_container',
    MissingHeader: 'missing_header',
    InvalidHeader: 'invalid_header',
    MissingGedcomVersion: 'missing_gedcom_version',
    UnsupportedGedcomVersion: 'unsupported_gedcom_version',
    MissingCharacterEncoding: 'missing_character_encoding',
    UnsupportedCharacterEncoding: 'unsupported_character_encoding',
    InvalidUtf8: 'invalid_utf8',
    HeaderLimitExceeded: 'header_limit_exceeded',
    VersionEncodingMismatch: 'version_encoding_mismatch',
} as const;

export type GedcomDetectionDiagnosticCode =
    (typeof GedcomDetectionDiagnosticCode)[keyof typeof GedcomDetectionDiagnosticCode];

export type GedcomDetectionDiagnostic = {
    severity: 'error';
    code: GedcomDetectionDiagnosticCode;
    message: string;
    line: number | null;
};

export type DetectedGedcomFile = {
    descriptor: GedcomFileDescriptor;
    content: string;
};

export type GedcomDetectionResult =
    | {
          success: true;
          file: DetectedGedcomFile;
      }
    | {
          success: false;
          diagnostics: GedcomDetectionDiagnostic[];
      };
