import {PersonModel} from "../../models";

export interface NewsScreeningResultModel {
    subject: string;
    totalScreened: number;
    negativeNews: NewsItemModel[];
    nonNegativeNews: NewsItemModel[];
    unrelatedNews: NewsItemModel[];
    summary: string;
}

export interface NewsItemModel {
    topic: string;
    url: string;
}

export abstract class NegativeNewsApi {
    abstract screenPerson(person: PersonModel): Promise<NewsScreeningResultModel>;
}
