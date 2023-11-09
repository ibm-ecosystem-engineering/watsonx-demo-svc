import {BehaviorSubject, Observable} from "rxjs";
import {promises} from 'fs';
import {join, resolve} from 'path';

import {DataExtractionApi} from "./data-extraction.api";
import {DataExtractionQuestionModel, DataExtractionResultModel} from "../../models";
import {first, parseCsv} from "../../utils";

const csvFile: string = `ID,Question,Source,Model,Token,PoCScope,Company,Prompt,Expected Answer,Cosine Prompt
1,What is name and trading name of the organization?,Discovery,meta-llama/llama-2-70b-chat,20,X,,"From below text, what is name and trading name of the organization #?",,"What is name and trading name of #?"
2,What is the registered address of the company?,Discovery,google/flan-t5-xxl,20,X,BP P.L.C,"From below text, find the Registered address of the Company # ?","1 St James's Square, London, SW1Y 4PD","What is the Registered office address of company # ?"
3,What is the business/trading address of the company?,Discovery,google/flan-t5-xxl,20,,,"From below text, what is the business / trading address of the company #?",,"What is the business / trading address of #?"
4,What is identification number of the organization?,Discovery,google/flan-t5-xxl,20,X,BP P.L.C,from below text find  identification number of the organization #?,102498,
5,Who are the key controllers and authorized signatories?,KYCSummary,meta-llama/llama-2-70b-chat,30,,,"from below text, Who are the key controllers and authorized signatories of the company #?",,
6,Names all the active directors of the company.,KYCSummary,meta-llama/llama-2-70b-chat,30,X,BP P.L.C,"from below text, find the names of all active directors of the company # in sequence ?","LUND, Helge BLANC, Amanda Jayne DALEY, Pamela",
7,"What is the status of the organization ex; active, dissolved?",Discovery,google/flan-t5-xxl,20,X,BP P.L.C,"from below text, what is the status of the organization # ex: Active or Dissolved ?",Active,
8,What is the year of incorporation?,Discovery,google/flan-t5-xxl,20,X,BP P.L.C,"from below text, What is the year of incorporation of the company #? if there is no answer then reepond as No content avilable",1909,"What is the year of incorporation of company #?"
9,Who are the shareholders of the company along with the percentage of ownership?,Discovery,google/flan-t5-xxl,20,,,"from below text, Who are the shareholders of the company # along with the percentage of ownership?",,
10,Who is the ultimate owner of the company?,KYCSummary,meta-llama/llama-2-70b-chat,30,,,"from below text, Who is the ultimate owner of the company #?",,
11,Who are the key controllers and authorized signatories?,KYCSummary,meta-llama/llama-2-70b-chat,30,,,"from below text, Who are the key controllers and authorized signatories of the company #?",,
12,What is the industry type/SIC/NICS code of the company?,KYCSummary,google/flan-t5-xxl,20,X,,"from below text, What is the industry type/SIC/NICS code of the company #?",,"What is the industry type/SIC/NICS code of the company #?"
13,What are the products utilized by the company?,KYCSummary,google/flan-ul2,20,X,,"from below text, What are the products manufactured by the company #?",,
14,What is/are operation location/s or jurisdiction/s?,Discovery,google/flan-t5-xxl,20,,,"from below text, What is/are operation location/s or jurisdiction/s of the comoany #?",,
15,Number of employees of the firm,KYCSummary,meta-llama/llama-2-70b-chat,30,,,"from below text, find the Number of employees of the company #?",,
16,Name of the subsidiary of the company,Discovery,google/flan-t5-xxl,20,,,"from below text, find the Name of the subsidiary of the company #?",,
17,What is the Legal entity Type of the organization ex; publicly traded/limited liability etc.,Discovery,google/flan-t5-xxl,30,X,,"from below text, What is the Legal entity Type of the organization # ex; Public limited or publicly traded or limited liability or Private limited? etc.",,
18,What is the turnover or revenue of the organization?,KYCSummary,meta-llama/llama-2-70b-chat,30,X,,"from below text, find the turnover or revenue of the organization #?",,
19,Certificate/licence issued by the government.,Discovery,google/flan-t5-xxl,20,,,"from below text, What is the Certificate/licence issued by the government for company #?",,
20,Whats is the next date of confirmation statement?,Discovery,google/flan-t5-xxl,30,X,BP P.L.C,"from below text, find the next date of confirmation statement for company #?",30/06/24,"Whats is the next date of confirmation statement of $?"`

