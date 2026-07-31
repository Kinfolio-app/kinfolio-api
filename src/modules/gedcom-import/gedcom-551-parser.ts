import { parseGedcom551Date } from './gedcom-551-date-parser.js';
import { isValidXref } from './gedcom-line-parser.js';
import {
    GedcomDiagnosticCode,
    GedcomDiagnosticSeverity,
    type GedcomDiagnostic,
    type GedcomNode,
    type GedcomParseResult,
    type GedcomParser,
    type GenealogicalDate,
    type NormalizedAttribute,
    type NormalizedEvent,
    type NormalizedExtension,
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
} from './gedcom-parser.types.js';
import { buildGedcomTree } from './gedcom-tree-builder.js';
import type { DetectedGedcomFile, SupportedGedcomVersion } from './gedcom-file.types.js';

const RECORD_TAGS_REQUIRING_IDENTIFIER = new Set([
    'INDI',
    'FAM',
    'SOUR',
    'REPO',
    'NOTE',
    'OBJE',
    'SUBM',
    'SUBN',
]);

const INDIVIDUAL_EVENT_TAGS = new Set([
    'BIRT',
    'CHR',
    'DEAT',
    'BURI',
    'CREM',
    'ADOP',
    'BAPM',
    'BARM',
    'BASM',
    'BLES',
    'CHRA',
    'CONF',
    'FCOM',
    'ORDN',
    'NATU',
    'EMIG',
    'IMMI',
    'CENS',
    'PROB',
    'WILL',
    'GRAD',
    'RETI',
    'EVEN',
]);

const INDIVIDUAL_ATTRIBUTE_TAGS = new Set([
    'CAST',
    'DSCR',
    'EDUC',
    'IDNO',
    'NATI',
    'NCHI',
    'NMR',
    'OCCU',
    'PROP',
    'RELI',
    'RESI',
    'SSN',
    'TITL',
    'FACT',
]);

const FAMILY_EVENT_TAGS = new Set([
    'ANUL',
    'CENS',
    'DIV',
    'DIVF',
    'ENGA',
    'MARB',
    'MARC',
    'MARL',
    'MARR',
    'RESI',
    'EVEN',
]);

type ParserContext = {
    diagnostics: GedcomDiagnostic[];
    recordsById: Map<string, GedcomNode>;
};

function children(node: GedcomNode, tag: string): GedcomNode[] {
    return node.children.filter((child) => child.tag === tag);
}

function firstChild(node: GedcomNode, tag: string): GedcomNode | null {
    return node.children.find((child) => child.tag === tag) ?? null;
}

function readText(node: GedcomNode): string {
    let text = node.value ?? '';

    for (const child of node.children) {
        if (child.tag === 'CONC') {
            text += child.value ?? '';
        } else if (child.tag === 'CONT') {
            text += `\n${child.value ?? ''}`;
        }
    }

    return text;
}

function makeDiagnostic(
    severity: GedcomDiagnostic['severity'],
    code: GedcomDiagnostic['code'],
    message: string,
    node: GedcomNode | null,
    recordId: string | null = null,
    path: string | null = null,
): GedcomDiagnostic {
    return {
        severity,
        code,
        message,
        location: node?.location ?? null,
        recordId,
        path,
    };
}

function addError(
    context: ParserContext,
    code: GedcomDiagnostic['code'],
    message: string,
    node: GedcomNode | null,
    recordId: string | null = null,
    path: string | null = null,
): void {
    context.diagnostics.push(
        makeDiagnostic(GedcomDiagnosticSeverity.Error, code, message, node, recordId, path),
    );
}

function addWarning(
    context: ParserContext,
    code: GedcomDiagnostic['code'],
    message: string,
    node: GedcomNode | null,
    recordId: string | null = null,
    path: string | null = null,
): void {
    context.diagnostics.push(
        makeDiagnostic(GedcomDiagnosticSeverity.Warning, code, message, node, recordId, path),
    );
}

function extension(node: GedcomNode, path: string): NormalizedExtension {
    return {
        tag: node.tag,
        uri: null,
        value: node.value,
        path,
        location: node.location,
        children: node.children.map((child, index) =>
            extension(child, `${path}.${child.tag}[${index}]`),
        ),
    };
}

