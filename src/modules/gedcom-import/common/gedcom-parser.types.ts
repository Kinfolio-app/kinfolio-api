import type { DetectedGedcomFile, SupportedGedcomVersion } from '../gedcom-file.types.js';

export type GedcomSourceLocation = {
    line: number;
    column: number;
};

export type GedcomNode = {
    level: number;
    tag: string;
    xref: string | null;
    value: string | null;
    children: GedcomNode[];
    location: GedcomSourceLocation;
};

export const GedcomDiagnosticSeverity = {
    Error: 'error',
    Warning: 'warning',
    Information: 'information',
} as const;

export type GedcomDiagnosticSeverity =
    (typeof GedcomDiagnosticSeverity)[keyof typeof GedcomDiagnosticSeverity];

export const GedcomDiagnosticCode = {
    UnsupportedParserVersion: 'unsupported_parser_version',
    InvalidLine: 'invalid_line',
    InvalidLevel: 'invalid_level',
    InvalidHierarchy: 'invalid_hierarchy',
    InvalidCardinality: 'invalid_cardinality',
    MissingHeader: 'missing_header',
    InvalidHeader: 'invalid_header',
    MissingTrailer: 'missing_trailer',
    InvalidTrailer: 'invalid_trailer',
    RecordAfterTrailer: 'record_after_trailer',
    MissingRecordIdentifier: 'missing_record_identifier',
    DuplicateRecordIdentifier: 'duplicate_record_identifier',
    InvalidPointer: 'invalid_pointer',
    MissingReference: 'missing_reference',
    ReferenceTypeMismatch: 'reference_type_mismatch',
    InconsistentFamilyLink: 'inconsistent_family_link',
    InvalidDate: 'invalid_date',
    UnknownValue: 'unknown_value',
    UnsupportedStructure: 'unsupported_structure',
} as const;

export type GedcomDiagnosticCode = (typeof GedcomDiagnosticCode)[keyof typeof GedcomDiagnosticCode];

export type GedcomDiagnostic = {
    severity: GedcomDiagnosticSeverity;
    code: GedcomDiagnosticCode;
    message: string;
    location: GedcomSourceLocation | null;
    recordId: string | null;
    path: string | null;
};

export type GenealogicalCalendar =
    'gregorian' | 'julian' | 'french_republican' | 'hebrew' | 'extension';

export type GenealogicalDatePoint = {
    calendar: GenealogicalCalendar;
    calendarTag?: string | null;
    year: number;
    month: number | null;
    monthTag?: string | null;
    day: number | null;
    epoch: 'common' | 'before_common';
    epochTag?: string | null;
};

type GenealogicalSinglePointDate = {
    kind: 'exact' | 'about' | 'calculated' | 'estimated' | 'interpreted' | 'before' | 'after';
    first: GenealogicalDatePoint;
    second: null;
    phrase: string | null;
    originalText: string;
};

type GenealogicalBetweenDate = {
    kind: 'between';
    first: GenealogicalDatePoint;
    second: GenealogicalDatePoint;
    phrase: string | null;
    originalText: string;
};

type GenealogicalPeriodDate = {
    kind: 'period';
    first: GenealogicalDatePoint | null;
    second: GenealogicalDatePoint | null;
    phrase: string | null;
    originalText: string;
};

type GenealogicalPhraseDate = {
    kind: 'phrase';
    first: null;
    second: null;
    phrase: string;
    originalText: string;
};

export type GenealogicalDate =
    | GenealogicalSinglePointDate
    | GenealogicalBetweenDate
    | GenealogicalPeriodDate
    | GenealogicalPhraseDate;

export type NormalizedExtension = {
    tag: string;
    uri: string | null;
    value: string | null;
    path: string;
    location: GedcomSourceLocation;
    children: NormalizedExtension[];
};

export type NormalizedSourceCitation = {
    sourceId: string | null;
    page: string | null;
    data: string | null;
    quality: string | null;
    extensions: NormalizedExtension[];
};

export type NormalizedNote = {
    id: string | null;
    text: string;
    language: string | null;
    mediaType: string | null;
    extensions: NormalizedExtension[];
};

export type NormalizedNoteReference = {
    noteId: string | null;
    inlineNote: NormalizedNote | null;
};

