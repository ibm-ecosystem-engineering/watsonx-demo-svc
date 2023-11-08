export const stripUrls = (text: string): string => {
    return text
        .replace(/https?:\/\/[\n\S]+/g, '')
        .replace(/[0-9A-Za-z]+\/[0-9A-Za-z]+\/[0-9A-Za-z\/]+/, '')
        .replace(/([ (])\/[0-9A-Za-z\/]+/, '$1')
}
