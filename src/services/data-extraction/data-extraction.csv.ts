import {BehaviorSubject, Observable} from "rxjs";
import {promises} from 'fs';
import {join, resolve} from 'path';

import {DataExtractionApi} from "./data-extraction.api";
import {DataExtractionQuestionModel, DataExtractionResultModel} from "../../models";
import {first, parseCsv} from "../../utils";

const csvFile: string = `ID,Question,PoCScope,Company,Prompt,Expected Answer,watsonx Response
1,What is Name and trading name of the organization?,,,,,
2,What is the registered address of the company?,X,BP P.L.C,from below text find the registered address of the company #?,"1 St James's Square, London, SW1Y 4PD","1 St James's Square, London, SW1Y 4PD"
3,What is the business/trading address of the company?,,,,,
4,What is identification number of the organization?,X,BP P.L.C,from below text find  identification number of the organization #? ,102498,102498
5,Who are the key controllers and authorized signatories?,,,,,
6,Names all the active directors of the company.,X,BP P.L.C,"from below text, find the names of active directors of the company # in sequence ?","LUND, Helge BLANC, Amanda Jayne DALEY, Pamela","LUND, Helge BLANC, Amanda Jayne DALEY, Pamela"
7,"What is the status of the organization ex; active, dissolved?",X,BP P.L.C,"from below text, what is the status of the organization # ?",Active,Active
8,What is the year of incorporation?,X,BP P.L.C,"from below text, What is the year of incorporation of #?",1909,1909
9,Who are the shareholders of the company along with the percentage of ownership?,,,,,
10,Who is the ultimate owner of the company?,,,,,
11,Who are the key controllers and authorized signatories?,,,,,
12,What is the industry type/SIC/NICS code of the company?,,,,,
13,What are the products utilized by the company?,,,,,
14,What is/are operation location/s or jurisdiction/s?,,,,,
15,Number of employees of the firm,,,,,
16,Name of the subsidiary of the company,,,,,
17,What is the Legal entity Type of the organization ex; publicly traded/limited liability etc.,,,,,
18,What is the turnover or revenue of the organization?,,,,,
19,Certificate/licence issued by the government.,,,,,
20,Whats is the next date of confirmation statement?,X,BP P.L.C,"from below text, find the next date of confirmation statement for company #?",30/06/24,30/06/24`

export interface DataExtractionConfig extends DataExtractionQuestionModel {
    expectedResponse: string;
    prompt: string;
}

let data: Promise<DataExtractionConfig[]>;

export abstract class DataExtractionCsv<A> extends DataExtractionApi {

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
                        inScope: values[2] === 'X',
                        prompt: values[4],
                        expectedResponse: '' + values[5]
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

        const extractDataForQuestion = (question: DataExtractionQuestionModel) => {
            return this.extractDataForQuestionInternal(customer, question, auth);
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

        this.getBackends().then((auth: A) => {
            questions
                .map(question => this.extractDataForQuestionInternal(customer, question, auth))
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

        return this.extractDataForQuestionInternal(customer, question, auth);
    }

    abstract getBackends(): Promise<A>;

    abstract
    abstract extractDataForQuestionInternal(customer: string, question: {id: string}, backends: A): Promise<DataExtractionResultModel>;

}