import {UserOptions} from "ibm-cloud-sdk-core";
import DiscoveryV2 = require("ibm-watson/discovery/v2");
import PQueue from "./p-queue";

const queue = new PQueue({concurrency: 4});

export const createDiscoveryV2 = async (options: UserOptions): Promise<DiscoveryV2> => {
    const discovery = new DiscoveryV2(options);

    const originalQuery = discovery.query.bind(discovery);

    discovery.query = (...args) => {
        console.log('Queued discovery query')

        return queue.add(() => originalQuery(...args))
    }

    return discovery;
}
