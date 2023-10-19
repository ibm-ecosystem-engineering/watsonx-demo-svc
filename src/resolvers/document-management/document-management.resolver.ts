import {Args, Query, Resolver} from "@nestjs/graphql";

import {DocumentOutput, ListDocumentInput} from "../../graphql-types";
import {DocumentManagerApi, DocumentOutputModel} from "../../services";

@Resolver(() => [DocumentOutput])
export class DocumentManagementResolver {
    constructor(private readonly service: DocumentManagerApi) {
    }

    @Query(() => [DocumentOutput])
    async listFiles(
        @Args('input', {nullable: true}) input: ListDocumentInput = {}
    ) {

        return this.service
            .listFiles(input)
            .then((docs: DocumentOutputModel[]) => docs.map(doc => Object.assign(
                doc,
                {path: `document/${doc.id}/${doc.name}`})
            ));
    }
}
