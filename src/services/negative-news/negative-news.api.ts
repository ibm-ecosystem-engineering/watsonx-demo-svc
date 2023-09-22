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
    title: string;
    link: string;
    source: string;
    snippet: string;
    date: string;
    negativeNewsTopics?: string[];
    hasNegativeNews?: boolean;
    summary?: string;
}

export abstract class NegativeNewsApi {
    abstract screenPerson(person: PersonModel): Promise<NewsScreeningResultModel>;
    abstract validateUrl<T extends { link: string }, R extends T & { isValid: boolean }>(data: T): Promise<R>;
}

