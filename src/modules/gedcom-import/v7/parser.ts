import {
    childNodes,
    firstChild,
    normalizeExtension,
    normalizeExtensions,
    type ExtensionUriResolver,
} from '../common/gedcom-node-utils.js';
import {
    addGedcomError as addError,
    addGedcomWarning as addWarning,
    hasGedcomErrors as hasErrors,
    makeGedcomDiagnostic as diagnostic,
    validateMaximumCardinality as validateMaximum,
} from '../common/gedcom-diagnostic-utils.js';
import {
    GedcomDiagnosticCode,
    GedcomDiagnosticSeverity,
    type GedcomDiagnostic,
    type GedcomNode,
    type GedcomParseResult,
    type GedcomParser,
    type NormalizedAttribute,
    type NormalizedEvent,
    type NormalizedFamily,
    type NormalizedGedcomDocument,
    type NormalizedIndividual,
    type NormalizedMedia,
    type NormalizedMediaReference,
    type NormalizedName,
    type NormalizedNote,
    type NormalizedNoteReference,
    type NormalizedParentFamilyLink,
    type NormalizedPlace,
    type NormalizedRepository,
    type NormalizedSource,
    type NormalizedSourceCitation,
} from '../common/gedcom-parser.types.js';
import type { GenealogicalDate } from '../../../shared/genealogy/genealogical-date.types.js';
import {
    FAMILY_EVENT_TAGS as FAMILY_EVENTS,
    INDIVIDUAL_ATTRIBUTE_TAGS as INDIVIDUAL_ATTRIBUTES,
    INDIVIDUAL_EVENT_TAGS as INDIVIDUAL_EVENTS,
} from '../common/gedcom-structure-constants.js';
import type { DetectedGedcomFile, SupportedGedcomVersion } from '../gedcom-file.types.js';
import { parseGedcom7Date } from './date-parser.js';
import { GEDCOM_7_DATE_SYNTAX } from './date-constants.js';
import { isValidGedcom7Pointer, isValidGedcom7Xref } from './line-parser.js';
import { buildGedcom7Tree } from './tree-builder.js';

type ParserContext = {
    diagnostics: GedcomDiagnostic[];
    recordsById: Map<string, GedcomNode>;
    extensionUris: Map<string, string[]>;
};

function resolveExtensionUri(context: ParserContext): ExtensionUriResolver {
    return (node) => {
        if (!node.tag.startsWith('_')) return null;
        const uris = context.extensionUris.get(node.tag) ?? [];
        return uris.length === 1 ? (uris[0] ?? null) : null;
    };
}

function extractExtensionSchema(header: GedcomNode, context: ParserContext): void {
    validateMaximum(header, 'SCHMA', 1, context, null);
    const schema = firstChild(header, 'SCHMA');
    if (schema === null) return;

    for (const tagNode of childNodes(schema, 'TAG')) {
        const separator = tagNode.value?.indexOf(' ') ?? -1;
        const tag = separator === -1 ? '' : (tagNode.value?.slice(0, separator) ?? '');
        const uri = separator === -1 ? '' : (tagNode.value?.slice(separator + 1) ?? '');

        if (!tag.startsWith('_') || tag.length < 2 || uri.length === 0) {
            addError(
                context,
                GedcomDiagnosticCode.InvalidHeader,
                'SCHMA.TAG must contain an extension tag followed by its URI.',
                tagNode,
                null,
                'HEAD.SCHMA.TAG',
            );
            continue;
        }

        const uris = context.extensionUris.get(tag) ?? [];
        if (!uris.includes(uri)) uris.push(uri);
        context.extensionUris.set(tag, uris);
    }
}

