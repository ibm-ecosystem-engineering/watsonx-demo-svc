import {CloudantV1} from "@ibm-cloud/cloudant";
import {BehaviorSubject, Observable, Subject} from "rxjs";

import {KycCaseManagementApi} from "./kyc-case-management.api";
import {
    ApproveCaseModel,
    createNewCase,
    CustomerModel,
    CustomerRiskAssessmentModel,
    DocumentContent,
    DocumentModel,
    DocumentRef,
    DocumentStream,
    isDocumentContent,
    isDocumentRef,
    KycCaseChangeEventModel,
    KycCaseChangeType,
    KycCaseModel,
    KycCaseSummaryModel,
    NegativeScreeningModel,
    ReviewCaseModel
} from "../../models";
import {CloudantBackendConfig, cloudantClient} from "./cloudant.backend";
import Stream, {Readable} from "stream";
import {first, streamToBuffer, urlToStream} from "../../utils";
import {documentManagerApi, DocumentManagerApi} from "../document-manager";
import {getType} from "mime";

interface CloudantKycCaseModel extends KycCaseModel {
    _rev: string;
}

interface CloudantDocumentModel extends DocumentModel {
    _rev: string;
}

interface DocumentRefModel {
    id: string;
    _rev: string;
    name: string;
    path: string;
}

const asCloudantDoc = <T extends {id: string, _rev?: string}, R extends (Omit<T, 'id'> & {_id: string})> (input: T): R => {
    const _id = input.id;

    delete input.id

    return Object.assign({}, input, {_id}) as any
}

const asObject = <T extends {id: string, _rev: string} = any> (response: CloudantV1.Response<CloudantV1.Document>): T => {
    return Object.assign(
        {},
        response.result,
        {
            id: response.result._id,
            _rev: response.result._rev
        }) as T
}

const kycCaseDatabase = 'kyc-case';
const kycCaseDocumentDatabase = 'kyc-case-document';
const databases = {};

export class KycCaseManagementCloudant implements KycCaseManagementApi {
    client: CloudantV1;
    subject: Subject<KycCaseModel[]>;
    changeSubject: Subject<KycCaseChangeEventModel>;

    constructor(
        private readonly documentManagerService: DocumentManagerApi = documentManagerApi(),
        config: CloudantBackendConfig
    ) {
        this.client = cloudantClient(config);
        this.subject = new Subject<KycCaseModel[]>();
        this.changeSubject = new Subject<KycCaseChangeEventModel>();

        this.changeSubject.subscribe({
            next: () => {
                this.listCases()
                    .catch(err => console.error('Error listing cases: ', {err}));
            }
        })
    }

    async getDatabase(db: string): Promise<string> {
        if (databases[db]) {
            return db;
        }

        return this.client
            .putDatabase({db})
            .then(() => {
                // TODO create design document

                databases[db] = true;
                return db;
            })
            .catch(err => {
                if (err.code === 412) {
                    databases[db] = true;
                    return db;
                }

                console.error('Error creating database: ', {err});

                throw err;
            })
    }

    notifyKycCases(event: KycCaseChangeType = 'updated') {
        return (kycCase: KycCaseModel): KycCaseModel => {
            this.changeSubject.next({kycCase, event: 'updated'});

            return kycCase;
        }
    }

    async listCases(): Promise<KycCaseModel[]> {
        const db = await this.getDatabase(kycCaseDatabase)

        return this.client
            .postAllDocs({
                db,
                includeDocs: true,
            })
            .then(response => response.result.rows
                    .map(val => Object.assign({}, val.doc, {id: val.id}) as KycCaseModel)
            )
            .then(cases => cases.map(val => Object.assign(val, {status: val.status || 'New'})))
            .then(cases => {
                this.subject.next(cases);

                return cases;
            })
    }

    subscribeToCases(skipQuery?: boolean): Observable<KycCaseModel[]> {
        if (!skipQuery) {
            this.listCases()
                .catch(err => console.error('Error retrieving cases: ', err))
        }

        return this.subject;
    }

    async createCase(customer: CustomerModel): Promise<KycCaseModel> {
        const db = await this.getDatabase(kycCaseDatabase);

        const document = createNewCase(customer);

        return this.client
            .postDocument({
                db,
                document
            })
            .then(response => {
                const result = response.result;

                if (result.ok) {
                    return Object.assign({}, document, {id: result.id})
                }

                throw new Error('Error creating case: ' + result.error);
            })
            .then(this.notifyKycCases('created').bind(this))
    }

    async getCase(docId: string): Promise<CloudantKycCaseModel> {
        const db = await this.getDatabase(kycCaseDatabase);

        return this.client
            .getDocument({
                db,
                docId
            })
            .then(asObject)
            .then(kycCase => Object.assign(kycCase, {status: kycCase.status || 'New'}))
    }

