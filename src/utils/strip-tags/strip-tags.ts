import {JSDOM} from 'jsdom'

export const stripTags = (text: string): string => {
    const dom: JSDOM = new JSDOM(text);

    return dom.window.document.body.textContent || '';
}
