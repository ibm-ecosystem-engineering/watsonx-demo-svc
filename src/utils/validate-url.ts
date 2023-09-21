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
