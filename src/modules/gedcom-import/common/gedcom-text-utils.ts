export function splitGedcomLines(content: string): string[] {
    const lines: string[] = [];
    let lineStart = 0;

    for (let index = 0; index < content.length; index += 1) {
        const character = content.charCodeAt(index);

        if (character !== 0x0a && character !== 0x0d) {
            continue;
        }

        lines.push(content.slice(lineStart, index));

        if (character === 0x0d && content.charCodeAt(index + 1) === 0x0a) {
            index += 1;
        }

        lineStart = index + 1;
    }

    if (lineStart < content.length) {
        lines.push(content.slice(lineStart));
    }

    return lines;
}
