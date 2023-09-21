import Axios from 'axios';
import PQueue from "./p-queue";

const validateQueue = new PQueue({concurrency: 5})

export const isValidUrl = async (url: string): Promise<boolean> => {
    return (await validateQueue.add(() => Axios.get(url)
        .then(response => true)
        .catch(err => false))) || false
}
