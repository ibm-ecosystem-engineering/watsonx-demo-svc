import {Field, ObjectType} from "@nestjs/graphql";

import {FormOptionModel} from "../models";

@ObjectType({description: 'Object representing a key/value pair'})
export class FormOption implements FormOptionModel {
    @Field()
    text: string;
    @Field()
    value: string;
}
