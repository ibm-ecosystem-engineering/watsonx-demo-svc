import Axios from 'axios';
import {RecursiveUrlLoader} from "langchain/dist/document_loaders/web/recursive_url";

import PQueue from "./p-queue";
import {first} from "./first";

const validateQueue = new PQueue({concurrency: 5})

export const isValidUrl = async (url: string): Promise<{isValid: boolean, content?: string | Buffer}> => {
    return (await validateQueue.add(() => Axios.get(url)
        .then(response => ({
            isValid: true,
            content: undefined,
        }))
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

    return validateQueue.add(async () => {
        const loader = new RecursiveUrlLoader(url, {maxDepth: 1});

        const doc = first(await loader.load());

        return doc?.pageContent || ''
    }) as Promise<string | Buffer>
}
