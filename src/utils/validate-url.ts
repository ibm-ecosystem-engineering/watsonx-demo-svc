import Axios from 'axios';
import PQueue from "./p-queue";

const validateQueue = new PQueue({concurrency: 5})

export const isValidUrl = async (url: string): Promise<{isValid: boolean, content?: string | Buffer}> => {
    return (await validateQueue.add(() => Axios.get(url)
        .then(response => ({
            isValid: true,
            content: response.data
        }))
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

    return validateQueue.add(() => Axios.get(url)
        .then(response => response.data))
}
