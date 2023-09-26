import {Module} from '@nestjs/common';
import {GraphQLModule} from "@nestjs/graphql";
import {ApolloDriver, ApolloDriverConfig} from "@nestjs/apollo";

import {controllers} from './controllers';
import {ResolverModule} from "./resolvers";
import {ServiceModule} from "./services";
import {CaseProcessorHook} from "./lifecycle";

const imports = [
    GraphQLModule.forRoot<ApolloDriverConfig>({
        driver: ApolloDriver,
        autoSchemaFile: 'schema.gql',
        sortSchema: true,
        subscriptions: {
            'graphql-ws': {
                path: '/subscription'
            },
        },
    }),
    ServiceModule,
    ResolverModule,
]

@Module({
    imports,
    controllers,
    providers: [CaseProcessorHook]
})
export class AppModule {}