function validateRoots(roots: GedcomNode[], context: ParserContext): GedcomNode | null {
    const headers = roots.filter((node) => node.tag === 'HEAD');
    const trailers = roots.filter((node) => node.tag === 'TRLR');
    const header = roots[0] ?? null;
    const trailer = roots.at(-1) ?? null;

    if (header?.tag !== 'HEAD' || headers.length !== 1) {
        addError(
            context,
            GedcomDiagnosticCode.MissingHeader,
            'A GEDCOM 7 dataset must begin with exactly one HEAD.',
            header,
        );
        return null;
    }

    if (header.xref !== null || header.value !== null) {
        addError(
            context,
            GedcomDiagnosticCode.InvalidHeader,
            'HEAD must not have an identifier or payload.',
            header,
        );
    }

    validateMaximum(header, 'GEDC', 1, context, null);
    const gedcom = firstChild(header, 'GEDC');
    const version = gedcom === null ? null : firstChild(gedcom, 'VERS');
    if (gedcom === null || version?.value === null || version === null) {
        addError(
            context,
            GedcomDiagnosticCode.InvalidHeader,
            'HEAD.GEDC.VERS is required in GEDCOM 7.',
            gedcom ?? header,
        );
    }

    if (firstChild(header, 'CHAR') !== null) {
        addError(
            context,
            GedcomDiagnosticCode.UnsupportedStructure,
            'HEAD.CHAR is not part of GEDCOM 7 because UTF-8 is mandatory.',
            firstChild(header, 'CHAR'),
        );
    }

    if (trailer?.tag !== 'TRLR' || trailers.length !== 1) {
        addError(
            context,
            GedcomDiagnosticCode.MissingTrailer,
            'A GEDCOM 7 dataset must end with exactly one TRLR.',
            trailer,
        );
    }

    for (const item of trailers) {
        if (item.xref !== null || item.value !== null || item.children.length > 0) {
            addError(
                context,
                GedcomDiagnosticCode.InvalidTrailer,
                'TRLR must not have an identifier, payload, or substructures.',
                item,
            );
        }
        if (roots.indexOf(item) !== roots.length - 1) {
            addError(
                context,
                GedcomDiagnosticCode.RecordAfterTrailer,
                'No record may appear after TRLR.',
                roots[roots.indexOf(item) + 1] ?? item,
            );
        }
    }

    extractExtensionSchema(header, context);
    return header;
}

function indexRecords(roots: GedcomNode[], context: ParserContext): void {
    for (const root of roots) {
        if (root.xref === null) continue;

        const existing = context.recordsById.get(root.xref);
        if (existing !== undefined) {
            addError(
                context,
                GedcomDiagnosticCode.DuplicateRecordIdentifier,
                `Cross-reference identifier ${root.xref} is declared more than once.`,
                root,
                root.xref,
            );
        } else {
            context.recordsById.set(root.xref, root);
        }
    }
}

function expectedPointerTarget(
    node: GedcomNode,
    parent: GedcomNode,
    root: GedcomNode,
): string | null {
    if (node.tag === 'SOUR' && !(root.tag === 'HEAD' && parent === root)) return 'SOUR';
    if (node.tag === 'OBJE') return 'OBJE';
    if (node.tag === 'SNOTE') return 'SNOTE';
    if (node.tag === 'REPO' && parent.tag === 'SOUR') return 'REPO';
    if (node.tag === 'SUBM') return 'SUBM';

    if (root.tag === 'FAM' && parent === root && ['HUSB', 'WIFE', 'CHIL'].includes(node.tag)) {
        return 'INDI';
    }

    if (root.tag === 'INDI') {
        if (
            ['FAMC', 'FAMS'].includes(node.tag) &&
            (parent === root || INDIVIDUAL_EVENTS.has(parent.tag))
        ) {
            return 'FAM';
        }
        if (parent === root && node.tag === 'ALIA') return 'INDI';
        if (node.tag === 'ASSO') return 'INDI';
        if (parent === root && ['ANCI', 'DESI'].includes(node.tag)) return 'SUBM';
    }

    return null;
}

function validatePointers(
    node: GedcomNode,
    parent: GedcomNode,
    root: GedcomNode,
    context: ParserContext,
): void {
    const targetTag = expectedPointerTarget(node, parent, root);

    if (targetTag !== null) {
        if (node.value === null || !isValidGedcom7Pointer(node.value)) {
            addError(
                context,
                GedcomDiagnosticCode.InvalidPointer,
                `${node.tag} must contain a GEDCOM 7 pointer.`,
                node,
                root.xref,
                node.tag,
            );
        } else if (node.value !== '@VOID@') {
            const target = context.recordsById.get(node.value);
            if (target === undefined) {
                addError(
                    context,
                    GedcomDiagnosticCode.MissingReference,
                    `Pointer ${node.value} does not reference an existing record.`,
                    node,
                    root.xref,
                    node.tag,
                );
            } else if (target.tag !== targetTag) {
                addError(
                    context,
                    GedcomDiagnosticCode.ReferenceTypeMismatch,
                    `${node.tag} expects ${targetTag} but ${node.value} references ${target.tag}.`,
                    node,
                    root.xref,
                    node.tag,
                );
            }
        }
    }

    for (const child of node.children) validatePointers(child, node, root, context);
}