export interface DataExtractionConfig extends DataExtractionQuestionModel {
    source: string;
    model: string;
    tokens: number;
    expectedResponse: string;
    prompt: string;
    cosinePrompt: string;
}

let data: Promise<DataExtractionConfig[]>;

export abstract class DataExtractionCsv<A, C> extends DataExtractionApi {

    async getCsvData(): Promise<DataExtractionConfig[]> {
        if (data) {
            return data
        }

        const curPath = resolve(__dirname)

        return data = new Promise<string>(
            resolve => {
                const filepath = join(curPath, '../../../..', 'config/KYCDataValidationQuestions.csv')

                promises.readFile(filepath)
                    .then(buf => {
                        resolve(buf.toString())
                    })
                    .catch(err => {
                        resolve(csvFile);
                    });
            })
            .then((fileContent: string) => {
                return fileContent
                    .split('\n')
                    .map(parseCsv)
                    .map(values => ({
                        id: '' + values[0],
                        question: '' + values[1],
                        source: values[2],
                        model: values[3],
                        tokens: values[4],
                        inScope: values[5] === 'X',
                        prompt: values[7],
                        expectedResponse: '' + values[8],
                        cosinePrompt: '' + values[9],
                    }))
                    .filter(val => val.id !== 'ID');
            })

    }

    async listQuestions(): Promise<DataExtractionQuestionModel[]> {
        return (await this.getCsvData())
            .map(val => ({id: val.id, question: val.question, inScope: val.inScope}));
    }

    async extractData(customer: string, questions: Array<{id: string}>): Promise<DataExtractionResultModel[]> {
        const auth: A = await this.getBackends();

        const context: C = await this.getContext(auth, customer, questions);

        const extractDataForQuestion = async (question: DataExtractionQuestionModel) => {
            return this.extractDataForQuestionInternal(customer, question, auth, context)
                .catch(err => {
                    console.error(`Error retrieving question for customer (${customer}: ${question}`, {err})

                    return Object.assign({}, question, {watsonxResponse: '<Error>'});
                });
        }

        return Promise.all(questions.map(extractDataForQuestion.bind(this)))
    }

    async emptyDataExtractionResults(questions: Array<{id: string}>): Promise<DataExtractionResultModel[]> {
        const ids = questions.map(q => q.id);

        return (await this.getCsvData())
            .filter(val => ids.includes(val.id))
            .map(val => Object.assign({}, val, {watsonxResponse: ''}))
    }

    extractDataObservable(customer: string, questions: Array<{id: string}>): Observable<DataExtractionResultModel[]> {
        const subject: BehaviorSubject<DataExtractionResultModel[]> = new BehaviorSubject([]);

        this.emptyDataExtractionResults(questions).then(result => subject.next(result))

        this.getBackends().then(async (auth: A) => {
            const context = await this.getContext(auth, customer, questions);

            questions
                .map(question => this.extractDataForQuestionInternal(customer, question, auth, context))
                .map(promise => promise.then((result: DataExtractionResultModel) => {
                    const currentResults: DataExtractionResultModel[] = subject.value;

                    const previousResult: DataExtractionResultModel | undefined = first(currentResults.filter(val => val.id === result.id))
                    if (previousResult) {
                        previousResult.watsonxResponse = result.watsonxResponse;
                    }

                    return subject.next(currentResults)
                }));
        })

        return subject;
    }

    async extractDataForQuestion(customer: string, question: {id: string}): Promise<DataExtractionResultModel> {
        const auth: A = await this.getBackends();

        const context: C = await this.getContext(auth, customer, [question])

        return this.extractDataForQuestionInternal(customer, question, auth, context);
    }

    abstract getBackends(): Promise<A>;

    abstract extractDataForQuestionInternal(customer: string, question: {id: string}, backends: A, context: C): Promise<DataExtractionResultModel>;

    abstract getContext(auth: A, subject: string, questions: Array<{id: string}>): Promise<C>;
}