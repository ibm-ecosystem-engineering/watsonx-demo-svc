export const stripUrls = (text: string): string => {
    return text.replace(/https?:\/\/[\n\S]+/g, '');;
}