    async addDocumentToCase(caseId: string, documentName: string, document: DocumentRef | DocumentContent | DocumentStream, pathPrefix?: string): Promise<DocumentModel> {
        const db = await this.getDatabase(kycCaseDatabase);
        const docDb = await this.getDatabase(kycCaseDocumentDatabase);

        const currentCase: CloudantKycCaseModel = await this.getCase(caseId);

        const content = await this.loadDocument(document);

        const newDoc = await this.documentManagerService.uploadFile({
            name: documentName,
            parentId: caseId,
            content: {buffer: content},
            context: 'kyc-case',
        });

        const caseDoc = Object.assign({}, newDoc, {path: `${pathPrefix}${newDoc.path}`, content: Buffer.from('')});

        currentCase.documents.push(caseDoc)

        const stream = new Readable();
        stream.push(content);
        stream.push(null);

        const updatedCase = await this.client
            .postDocument({
                db,
                document: asCloudantDoc(currentCase)
            })
            .catch(err => {
                console.error('Error updating case: ', {err, currentCase, cloudantCase: asCloudantDoc(currentCase)});

                throw err;
            });

        const cloudantDoc = await this.client
            .postDocument({
                db: docDb,
                document: asCloudantDoc({id: caseDoc.id, name: caseDoc.name, path: caseDoc.path})
            })
            .catch(err => {
                console.error('Error creating document: ', {err, caseDoc});

                throw err;
            });

        const documentAttachment = await this.client
            .putAttachment({
                db: docDb,
                docId: cloudantDoc.result.id,
                attachmentName: caseDoc.name,
                attachment: stream,
                contentType: getType(caseDoc.name),
                rev: cloudantDoc.result.rev,
            })
            .catch(err => {
                console.error('Error adding attachment: ', {err})
            });

        return caseDoc;
    }

    async loadDocument(document: DocumentRef | DocumentContent | DocumentStream): Promise<Buffer> {
        if (isDocumentContent(document)) {
            return document.content;
        }

        const stream: Stream = isDocumentRef(document)
            ? await urlToStream(document.url)
            : document.stream;

        return streamToBuffer(stream);
    }

    async removeDocumentFromCase(caseId: string, documentId: string): Promise<KycCaseModel> {
        const db = await this.getDatabase(kycCaseDatabase);
        const docDb = await this.getDatabase(kycCaseDocumentDatabase);

        const currentCase: CloudantKycCaseModel = await this.getCase(caseId);

        const documentIndex: number = currentCase.documents.map(val => val.id).indexOf(documentId);

        const toDelete: DocumentModel = first(currentCase.documents.splice(documentIndex, 1));

        await this.client
            .deleteDocument({
                db: docDb,
                docId: documentId
            })
            .then(() => this.client
                .postDocument({
                    db,
                    document: asCloudantDoc(currentCase)
                })
            )
            .then(result => this.notifyKycCases('updated')(Object.assign(
                {},
                currentCase,
                {_rev: result.result.rev, id: result.result.id}))
            )

        return currentCase;
    }

    async getDocument(id: string): Promise<CloudantDocumentModel> {
        const db = await this.getDatabase(kycCaseDocumentDatabase);

        console.log('Looking up document: ', id);

        const doc: DocumentRefModel = await this.client
            .getDocument({
                db,
                docId: id
            })
            .catch(err => {
                console.error('Error retrieving document record: ', {err, id});

                throw err;
            })
            .then(asObject)

        const stream = await this.client
            .getAttachment({
                db,
                docId: doc.id,
                rev: doc._rev,
                attachmentName: doc.name
            })
            .catch(err => {
                console.error('Error retrieving attachment: ', {err, name: doc.name, id});

                throw err;
            })
            .then(response => response.result)

        return Object.assign(
            {},
            doc,
            {content: await streamToBuffer(stream)});
    }

    async reviewCase(reviewCase: ReviewCaseModel): Promise<KycCaseModel> {
        const currentCase: CloudantKycCaseModel = await this.getCase(reviewCase.id);

        const status = reviewCase.customerOutreach ? 'CustomerOutreach' : 'Pending';

        Object.assign(currentCase, reviewCase, {status});

        return this.updateCase(currentCase)
    }

    async updateCase(currentCase: CloudantKycCaseModel): Promise<KycCaseModel> {
        const db = await this.getDatabase(kycCaseDatabase);

        return this.client
            .postDocument({
                db,
                document: asCloudantDoc(currentCase)
            })
            .then(response => {
                const result = response.result;

                if (result.ok) {
                    return Object.assign({}, currentCase, {id: result.id})
                }

                throw new Error('Error creating case: ' + result.error);
            })
            .then(this.notifyKycCases('updated').bind(this))
    }

