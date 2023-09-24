import {NegativeScreeningModel, PersonModel} from "../../models";

export abstract class NegativeNewsApi {
    abstract screenPerson(person: PersonModel): Promise<NegativeScreeningModel>;
    abstract validateUrl<T extends { link: string }, R extends T & { isValid: boolean }>(data: T): Promise<R>;
}

