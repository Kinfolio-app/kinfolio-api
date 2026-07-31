import type { GedcomNode, NormalizedExtension } from './gedcom-parser.types.js';

export function childNodes(node: GedcomNode, tag: string): GedcomNode[] {
    return node.children.filter((child) => child.tag === tag);
}

export function firstChild(node: GedcomNode, tag: string): GedcomNode | null {
    return node.children.find((child) => child.tag === tag) ?? null;
}

export function readContinuedText(node: GedcomNode): string {
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

export type ExtensionUriResolver = (node: GedcomNode) => string | null;

export function normalizeExtension(
    node: GedcomNode,
    path: string,
    resolveUri: ExtensionUriResolver = () => null,
): NormalizedExtension {
    return {
        tag: node.tag,
        uri: resolveUri(node),
        value: node.value,
        path,
        location: node.location,
        children: node.children.map((child, index) =>
            normalizeExtension(child, `${path}.${child.tag}[${index}]`, resolveUri),
        ),
    };
}

export function normalizeExtensions(
    node: GedcomNode,
    knownTags: ReadonlySet<string>,
    path: string,
    resolveUri: ExtensionUriResolver = () => null,
): NormalizedExtension[] {
    return node.children
        .filter((child) => !knownTags.has(child.tag))
        .map((child, index) =>
            normalizeExtension(child, `${path}.${child.tag}[${index}]`, resolveUri),
        );
}
