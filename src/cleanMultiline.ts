export function cleanMultiline(content: string) {
    return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '')
        .join('\n');
}