function extensions(
    node: GedcomNode,
    knownTags: ReadonlySet<string>,
    path: string,
): NormalizedExtension[] {
    return node.children
        .filter((child) => !knownTags.has(child.tag))
        .map((child, index) => extension(child, `${path}.${child.tag}[${index}]`));
}

function pointerValue(
    node: GedcomNode,
    context: ParserContext,
    recordId: string,
    required: boolean,
): string | null {
    if (node.value === null || !isValidXref(node.value)) {
        if (required || node.value?.startsWith('@')) {
            addError(
                context,
                GedcomDiagnosticCode.InvalidPointer,
                `${node.tag} must contain a valid GEDCOM pointer.`,
                node,
                recordId,
                node.tag,
            );
        }

        return null;
    }

    return node.value;
}

function validateCardinality(
    node: GedcomNode,
    tag: string,
    maximum: number,
    context: ParserContext,
    recordId: string | null,
): void {
    const matchingChildren = children(node, tag);

    if (matchingChildren.length > maximum) {
        addError(
            context,
            GedcomDiagnosticCode.InvalidCardinality,
            `${tag} occurs ${matchingChildren.length} times but permits at most ${maximum}.`,
            matchingChildren[maximum] ?? node,
            recordId,
            tag,
        );
    }
}

function parseDate(
    node: GedcomNode | null,
    context: ParserContext,
    recordId: string,
): GenealogicalDate | null {
    if (node?.value === null || node === null) {
        return null;
    }

    const result = parseGedcom551Date(node.value);
    if (!result.success) {
        addError(context, GedcomDiagnosticCode.InvalidDate, result.message, node, recordId, 'DATE');
        return null;
    }

    return result.date;
}

function normalizePlace(node: GedcomNode): NormalizedPlace {
    const formatNode = firstChild(node, 'FORM');
    const mapNode = firstChild(node, 'MAP');
    const knownTags = new Set(['FORM', 'MAP', 'FONE', 'ROMN', 'NOTE', 'SOUR']);

    return {
        value: node.value ?? '',
        format:
            formatNode?.value === null || formatNode === null
                ? null
                : formatNode.value.split(',').map((part) => part.trim()),
        latitude: mapNode === null ? null : (firstChild(mapNode, 'LATI')?.value ?? null),
        longitude: mapNode === null ? null : (firstChild(mapNode, 'LONG')?.value ?? null),
        language: null,
        extensions: extensions(node, knownTags, 'PLAC'),
    };
}

function normalizeSourceCitation(node: GedcomNode): NormalizedSourceCitation {
    const dataNode = firstChild(node, 'DATA');
    const textNode = dataNode === null ? null : firstChild(dataNode, 'TEXT');
    const knownTags = new Set(['PAGE', 'EVEN', 'DATA', 'QUAY', 'NOTE', 'OBJE']);

    return {
        sourceId: node.value !== null && isValidXref(node.value) ? node.value : null,
        page: firstChild(node, 'PAGE')?.value ?? null,
        data: textNode === null ? (dataNode?.value ?? null) : readText(textNode),
        quality: firstChild(node, 'QUAY')?.value ?? null,
        extensions: extensions(node, knownTags, 'SOUR'),
    };
}

function normalizeNote(node: GedcomNode): NormalizedNote {
    const knownTags = new Set(['CONC', 'CONT', 'SOUR', 'CHAN']);

    return {
        id: node.xref,
        text: readText(node),
        language: null,
        mediaType: null,
        extensions: extensions(node, knownTags, 'NOTE'),
    };
}

function normalizeNoteReference(node: GedcomNode): NormalizedNoteReference {
    if (node.value !== null && isValidXref(node.value)) {
        return { noteId: node.value, inlineNote: null };
    }

    return {
        noteId: null,
        inlineNote: normalizeNote(node),
    };
}