export type NormalizedMediaFile = {
    path: string;
    mediaType: string | null;
    title: string | null;
    extensions: NormalizedExtension[];
};

export type NormalizedMedia = {
    id: string | null;
    files: NormalizedMediaFile[];
    title: string | null;
    extensions: NormalizedExtension[];
};

export type NormalizedMediaReference = {
    mediaId: string | null;
    inlineMedia: NormalizedMedia | null;
};

export type NormalizedPlace = {
    value: string;
    format: string[] | null;
    latitude: string | null;
    longitude: string | null;
    language: string | null;
    extensions: NormalizedExtension[];
};

export type NormalizedEvent = {
    tag: string;
    type: string | null;
    value: string | null;
    date: GenealogicalDate | null;
    place: NormalizedPlace | null;
    description: string | null;
    sourceCitations: NormalizedSourceCitation[];
    noteReferences: NormalizedNoteReference[];
    mediaReferences: NormalizedMediaReference[];
    extensions: NormalizedExtension[];
};

export type NormalizedAttribute = Omit<NormalizedEvent, 'description' | 'mediaReferences'>;

export type NormalizedName = {
    value: string;
    type: string | null;
    givenNames: string | null;
    surname: string | null;
    surnamePrefix: string | null;
    prefix: string | null;
    suffix: string | null;
    nickname: string | null;
    isPrimary: boolean;
    extensions: NormalizedExtension[];
};

export type NormalizedSex = {
    value: 'male' | 'female' | 'other' | 'unknown';
    originalValue: string;
};

export type NormalizedParentFamilyLink = {
    familyId: string;
    pedigree: string | null;
    status: string | null;
    extensions: NormalizedExtension[];
};

export type NormalizedIdentifier = {
    type: string;
    value: string;
};

export type NormalizedIndividual = {
    id: string | null;
    names: NormalizedName[];
    sex: NormalizedSex | null;
    events: NormalizedEvent[];
    attributes: NormalizedAttribute[];
    parentFamilyLinks: NormalizedParentFamilyLink[];
    partnerFamilyIds: string[];
    sourceCitations: NormalizedSourceCitation[];
    noteReferences: NormalizedNoteReference[];
    mediaReferences: NormalizedMediaReference[];
    identifiers: NormalizedIdentifier[];
    extensions: NormalizedExtension[];
};

export type NormalizedFamilyPartner = {
    individualId: string;
    sourceRole: 'husband' | 'wife' | 'partner';
};

export type NormalizedFamilyChild = {
    individualId: string;
    pedigree: string | null;
    status: string | null;
};

export type NormalizedFamily = {
    id: string | null;
    partners: NormalizedFamilyPartner[];
    children: NormalizedFamilyChild[];
    events: NormalizedEvent[];
    sourceCitations: NormalizedSourceCitation[];
    noteReferences: NormalizedNoteReference[];
    mediaReferences: NormalizedMediaReference[];
    extensions: NormalizedExtension[];
};

export type NormalizedRepositoryReference = {
    repositoryId: string;
    callNumber: string | null;
};

export type NormalizedSource = {
    id: string | null;
    title: string | null;
    author: string | null;
    publication: string | null;
    repositoryReferences: NormalizedRepositoryReference[];
    noteReferences: NormalizedNoteReference[];
    mediaReferences: NormalizedMediaReference[];
    extensions: NormalizedExtension[];
};

export type NormalizedRepository = {
    id: string | null;
    name: string | null;
    address: string | null;
    extensions: NormalizedExtension[];
};

export type GedcomMetadata = {
    version: SupportedGedcomVersion;
    sourceProduct: string | null;
    sourceProductVersion: string | null;
    characterEncoding: string;
    language: string | null;
    fileName: string | null;
};

export type NormalizedGedcomDocument = {
    metadata: GedcomMetadata;
    individuals: NormalizedIndividual[];
    families: NormalizedFamily[];
    sources: NormalizedSource[];
    repositories: NormalizedRepository[];
    media: NormalizedMedia[];
    sharedNotes: NormalizedNote[];
    extensions: NormalizedExtension[];
};

export type GedcomParseResult = {
    document: NormalizedGedcomDocument | null;
    diagnostics: GedcomDiagnostic[];
};

export interface GedcomParser {
    supports(version: SupportedGedcomVersion): boolean;
    parse(file: DetectedGedcomFile): GedcomParseResult;
}
