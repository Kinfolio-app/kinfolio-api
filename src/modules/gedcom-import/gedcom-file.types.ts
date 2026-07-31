export type SupportedGedcomVersion = '5.5.1' | '7.0' | `7.0.${number}`;

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