function normalizeMedia(node: GedcomNode): NormalizedMedia {
    const fileNodes = children(node, 'FILE');
    const knownTags = new Set(['FILE', 'TITL', 'NOTE', 'SOUR', 'REFN', 'RIN', 'CHAN']);

    return {
        id: node.xref,
        files: fileNodes
            .filter((fileNode) => fileNode.value !== null)
            .map((fileNode) => ({
                path: fileNode.value ?? '',
                mediaType: firstChild(fileNode, 'FORM')?.value ?? null,
                title: firstChild(fileNode, 'TITL')?.value ?? null,
            })),
        title: firstChild(node, 'TITL')?.value ?? null,
        extensions: extensions(node, knownTags, 'OBJE'),
    };
}

function normalizeMediaReference(node: GedcomNode): NormalizedMediaReference {
    if (node.value !== null && isValidXref(node.value)) {
        return { mediaId: node.value, inlineMedia: null };
    }

    return {
        mediaId: null,
        inlineMedia: normalizeMedia(node),
    };
}

function normalizeEvent(
    node: GedcomNode,
    context: ParserContext,
    recordId: string,
): NormalizedEvent {
    validateCardinality(node, 'DATE', 1, context, recordId);
    validateCardinality(node, 'PLAC', 1, context, recordId);
    validateCardinality(node, 'TYPE', 1, context, recordId);
    const knownTags = new Set([
        'TYPE',
        'DATE',
        'PLAC',
        'ADDR',
        'AGNC',
        'RELI',
        'CAUS',
        'RESN',
        'AGE',
        'HUSB',
        'WIFE',
        'NOTE',
        'SOUR',
        'OBJE',
    ]);
    const placeNode = firstChild(node, 'PLAC');

    return {
        tag: node.tag,
        type: firstChild(node, 'TYPE')?.value ?? null,
        value: node.value,
        date: parseDate(firstChild(node, 'DATE'), context, recordId),
        place: placeNode === null ? null : normalizePlace(placeNode),
        description: firstChild(node, 'CAUS')?.value ?? null,
        sourceCitations: children(node, 'SOUR').map(normalizeSourceCitation),
        noteReferences: children(node, 'NOTE').map(normalizeNoteReference),
        mediaReferences: children(node, 'OBJE').map(normalizeMediaReference),
        extensions: extensions(node, knownTags, node.tag),
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

function normalizeName(node: GedcomNode, isPrimary: boolean): NormalizedName {
    const knownTags = new Set([
        'TYPE',
        'NPFX',
        'GIVN',
        'NICK',
        'SPFX',
        'SURN',
        'NSFX',
        'NOTE',
        'SOUR',
        'FONE',
        'ROMN',
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
        isPrimary,
        extensions: extensions(node, knownTags, 'NAME'),
    };
}

function normalizeParentFamilyLink(
    node: GedcomNode,
    context: ParserContext,
    recordId: string,
): NormalizedParentFamilyLink | null {
    const familyId = pointerValue(node, context, recordId, true);

    if (familyId === null) {
        return null;
    }

    const knownTags = new Set(['PEDI', 'STAT', 'NOTE']);

    return {
        familyId,
        pedigree: firstChild(node, 'PEDI')?.value ?? null,
        status: firstChild(node, 'STAT')?.value ?? null,
        extensions: extensions(node, knownTags, 'FAMC'),
    };
}

function normalizeSex(
    node: GedcomNode | null,
    context: ParserContext,
    recordId: string,
): NormalizedIndividual['sex'] {
    if (node?.value === null || node === null) {
        return null;
    }

    const value =
        node.value === 'M'
            ? 'male'
            : node.value === 'F'
              ? 'female'
              : node.value === 'U'
                ? 'unknown'
                : 'other';

    if (node.value !== 'M' && node.value !== 'F') {
        addWarning(
            context,
            GedcomDiagnosticCode.UnknownValue,
            `SEX value ${node.value} is not defined by GEDCOM 5.5.1.`,
            node,
            recordId,
            'SEX',
        );
    }

    return { value, originalValue: node.value };
}

function normalizeIndividual(node: GedcomNode, context: ParserContext): NormalizedIndividual {
    const recordId = node.xref ?? '';
    validateCardinality(node, 'SEX', 1, context, recordId);
    const nameNodes = children(node, 'NAME');
    const parentFamilyLinks = children(node, 'FAMC')
        .map((child) => normalizeParentFamilyLink(child, context, recordId))
        .filter((link): link is NormalizedParentFamilyLink => link !== null);
    const partnerFamilyIds = children(node, 'FAMS')
        .map((child) => pointerValue(child, context, recordId, true))
        .filter((id): id is string => id !== null);
    const knownTags = new Set([
        'NAME',
        'SEX',
        'FAMC',
        'FAMS',
        'SUBM',
        'ALIA',
        'ANCI',
        'DESI',
        'RFN',
        'AFN',
        'REFN',
        'RIN',
        'CHAN',
        'NOTE',
        'SOUR',
        'OBJE',
        ...INDIVIDUAL_EVENT_TAGS,
        ...INDIVIDUAL_ATTRIBUTE_TAGS,
    ]);
    const identifiers = [
        ...children(node, 'RFN').map((child) => ({ type: 'RFN', value: child.value ?? '' })),
        ...children(node, 'AFN').map((child) => ({ type: 'AFN', value: child.value ?? '' })),
        ...children(node, 'RIN').map((child) => ({ type: 'RIN', value: child.value ?? '' })),
        ...children(node, 'REFN').map((child) => ({
            type: firstChild(child, 'TYPE')?.value ?? 'REFN',
            value: child.value ?? '',
        })),
    ];

    return {
        id: recordId,
        names: nameNodes.map((name, index) => normalizeName(name, index === 0)),
        sex: normalizeSex(firstChild(node, 'SEX'), context, recordId),
        events: node.children
            .filter((child) => INDIVIDUAL_EVENT_TAGS.has(child.tag))
            .map((child) => normalizeEvent(child, context, recordId)),
        attributes: node.children
            .filter((child) => INDIVIDUAL_ATTRIBUTE_TAGS.has(child.tag))
            .map((child) => normalizeAttribute(child, context, recordId)),
        parentFamilyLinks,
        partnerFamilyIds,
        sourceCitations: children(node, 'SOUR').map(normalizeSourceCitation),
        noteReferences: children(node, 'NOTE').map(normalizeNoteReference),
        mediaReferences: children(node, 'OBJE').map(normalizeMediaReference),
        identifiers,
        extensions: extensions(node, knownTags, `INDI[${recordId}]`),
    };
}

function familyLinkForChild(
    individual: NormalizedIndividual | undefined,
    familyId: string,
): NormalizedParentFamilyLink | null {
    return individual?.parentFamilyLinks.find((link) => link.familyId === familyId) ?? null;
}

function normalizeFamily(
    node: GedcomNode,
    context: ParserContext,
    individualsById: ReadonlyMap<string, NormalizedIndividual>,
): NormalizedFamily {
    const recordId = node.xref ?? '';
    validateCardinality(node, 'HUSB', 1, context, recordId);
    validateCardinality(node, 'WIFE', 1, context, recordId);
    const partners = [
        ...children(node, 'HUSB').map((partner) => ({
            node: partner,
            sourceRole: 'husband' as const,
        })),
        ...children(node, 'WIFE').map((partner) => ({
            node: partner,
            sourceRole: 'wife' as const,
        })),
    ]
        .map(({ node: partnerNode, sourceRole }) => {
            const individualId = pointerValue(partnerNode, context, recordId, true);
            return individualId === null ? null : { individualId, sourceRole };
        })
        .filter((partner): partner is NonNullable<typeof partner> => partner !== null);
    const familyChildren = children(node, 'CHIL')
        .map((childNode) => {
            const individualId = pointerValue(childNode, context, recordId, true);

            if (individualId === null) {
                return null;
            }

            const individual = individualsById.get(individualId);
            const link = familyLinkForChild(individual, recordId);

            if (link === null) {
                addWarning(
                    context,
                    GedcomDiagnosticCode.InconsistentFamilyLink,
                    `${individualId} is a CHIL of ${recordId} but has no matching FAMC link.`,
                    childNode,
                    recordId,
                    'CHIL',
                );
            }

            return {
                individualId,
                pedigree: link?.pedigree ?? null,
                status: link?.status ?? null,
            };
        })
        .filter((child): child is NonNullable<typeof child> => child !== null);
    const knownTags = new Set([
        'HUSB',
        'WIFE',
        'CHIL',
        'NCHI',
        'SUBM',
        'REFN',
        'RIN',
        'CHAN',
        'NOTE',
        'SOUR',
        'OBJE',
        ...FAMILY_EVENT_TAGS,
    ]);

    return {
        id: recordId,
        partners,
        children: familyChildren,
        events: node.children
            .filter((child) => FAMILY_EVENT_TAGS.has(child.tag))
            .map((child) => normalizeEvent(child, context, recordId)),
        sourceCitations: children(node, 'SOUR').map(normalizeSourceCitation),
        noteReferences: children(node, 'NOTE').map(normalizeNoteReference),
        mediaReferences: children(node, 'OBJE').map(normalizeMediaReference),
        extensions: extensions(node, knownTags, `FAM[${recordId}]`),
    };
}

function normalizeSource(node: GedcomNode): NormalizedSource {
    const knownTags = new Set([
        'DATA',
        'AUTH',
        'TITL',
        'ABBR',
        'PUBL',
        'TEXT',
        'REPO',
        'REFN',
        'RIN',
        'CHAN',
        'NOTE',
        'OBJE',
    ]);

    const titleNode = firstChild(node, 'TITL');
    const authorNode = firstChild(node, 'AUTH');
    const publicationNode = firstChild(node, 'PUBL');

    return {
        id: node.xref ?? '',
        title: titleNode === null ? null : readText(titleNode),
        author: authorNode === null ? null : readText(authorNode),
        publication: publicationNode === null ? null : readText(publicationNode),
        repositoryReferences: children(node, 'REPO')
            .filter((repository) => repository.value !== null && isValidXref(repository.value))
            .map((repository) => ({
                repositoryId: repository.value ?? '',
                callNumber: firstChild(repository, 'CALN')?.value ?? null,
            })),
        noteReferences: children(node, 'NOTE').map(normalizeNoteReference),
        mediaReferences: children(node, 'OBJE').map(normalizeMediaReference),
        extensions: extensions(node, knownTags, `SOUR[${node.xref ?? ''}]`),
    };
}

function normalizeRepository(node: GedcomNode): NormalizedRepository {
    const addressNode = firstChild(node, 'ADDR');
    const knownTags = new Set([
        'NAME',
        'ADDR',
        'PHON',
        'EMAIL',
        'FAX',
        'WWW',
        'NOTE',
        'REFN',
        'RIN',
        'CHAN',
    ]);

    return {
        id: node.xref ?? '',
        name: firstChild(node, 'NAME')?.value ?? null,
        address: addressNode === null ? null : readText(addressNode),
        extensions: extensions(node, knownTags, `REPO[${node.xref ?? ''}]`),
    };
}

function validateRootStructure(roots: GedcomNode[], context: ParserContext): void {
    const headerNodes = roots.filter((node) => node.tag === 'HEAD');
    const trailerNodes = roots.filter((node) => node.tag === 'TRLR');
    const firstRoot = roots[0] ?? null;
    const lastRoot = roots.at(-1) ?? null;

    if (firstRoot?.tag !== 'HEAD' || headerNodes.length !== 1) {
        addError(
            context,
            GedcomDiagnosticCode.MissingHeader,
            'A GEDCOM document must begin with exactly one HEAD record.',
            firstRoot,
        );
    } else if (firstRoot.xref !== null || firstRoot.value !== null) {
        addError(
            context,
            GedcomDiagnosticCode.InvalidHeader,
            'The HEAD record must not have an identifier or value.',
            firstRoot,
        );
    }

    if (lastRoot?.tag !== 'TRLR' || trailerNodes.length !== 1) {
        addError(
            context,
            GedcomDiagnosticCode.MissingTrailer,
            'A GEDCOM document must end with exactly one TRLR record.',
            lastRoot,
        );
    }

    for (const trailer of trailerNodes) {
        if (trailer.xref !== null || trailer.value !== null || trailer.children.length > 0) {
            addError(
                context,
                GedcomDiagnosticCode.InvalidTrailer,
                'The TRLR record must not have an identifier, value, or children.',
                trailer,
            );
        }

        if (roots.indexOf(trailer) !== roots.length - 1) {
            addError(
                context,
                GedcomDiagnosticCode.RecordAfterTrailer,
                'No record may appear after TRLR.',
                roots[roots.indexOf(trailer) + 1] ?? trailer,
            );
        }
    }
}

function indexRecords(roots: GedcomNode[], context: ParserContext): void {
    for (const root of roots) {
        if (!RECORD_TAGS_REQUIRING_IDENTIFIER.has(root.tag)) {
            continue;
        }

        if (root.xref === null) {
            addError(
                context,
                GedcomDiagnosticCode.MissingRecordIdentifier,
                `${root.tag} records require a cross-reference identifier.`,
                root,
            );
            continue;
        }

        const existing = context.recordsById.get(root.xref);

        if (existing !== undefined) {
            addError(
                context,
                GedcomDiagnosticCode.DuplicateRecordIdentifier,
                `Cross-reference identifier ${root.xref} is declared more than once.`,
                root,
                root.xref,
            );
            continue;
        }

        context.recordsById.set(root.xref, root);
    }
}

function expectedReferenceTag(
    node: GedcomNode,
    parent: GedcomNode,
    root: GedcomNode,
): string | null {
    if (parent === root && root.tag === 'FAM') {
        if (node.tag === 'HUSB' || node.tag === 'WIFE' || node.tag === 'CHIL') {
            return 'INDI';
        }
    }

    if (parent === root && root.tag === 'INDI') {
        if (node.tag === 'FAMC' || node.tag === 'FAMS') {
            return 'FAM';
        }

        if (node.tag === 'ALIA' || node.tag === 'ASSO') {
            return 'INDI';
        }
    }

    if (node.tag === 'REPO' && parent.tag === 'SOUR') {
        return 'REPO';
    }

    if (node.tag === 'SUBM' && (parent.tag === 'HEAD' || parent === root)) {
        return 'SUBM';
    }

    return null;
}

function validateReferenceNode(
    node: GedcomNode,
    parent: GedcomNode,
    root: GedcomNode,
    context: ParserContext,
): void {
    const expectedTag = expectedReferenceTag(node, parent, root);
    const mustBePointer = expectedTag !== null;
    const mayBePointer = node.tag === 'SOUR' || node.tag === 'NOTE' || node.tag === 'OBJE';

    if ((mustBePointer || mayBePointer) && node.value?.startsWith('@')) {
        if (!isValidXref(node.value)) {
            addError(
                context,
                GedcomDiagnosticCode.InvalidPointer,
                `${node.tag} contains an invalid pointer.`,
                node,
                root.xref,
                node.tag,
            );
        } else {
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
            } else {
                const actualExpectedTag = expectedTag ?? node.tag;

                if (target.tag !== actualExpectedTag) {
                    addError(
                        context,
                        GedcomDiagnosticCode.ReferenceTypeMismatch,
                        `${node.tag} expects ${actualExpectedTag} but ${node.value} references ${target.tag}.`,
                        node,
                        root.xref,
                        node.tag,
                    );
                }
            }
        }
    } else if (mustBePointer) {
        addError(
            context,
            GedcomDiagnosticCode.InvalidPointer,
            `${node.tag} must contain a GEDCOM pointer.`,
            node,
            root.xref,
            node.tag,
        );
    }

    for (const child of node.children) {
        validateReferenceNode(child, node, root, context);
    }
}

function validateReferences(roots: GedcomNode[], context: ParserContext): void {
    for (const root of roots) {
        for (const child of root.children) {
            validateReferenceNode(child, root, root, context);
        }
    }
}

function validateReverseFamilyLinks(
    individuals: NormalizedIndividual[],
    familiesById: ReadonlyMap<string, NormalizedFamily>,
    context: ParserContext,
): void {
    for (const individual of individuals) {
        for (const link of individual.parentFamilyLinks) {
            const family = familiesById.get(link.familyId);

            if (
                family !== undefined &&
                !family.children.some((child) => child.individualId === individual.id)
            ) {
                addWarning(
                    context,
                    GedcomDiagnosticCode.InconsistentFamilyLink,
                    `${individual.id} references ${link.familyId} through FAMC but is not listed as CHIL.`,
                    context.recordsById.get(individual.id) ?? null,
                    individual.id,
                    'FAMC',
                );
            }
        }

        for (const familyId of individual.partnerFamilyIds) {
            const family = familiesById.get(familyId);

            if (
                family !== undefined &&
                !family.partners.some((partner) => partner.individualId === individual.id)
            ) {
                addWarning(
                    context,
                    GedcomDiagnosticCode.InconsistentFamilyLink,
                    `${individual.id} references ${familyId} through FAMS but is not listed as a partner.`,
                    context.recordsById.get(individual.id) ?? null,
                    individual.id,
                    'FAMS',
                );
            }
        }
    }
}

function hasErrors(diagnostics: GedcomDiagnostic[]): boolean {
    return diagnostics.some((item) => item.severity === GedcomDiagnosticSeverity.Error);
}

export class Gedcom551Parser implements GedcomParser {
    supports(version: SupportedGedcomVersion): boolean {
        return version === '5.5.1';
    }

    parse(file: DetectedGedcomFile): GedcomParseResult {
        if (!this.supports(file.descriptor.version)) {
            return {
                document: null,
                diagnostics: [
                    makeDiagnostic(
                        GedcomDiagnosticSeverity.Error,
                        GedcomDiagnosticCode.UnsupportedParserVersion,
                        `Gedcom551Parser does not support version ${file.descriptor.version}.`,
                        null,
                    ),
                ],
            };
        }

        const tree = buildGedcomTree(file.content);
        const context: ParserContext = {
            diagnostics: [...tree.diagnostics],
            recordsById: new Map(),
        };
        validateRootStructure(tree.roots, context);
        indexRecords(tree.roots, context);
        validateReferences(tree.roots, context);

        if (hasErrors(context.diagnostics)) {
            return { document: null, diagnostics: context.diagnostics };
        }

        const header = tree.roots[0];

        if (header === undefined) {
            return { document: null, diagnostics: context.diagnostics };
        }

        const individualRecords = tree.roots.filter((node) => node.tag === 'INDI');
        const individuals = individualRecords.map((node) => normalizeIndividual(node, context));
        const individualsById = new Map(
            individuals.map((individual) => [individual.id, individual]),
        );
        const families = tree.roots
            .filter((node) => node.tag === 'FAM')
            .map((node) => normalizeFamily(node, context, individualsById));
        const familiesById = new Map(families.map((family) => [family.id, family]));
        validateReverseFamilyLinks(individuals, familiesById, context);

        if (hasErrors(context.diagnostics)) {
            return { document: null, diagnostics: context.diagnostics };
        }

        const sourceNode = firstChild(header, 'SOUR');
        const document: NormalizedGedcomDocument = {
            metadata: {
                version: file.descriptor.version,
                sourceProduct: sourceNode?.value ?? null,
                sourceProductVersion:
                    sourceNode === null ? null : (firstChild(sourceNode, 'VERS')?.value ?? null),
                characterEncoding: file.descriptor.characterEncoding,
                language: firstChild(header, 'LANG')?.value ?? null,
                fileName: firstChild(header, 'FILE')?.value ?? null,
            },
            individuals,
            families,
            sources: tree.roots.filter((node) => node.tag === 'SOUR').map(normalizeSource),
            repositories: tree.roots.filter((node) => node.tag === 'REPO').map(normalizeRepository),
            media: tree.roots.filter((node) => node.tag === 'OBJE').map(normalizeMedia),
            sharedNotes: tree.roots.filter((node) => node.tag === 'NOTE').map(normalizeNote),
            extensions: tree.roots
                .filter(
                    (node) =>
                        !['HEAD', 'TRLR', 'INDI', 'FAM', 'SOUR', 'REPO', 'OBJE', 'NOTE'].includes(
                            node.tag,
                        ),
                )
                .map((node, index) => extension(node, `${node.tag}[${index}]`)),
        };

        return { document, diagnostics: context.diagnostics };
    }
}