    async approveCase(approve: ApproveCaseModel): Promise<KycCaseModel> {
        const currentCase: CloudantKycCaseModel = await this.getCase(approve.id);

        const status = approve.customerOutreach ? 'CustomerOutreach' : 'Pending';

        Object.assign(currentCase, approve, {status});

        return this.updateCase(currentCase)
    }

    async processCase(docId: string): Promise<KycCaseModel> {
        const kycCase: CloudantKycCaseModel = await this.getCase(docId);

        Object.assign(kycCase, {
            status: 'Pending',
            negativeScreeningComplete: false,
            counterpartyNegativeScreeningComplete: false,
            customerRiskAssessmentComplete: false,
            caseSummaryComplete: false,
        })

        return this.updateCase(kycCase);
    }

    async deleteCase(docId: string): Promise<KycCaseModel> {
        const kycCase: CloudantKycCaseModel = await this.getCase(docId);

        await this.client
            .deleteDocument({
                db: kycCaseDatabase,
                docId,
                rev: kycCase._rev
            })
            .then(result => {
                this.changeSubject.next({kycCase, event: 'deleted'})
            })

        return kycCase;
    }

    async updateCaseSummary(docId: string, caseSummary: KycCaseSummaryModel): Promise<KycCaseModel> {
        const currentCase: CloudantKycCaseModel = await this.getCase(docId);

        Object.assign(
            currentCase,
            {
                caseSummary,
                caseSummaryComplete: true,
                status: this.getUpdatedStatus(currentCase),
            });

        return this.updateCase(currentCase)
    }

    async updateCounterpartyNegativeNews(docId: string, counterpartyNegativeScreening: NegativeScreeningModel): Promise<KycCaseModel> {
        const currentCase: CloudantKycCaseModel = await this.getCase(docId);

        Object.assign(
            currentCase,
            {
                counterpartyNegativeScreening,
                counterpartyNegativeScreeningComplete: true,
                status: this.getUpdatedStatus(currentCase),
            });

        return this.updateCase(currentCase)
    }

    async updateCustomerRiskAssessment(docId: string, customerRiskAssessment: CustomerRiskAssessmentModel): Promise<KycCaseModel> {
        const currentCase: CloudantKycCaseModel = await this.getCase(docId);

        Object.assign(
            currentCase,
            {
                customerRiskAssessment,
                customerRiskAssessmentComplete: true,
                status: this.getUpdatedStatus(currentCase),
            });

        return this.updateCase(currentCase)
    }

    async updateNegativeNews(docId: string, negativeScreening: NegativeScreeningModel): Promise<KycCaseModel> {
        const currentCase: CloudantKycCaseModel = await this.getCase(docId);

        Object.assign(
            currentCase,
            {
                negativeScreening,
                negativeScreeningComplete: true,
                status: this.getUpdatedStatus(currentCase),
            });

        return this.updateCase(currentCase)
    }

    getUpdatedStatus(kycCase: KycCaseModel): string {
        if (kycCase.status !== 'Pending') {
            return kycCase.status;
        }

        return kycCase.caseSummaryComplete && kycCase.negativeScreeningComplete && kycCase.counterpartyNegativeScreeningComplete && kycCase.customerRiskAssessmentComplete
            ? 'Completed'
            : 'Pending';
    }

    watchCaseChanges(): Observable<KycCaseChangeEventModel> {
        return this.changeSubject;
    }

    watchCase(id: string): Observable<KycCaseModel> {
        const subject: BehaviorSubject<KycCaseModel> = new BehaviorSubject<KycCaseModel>(undefined);

        this.getCase(id).then(kycCase => {
            subject.next(kycCase);

            this.changeSubject.subscribe({
                next: event => {
                    if (event.kycCase.id === id) {
                        subject.next(event.kycCase);
                    }
                }
            })
        });

        return subject;
    }

    async listDocuments(): Promise<DocumentModel[]> {
        const db = await this.getDatabase(kycCaseDocumentDatabase)

        return this.client
            .postAllDocs({
                db,
                includeDocs: true,
            })
            .then(response => response.result.rows
                .map(val => Object.assign({}, val.doc, {id: val.id}) as DocumentModel)
            )
    }

    async deleteDocument(docId: string): Promise<DocumentModel> {
        const doc: CloudantDocumentModel = await this.getDocument(docId);

        await this.client
            .deleteDocument({
                db: kycCaseDocumentDatabase,
                docId,
                rev: doc._rev
            })

        return doc;
    }
}