function validateDocumentStructures(roots: GedcomNode[], context: ParserContext): void {
    for (const root of roots) {
        for (const child of root.children) validatePointers(child, root, root, context);
    }
}

function pointerValue(node: GedcomNode): string | null {
    return node.value !== null && isValidGedcom7Xref(node.value) ? node.value : null;
}

function parseDate(
    node: GedcomNode | null,
    context: ParserContext,
    recordId: string,
): GenealogicalDate | null {
    if (node === null) return null;
    validateMaximum(node, GEDCOM_7_DATE_SYNTAX.phraseTag, 1, context, recordId);
    const phrase = firstChild(node, GEDCOM_7_DATE_SYNTAX.phraseTag)?.value ?? null;
    const result = parseGedcom7Date(node.value, phrase);
    if (!result.success) {
        addError(context, GedcomDiagnosticCode.InvalidDate, result.message, node, recordId, 'DATE');
        return null;
    }
    return result.date;
}

function normalizePlace(
    node: GedcomNode,
    context: ParserContext,
    recordId: string,
): NormalizedPlace {
    validateMaximum(node, 'FORM', 1, context, recordId);
    validateMaximum(node, 'LANG', 1, context, recordId);
    validateMaximum(node, 'MAP', 1, context, recordId);
    const format = firstChild(node, 'FORM')?.value ?? null;
    const map = firstChild(node, 'MAP');
    const known = new Set(['FORM', 'LANG', 'MAP', 'NOTE', 'SNOTE']);
    return {
        value: node.value ?? '',
        format: format === null ? null : format.split(',').map((part) => part.trim()),
        latitude: map === null ? null : (firstChild(map, 'LATI')?.value ?? null),
        longitude: map === null ? null : (firstChild(map, 'LONG')?.value ?? null),
        language: firstChild(node, 'LANG')?.value ?? null,
        extensions: normalizeExtensions(node, known, 'PLAC', resolveExtensionUri(context)),
    };
}

function normalizeSourceCitation(
    node: GedcomNode,
    context: ParserContext,
): NormalizedSourceCitation {
    const data = firstChild(node, 'DATA');
    const text = data === null ? null : firstChild(data, 'TEXT');
    const known = new Set(['PAGE', 'DATA', 'QUAY', 'NOTE', 'SNOTE', 'OBJE']);
    return {
        sourceId: pointerValue(node),
        page: firstChild(node, 'PAGE')?.value ?? null,
        data: text?.value ?? data?.value ?? null,
        quality: firstChild(node, 'QUAY')?.value ?? null,
        extensions: normalizeExtensions(node, known, 'SOUR', resolveExtensionUri(context)),
    };
}

function normalizeInlineNote(node: GedcomNode, context: ParserContext): NormalizedNote {
    const known = new Set(['MIME', 'LANG', 'SOUR']);
    return {
        id: node.xref,
        text: node.value ?? '',
        language: firstChild(node, 'LANG')?.value ?? null,
        mediaType: firstChild(node, 'MIME')?.value ?? null,
        extensions: normalizeExtensions(node, known, node.tag, resolveExtensionUri(context)),
    };
}

function noteReferences(node: GedcomNode, context: ParserContext): NormalizedNoteReference[] {
    return [
        ...childNodes(node, 'NOTE').map((note) => ({
            noteId: null,
            inlineNote: normalizeInlineNote(note, context),
        })),
        ...childNodes(node, 'SNOTE').map((note) => ({
            noteId: pointerValue(note),
            inlineNote: null,
        })),
    ];
}

