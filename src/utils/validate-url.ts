import Axios from 'axios';
import {RecursiveUrlLoader} from "langchain/document_loaders/web/recursive_url";
import { compile } from "html-to-text";


import PQueue from "./p-queue";
import {first} from "./first";

const validateQueue = new PQueue({concurrency: 5})
const contentQueue = new PQueue({concurrency: 5})

export const isValidUrl = async (url: string): Promise<{isValid: boolean, content?: string | Buffer}> => {
    return (await validateQueue.add(() => Axios.get(url, {timeout: 5000})
        .then(response => {
            return {
                isValid: true,
                content: undefined,
            }
        })
        .then(async (data) => {
            if (!data.isValid) {
                return data;
            }

            return {
                isValid: true,
                content: await getUrlContent(url)
            }
        })
        .then(data => ({
            content: data.content,
            isValid: data.content != 'Please enable JS and disable any ad blocker'
        }))
        .catch(err => ({isValid: false})))) || {isValid: false}
}

export const getUrlContent = async (url: string, content?: string | Buffer): Promise<string | Buffer> => {
    if (content) {
        return content;
    }

    const compiledConvert = compile({
        wordwrap: 130,
        selectors: [
            { selector: 'a', format: 'skip' },
        ]
    }); // returns (text: string) => string;

    return (await contentQueue.add(async () => {
        const loader = new RecursiveUrlLoader(url, {
            maxDepth: 0,
            extractor: compiledConvert,
        });

        const doc = first(await loader.load().catch(() => []));

        return (doc?.pageContent || '').replace(/\n+/g, '\n')
    })) as Buffer | string
}
