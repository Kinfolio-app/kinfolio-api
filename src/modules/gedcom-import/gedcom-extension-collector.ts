import type {
    NormalizedAttribute,
    NormalizedEvent,
    NormalizedExtension,
    NormalizedFamily,
    NormalizedGedcomDocument,
    NormalizedIndividual,
    NormalizedMedia,
    NormalizedMediaReference,
    NormalizedNoteReference,
    NormalizedSource,
    NormalizedSourceCitation,
} from './common/gedcom-parser.types.js';

function collectSourceCitationExtensions(
    citation: NormalizedSourceCitation,
): NormalizedExtension[] {
    return citation.extensions;
}

function collectNoteReferenceExtensions(reference: NormalizedNoteReference): NormalizedExtension[] {
    return reference.inlineNote?.extensions ?? [];
}

function collectMediaExtensions(media: NormalizedMedia): NormalizedExtension[] {
    return [...media.extensions, ...media.files.flatMap((file) => file.extensions)];
}

function collectMediaReferenceExtensions(
    reference: NormalizedMediaReference,
): NormalizedExtension[] {
    return reference.inlineMedia === null ? [] : collectMediaExtensions(reference.inlineMedia);
}

function collectEventBaseExtensions(
    event: NormalizedEvent | NormalizedAttribute,
): NormalizedExtension[] {
    return [
        ...event.extensions,
        ...(event.place?.extensions ?? []),
        ...event.sourceCitations.flatMap(collectSourceCitationExtensions),
        ...event.noteReferences.flatMap(collectNoteReferenceExtensions),
    ];
}

function collectEventExtensions(event: NormalizedEvent): NormalizedExtension[] {
    return [
        ...collectEventBaseExtensions(event),
        ...event.mediaReferences.flatMap(collectMediaReferenceExtensions),
    ];
}

function collectIndividualExtensions(individual: NormalizedIndividual): NormalizedExtension[] {
    return [
        ...individual.extensions,
        ...individual.names.flatMap((name) => name.extensions),
        ...individual.events.flatMap(collectEventExtensions),
        ...individual.attributes.flatMap(collectEventBaseExtensions),
        ...individual.parentFamilyLinks.flatMap((link) => link.extensions),
        ...individual.sourceCitations.flatMap(collectSourceCitationExtensions),
        ...individual.noteReferences.flatMap(collectNoteReferenceExtensions),
        ...individual.mediaReferences.flatMap(collectMediaReferenceExtensions),
    ];
}

function collectFamilyExtensions(family: NormalizedFamily): NormalizedExtension[] {
    return [
        ...family.extensions,
        ...family.events.flatMap(collectEventExtensions),
        ...family.sourceCitations.flatMap(collectSourceCitationExtensions),
        ...family.noteReferences.flatMap(collectNoteReferenceExtensions),
        ...family.mediaReferences.flatMap(collectMediaReferenceExtensions),
    ];
}

function collectSourceExtensions(source: NormalizedSource): NormalizedExtension[] {
    return [
        ...source.extensions,
        ...source.noteReferences.flatMap(collectNoteReferenceExtensions),
        ...source.mediaReferences.flatMap(collectMediaReferenceExtensions),
    ];
}

export function collectGedcomExtensions(document: NormalizedGedcomDocument): NormalizedExtension[] {
    return [
        ...document.extensions,
        ...document.individuals.flatMap(collectIndividualExtensions),
        ...document.families.flatMap(collectFamilyExtensions),
        ...document.sources.flatMap(collectSourceExtensions),
        ...document.repositories.flatMap((repository) => repository.extensions),
        ...document.media.flatMap(collectMediaExtensions),
        ...document.sharedNotes.flatMap((note) => note.extensions),
    ];
}