function normalizeMedia(node: GedcomNode, context: ParserContext): NormalizedMedia {
    validateMaximum(node, 'RESN', 1, context, node.xref);
    const files = childNodes(node, 'FILE');
    if (files.length === 0) {
        addError(
            context,
            GedcomDiagnosticCode.InvalidCardinality,
            'A GEDCOM 7 OBJE record requires at least one FILE.',
            node,
            node.xref,
            'FILE',
        );
    }

    for (const file of files) {
        if (firstChild(file, 'FORM')?.value == null) {
            addError(
                context,
                GedcomDiagnosticCode.InvalidCardinality,
                'A GEDCOM 7 FILE requires exactly one FORM.',
                file,
                node.xref,
                'FILE.FORM',
            );
        }
        validateMaximum(file, 'FORM', 1, context, node.xref);
    }

    const known = new Set([
        'RESN',
        'FILE',
        'UID',
        'EXID',
        'REFN',
        'NOTE',
        'SNOTE',
        'SOUR',
        'CHAN',
        'CREA',
    ]);
    return {
        id: node.xref,
        files: files.map((file, index) => ({
            path: file.value ?? '',
            mediaType: firstChild(file, 'FORM')?.value ?? null,
            title: firstChild(file, 'TITL')?.value ?? null,
            extensions: normalizeExtensions(
                file,
                new Set(['FORM', 'TITL']),
                `OBJE.FILE[${index}]`,
                resolveExtensionUri(context),
            ),
        })),
        title: null,
        extensions: normalizeExtensions(
            node,
            known,
            `OBJE[${node.xref ?? ''}]`,
            resolveExtensionUri(context),
        ),
    };
}

function mediaReferences(node: GedcomNode): NormalizedMediaReference[] {
    return childNodes(node, 'OBJE').map((media) => ({
        mediaId: pointerValue(media),
        inlineMedia: null,
    }));
}

function normalizeEvent(
    node: GedcomNode,
    context: ParserContext,
    recordId: string,
): NormalizedEvent {
    validateMaximum(node, 'DATE', 1, context, recordId);
    validateMaximum(node, 'PLAC', 1, context, recordId);
    validateMaximum(node, 'TYPE', 1, context, recordId);
    const place = firstChild(node, 'PLAC');
    const known = new Set([
        'TYPE',
        'DATE',
        'SDATE',
        'PLAC',
        'ADDR',
        'PHON',
        'EMAIL',
        'FAX',
        'WWW',
        'AGNC',
        'RELI',
        'CAUS',
        'RESN',
        'AGE',
        'HUSB',
        'WIFE',
        'ASSO',
        'NOTE',
        'SNOTE',
        'SOUR',
        'OBJE',
        'FAMC',
    ]);
    return {
        tag: node.tag,
        type: firstChild(node, 'TYPE')?.value ?? null,
        value: node.value,
        date: parseDate(firstChild(node, 'DATE'), context, recordId),
        place: place === null ? null : normalizePlace(place, context, recordId),
        description: firstChild(node, 'CAUS')?.value ?? null,
        sourceCitations: childNodes(node, 'SOUR').map((source) =>
            normalizeSourceCitation(source, context),
        ),
        noteReferences: noteReferences(node, context),
        mediaReferences: mediaReferences(node),
        extensions: normalizeExtensions(node, known, node.tag, resolveExtensionUri(context)),
    };
}

function normalizeAttribute(
    node: GedcomNode,
    context: ParserContext,
    recordId: string,
): NormalizedAttribute {
    const event = normalizeEvent(node, context, recordId);
    return {
        tag: event.tag,
        type: event.type,
        value: event.value,
        date: event.date,
        place: event.place,
        sourceCitations: event.sourceCitations,
        noteReferences: event.noteReferences,
        extensions: event.extensions,
    };
}

function normalizeName(node: GedcomNode, context: ParserContext, primary: boolean): NormalizedName {
    const known = new Set([
        'TYPE',
        'NPFX',
        'GIVN',
        'NICK',
        'SPFX',
        'SURN',
        'NSFX',
        'NOTE',
        'SNOTE',
        'SOUR',
    ]);
    return {
        value: node.value ?? '',
        type: firstChild(node, 'TYPE')?.value ?? null,
        givenNames: firstChild(node, 'GIVN')?.value ?? null,
        surname: firstChild(node, 'SURN')?.value ?? null,
        surnamePrefix: firstChild(node, 'SPFX')?.value ?? null,
        prefix: firstChild(node, 'NPFX')?.value ?? null,
        suffix: firstChild(node, 'NSFX')?.value ?? null,
        nickname: firstChild(node, 'NICK')?.value ?? null,
        isPrimary: primary,
        extensions: normalizeExtensions(node, known, 'NAME', resolveExtensionUri(context)),
    };
}

