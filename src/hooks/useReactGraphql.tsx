import { JsonObject } from 'type-fest';
import { HasuraDataConfig } from '../types/hasuraConfig';
import { QueryMiddleware } from '../types/hookMiddleware';
import { useInfiniteQueryMany } from './useInfiniteQueryMany';
import { createInfiniteQueryMany } from './useInfiniteQueryMany.utils';
import { useMutate } from './useMutate';
import {
  createDeleteMutation,
  createInsertMutation,
  createUpdateMutation
} from './useMutate.utils';
import { useQueryOne } from './useQueryOne';
import { createQueryOne } from './useQueryOne.utils';

export function useReactGraphql(config: HasuraDataConfig) {
  return {
    useInsert: (props?: {
      initialVariables?: JsonObject;
      middleware?: QueryMiddleware[];
      listKey?: string;
      firstOrLast?: 'insert-first' | 'insert-last';
    }) =>
      useMutate({
        sharedConfig: config,
        middleware: props?.middleware || [createInsertMutation],
        initialVariables: props?.initialVariables,
        operationEventType: props?.firstOrLast ?? 'insert-first',
        listKey: props?.listKey,
      }),

    useDelete: (props: {
      variables: JsonObject;
      middleware?: QueryMiddleware[];
      listKey?: string;
    }) =>
      useMutate({
        sharedConfig: config,
        middleware: props.middleware || [createDeleteMutation],
        initialVariables: props.variables,
        operationEventType: 'delete',
        listKey: props.listKey,
      }),

    useUpdate: (props?: {
      initialVariables?: JsonObject;
      middleware?: QueryMiddleware[];
      listKey?: string;
    }) =>
      useMutate({
        sharedConfig: config,
        middleware: props?.middleware || [createUpdateMutation],
        initialVariables: props?.initialVariables,
        operationEventType: 'update',
        listKey: props?.listKey,
      }),

    useInfiniteQueryMany: function<TData>(props?: {
      where?: {[key: string]: any};
      orderBy?: {[key: string]: any} | Array<{[key: string]: any}>;
      pageSize?: number;
      middleware?: QueryMiddleware[];
      listKey?: string;
    }) {
      return useInfiniteQueryMany<TData>({
        where: props?.where,
        orderBy: props?.orderBy,
        sharedConfig: config,
        middleware: props?.middleware || [createInfiniteQueryMany],
        listKey: props?.listKey,
      })
    },
    useQueryOne: (props: {
      variables: JsonObject;
      middleware?: QueryMiddleware[];
    }) =>
      useQueryOne({
        sharedConfig: config,
        middleware: props?.middleware || [createQueryOne],
        variables: props.variables,
      }),
  };
}
