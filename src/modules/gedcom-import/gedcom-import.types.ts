import type { GedcomSourceLocation } from './common/gedcom-parser.types.js';

export type GedcomImportSummary = {
    individuals: number;
    families: number;
    events: number;
    sources: number;
    repositories: number;
    media: number;
    notes: number;
};

export type GedcomImportIssue = {
    kind: 'extension';
    tag: string;
    uri: string | null;
    reason: string;
    path: string;
    location: GedcomSourceLocation;
};