function normalizeSex(
    node: GedcomNode | null,
    context: ParserContext,
    recordId: string,
): NormalizedIndividual['sex'] {
    if (node?.value == null) return null;
    const values = { M: 'male', F: 'female', X: 'other', U: 'unknown' } as const;
    const value = values[node.value as keyof typeof values];
    if (value === undefined && !node.value.startsWith('_')) {
        addError(
            context,
            GedcomDiagnosticCode.UnknownValue,
            `SEX value ${node.value} is not defined by GEDCOM 7.`,
            node,
            recordId,
            'SEX',
        );
    }
    return { value: value ?? 'other', originalValue: node.value };
}

function normalizeParentLink(
    node: GedcomNode,
    context: ParserContext,
): NormalizedParentFamilyLink | null {
    const familyId = pointerValue(node);
    if (familyId === null) return null;
    const known = new Set(['PEDI', 'STAT', 'NOTE', 'SNOTE']);
    return {
        familyId,
        pedigree: firstChild(node, 'PEDI')?.value ?? null,
        status: firstChild(node, 'STAT')?.value ?? null,
        extensions: normalizeExtensions(node, known, 'FAMC', resolveExtensionUri(context)),
    };
}

function normalizeIndividual(node: GedcomNode, context: ParserContext): NormalizedIndividual {
    const id = node.xref ?? '';
    validateMaximum(node, 'SEX', 1, context, id);
    const names = childNodes(node, 'NAME');
    const known = new Set([
        'RESN',
        'NAME',
        'SEX',
        'FAMC',
        'FAMS',
        'SUBM',
        'ALIA',
        'ANCI',
        'DESI',
        'ASSO',
        'UID',
        'EXID',
        'REFN',
        'NOTE',
        'SNOTE',
        'SOUR',
        'OBJE',
        'CHAN',
        'CREA',
        'NO',
        ...INDIVIDUAL_EVENTS,
        ...INDIVIDUAL_ATTRIBUTES,
    ]);
    return {
        id: node.xref,
        names: names.map((name, index) => normalizeName(name, context, index === 0)),
        sex: normalizeSex(firstChild(node, 'SEX'), context, id),
        events: node.children
            .filter((child) => INDIVIDUAL_EVENTS.has(child.tag))
            .map((event) => normalizeEvent(event, context, id)),
        attributes: node.children
            .filter((child) => INDIVIDUAL_ATTRIBUTES.has(child.tag))
            .map((attribute) => normalizeAttribute(attribute, context, id)),
        parentFamilyLinks: childNodes(node, 'FAMC')
            .map((link) => normalizeParentLink(link, context))
            .filter((link): link is NormalizedParentFamilyLink => link !== null),
        partnerFamilyIds: childNodes(node, 'FAMS')
            .map(pointerValue)
            .filter((value): value is string => value !== null),
        sourceCitations: childNodes(node, 'SOUR').map((source) =>
            normalizeSourceCitation(source, context),
        ),
        noteReferences: noteReferences(node, context),
        mediaReferences: mediaReferences(node),
        identifiers: [
            ...childNodes(node, 'UID').map((item) => ({ type: 'UID', value: item.value ?? '' })),
            ...childNodes(node, 'EXID').map((item) => ({
                type: firstChild(item, 'TYPE')?.value ?? 'EXID',
                value: item.value ?? '',
            })),
            ...childNodes(node, 'REFN').map((item) => ({
                type: firstChild(item, 'TYPE')?.value ?? 'REFN',
                value: item.value ?? '',
            })),
        ],
        extensions: normalizeExtensions(node, known, `INDI[${id}]`, resolveExtensionUri(context)),
    };
}

