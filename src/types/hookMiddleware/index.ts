import {DocumentNode} from 'graphql';
import { JsonObject } from 'type-fest';
import {HasuraDataConfig} from '../../types/hasuraConfig';

export interface QueryMiddleware {
  (
    state: QueryPreMiddlewareState,
    config: HasuraDataConfig,
  ): QueryPostMiddlewareState;
}

export interface QueryPreMiddlewareState {
  document?: DocumentNode;
  variables: JsonObject;
  operationName?: string;
}

export interface QueryPostMiddlewareState {
  document: DocumentNode;
  variables: JsonObject;
  operationName: string;
  warnings?: string[]
}