function normalizeFamily(
    node: GedcomNode,
    context: ParserContext,
    individuals: ReadonlyMap<string, NormalizedIndividual>,
): NormalizedFamily {
    const id = node.xref ?? '';
    validateMaximum(node, 'HUSB', 1, context, id);
    validateMaximum(node, 'WIFE', 1, context, id);
    const partners = [
        ...childNodes(node, 'HUSB').map((item) => ({ item, sourceRole: 'husband' as const })),
        ...childNodes(node, 'WIFE').map((item) => ({ item, sourceRole: 'wife' as const })),
    ]
        .map(({ item, sourceRole }) => {
            const individualId = pointerValue(item);
            return individualId === null ? null : { individualId, sourceRole };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

    const familyChildren = childNodes(node, 'CHIL')
        .map((item) => {
            const individualId = pointerValue(item);
            if (individualId === null) return null;
            const link = individuals
                .get(individualId)
                ?.parentFamilyLinks.find((candidate) => candidate.familyId === id);
            if (link === undefined) {
                addWarning(
                    context,
                    GedcomDiagnosticCode.InconsistentFamilyLink,
                    `${individualId} is a CHIL of ${id} but has no matching FAMC.`,
                    item,
                    id,
                    'CHIL',
                );
            }
            return { individualId, pedigree: link?.pedigree ?? null, status: link?.status ?? null };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    const known = new Set([
        'RESN',
        'HUSB',
        'WIFE',
        'CHIL',
        'NCHI',
        'SUBM',
        'UID',
        'EXID',
        'REFN',
        'NOTE',
        'SNOTE',
        'SOUR',
        'OBJE',
        'CHAN',
        'CREA',
        ...FAMILY_EVENTS,
    ]);
    return {
        id: node.xref,
        partners,
        children: familyChildren,
        events: node.children
            .filter((child) => FAMILY_EVENTS.has(child.tag))
            .map((event) => normalizeEvent(event, context, id)),
        sourceCitations: childNodes(node, 'SOUR').map((source) =>
            normalizeSourceCitation(source, context),
        ),
        noteReferences: noteReferences(node, context),
        mediaReferences: mediaReferences(node),
        extensions: normalizeExtensions(node, known, `FAM[${id}]`, resolveExtensionUri(context)),
    };
}

function validateReverseLinks(
    individuals: NormalizedIndividual[],
    families: ReadonlyMap<string, NormalizedFamily>,
    context: ParserContext,
): void {
    for (const individual of individuals) {
        for (const link of individual.parentFamilyLinks) {
            const family = families.get(link.familyId);
            if (
                family !== undefined &&
                !family.children.some((child) => child.individualId === individual.id)
            ) {
                addWarning(
                    context,
                    GedcomDiagnosticCode.InconsistentFamilyLink,
                    `${individual.id} references ${link.familyId} through FAMC but is not listed as CHIL.`,
                    individual.id === null
                        ? null
                        : (context.recordsById.get(individual.id) ?? null),
                    individual.id,
                    'FAMC',
                );
            }
        }
        for (const familyId of individual.partnerFamilyIds) {
            const family = families.get(familyId);
            if (
                family !== undefined &&
                !family.partners.some((partner) => partner.individualId === individual.id)
            ) {
                addWarning(
                    context,
                    GedcomDiagnosticCode.InconsistentFamilyLink,
                    `${individual.id} references ${familyId} through FAMS but is not listed as a partner.`,
                    individual.id === null
                        ? null
                        : (context.recordsById.get(individual.id) ?? null),
                    individual.id,
                    'FAMS',
                );
            }
        }
    }
}

function normalizeSource(node: GedcomNode, context: ParserContext): NormalizedSource {
    const known = new Set([
        'DATA',
        'AUTH',
        'TITL',
        'ABBR',
        'PUBL',
        'TEXT',
        'REPO',
        'UID',
        'EXID',
        'REFN',
        'NOTE',
        'SNOTE',
        'OBJE',
        'CHAN',
        'CREA',
    ]);
    return {
        id: node.xref,
        title: firstChild(node, 'TITL')?.value ?? null,
        author: firstChild(node, 'AUTH')?.value ?? null,
        publication: firstChild(node, 'PUBL')?.value ?? null,
        repositoryReferences: childNodes(node, 'REPO')
            .map((repository) => ({
                repositoryId: pointerValue(repository),
                callNumber: firstChild(repository, 'CALN')?.value ?? null,
            }))
            .filter(
                (item): item is { repositoryId: string; callNumber: string | null } =>
                    item.repositoryId !== null,
            ),
        noteReferences: noteReferences(node, context),
        mediaReferences: mediaReferences(node),
        extensions: normalizeExtensions(
            node,
            known,
            `SOUR[${node.xref ?? ''}]`,
            resolveExtensionUri(context),
        ),
    };
}

function normalizeRepository(node: GedcomNode, context: ParserContext): NormalizedRepository {
    const known = new Set([
        'NAME',
        'ADDR',
        'PHON',
        'EMAIL',
        'FAX',
        'WWW',
        'UID',
        'EXID',
        'REFN',
        'NOTE',
        'SNOTE',
        'CHAN',
        'CREA',
    ]);
    return {
        id: node.xref,
        name: firstChild(node, 'NAME')?.value ?? null,
        address: firstChild(node, 'ADDR')?.value ?? null,
        extensions: normalizeExtensions(
            node,
            known,
            `REPO[${node.xref ?? ''}]`,
            resolveExtensionUri(context),
        ),
    };
}

export class Gedcom7Parser implements GedcomParser {
    supports(version: SupportedGedcomVersion): boolean {
        return version === '7.0' || version.startsWith('7.0.');
    }

    parse(file: DetectedGedcomFile): GedcomParseResult {
        if (!this.supports(file.descriptor.version)) {
            return {
                document: null,
                diagnostics: [
                    diagnostic(
                        GedcomDiagnosticSeverity.Error,
                        GedcomDiagnosticCode.UnsupportedParserVersion,
                        `Gedcom7Parser does not support version ${file.descriptor.version}.`,
                        null,
                    ),
                ],
            };
        }

        const tree = buildGedcom7Tree(file.content);
        const context: ParserContext = {
            diagnostics: [...tree.diagnostics],
            recordsById: new Map(),
            extensionUris: new Map(),
        };
        const header = validateRoots(tree.roots, context);
        indexRecords(tree.roots, context);
        validateDocumentStructures(tree.roots, context);
        if (header === null || hasErrors(context.diagnostics))
            return { document: null, diagnostics: context.diagnostics };

        const individuals = tree.roots
            .filter((node) => node.tag === 'INDI')
            .map((node) => normalizeIndividual(node, context));
        const individualsById = new Map(
            individuals
                .filter(
                    (individual): individual is NormalizedIndividual & { id: string } =>
                        individual.id !== null,
                )
                .map((individual) => [individual.id, individual]),
        );
        const families = tree.roots
            .filter((node) => node.tag === 'FAM')
            .map((node) => normalizeFamily(node, context, individualsById));
        const familiesById = new Map(
            families
                .filter((family): family is NormalizedFamily & { id: string } => family.id !== null)
                .map((family) => [family.id, family]),
        );
        validateReverseLinks(individuals, familiesById, context);

        const source = firstChild(header, 'SOUR');
        const document: NormalizedGedcomDocument = {
            metadata: {
                version: file.descriptor.version,
                sourceProduct:
                    source === null ? null : (firstChild(source, 'NAME')?.value ?? source.value),
                sourceProductVersion:
                    source === null ? null : (firstChild(source, 'VERS')?.value ?? null),
                characterEncoding: file.descriptor.characterEncoding,
                language: firstChild(header, 'LANG')?.value ?? null,
                fileName: null,
            },
            individuals,
            families,
            sources: tree.roots
                .filter((node) => node.tag === 'SOUR')
                .map((node) => normalizeSource(node, context)),
            repositories: tree.roots
                .filter((node) => node.tag === 'REPO')
                .map((node) => normalizeRepository(node, context)),
            media: tree.roots
                .filter((node) => node.tag === 'OBJE')
                .map((node) => normalizeMedia(node, context)),
            sharedNotes: tree.roots
                .filter((node) => node.tag === 'SNOTE')
                .map((node) => normalizeInlineNote(node, context)),
            extensions: tree.roots
                .filter(
                    (node) =>
                        ![
                            'HEAD',
                            'TRLR',
                            'INDI',
                            'FAM',
                            'SOUR',
                            'REPO',
                            'OBJE',
                            'SNOTE',
                            'SUBM',
                        ].includes(node.tag),
                )
                .map((node, index) =>
                    normalizeExtension(node, `${node.tag}[${index}]`, resolveExtensionUri(context)),
                ),
        };

        return hasErrors(context.diagnostics)
            ? { document: null, diagnostics: context.diagnostics }
            : { document, diagnostics: context.diagnostics };
    }
}
