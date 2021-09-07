import { JsonObject } from 'type-fest';
import { OperationContext, RequestPolicy } from 'urql';
import { HasuraDataConfig } from '../types/hasuraConfig';
import { QueryMiddleware } from '../types/hookMiddleware';
import { IUseInfiniteQueryManyResults, useInfiniteQueryMany } from './useInfiniteQueryMany';
import { createInfiniteQueryMany } from './useInfiniteQueryMany.utils';
import { MutateState, useMutate } from './useMutate';
import { DeleteJsonBMutateState, useDeleteJsonb } from './useDeleteJsonb';
import { useMutateJsonb } from './useMutateJsonb';
import {
  createDeleteJsonbMutation,
  createDeleteMutation,
  createInsertMutation,
  createUpdateJsonbMutation,
  createUpdateMutation,
} from './useMutate.utils';
import { useMutateExisting, UseMutationExistingState } from './useMutateExisting';
import { IUseOperationStateHelperOptions } from './useOperationStateHelper';
import { QueryState, useQueryOne } from './useQueryOne';
import { createQueryOne } from './useQueryOne.utils';

export interface UseInfiniteQueryManyProps {
  where?: { [key: string]: any };
  orderBy?: { [key: string]: any } | Array<{ [key: string]: any }>;
  distinctOn?: string;
  pageSize?: number;
  middleware?: QueryMiddleware[];
  listKey?: string;
  urqlContext?: Partial<OperationContext>;
  resultHelperOptions?: IUseOperationStateHelperOptions;
}

export interface UseReactGraphqlApi {
  useInsert: <TData extends JsonObject = any, TVariables extends JsonObject  = any, TItem extends JsonObject  = any>(props?: {
    initialVariables?: Partial<TVariables>;
    initialItem?: Partial<TItem>;
    middleware?: QueryMiddleware[];
    listKey?: string;
    firstOrLast?: 'insert-first' | 'insert-last';
    resultHelperOptions?: IUseOperationStateHelperOptions;
  }) => MutateState<TData, TVariables, TItem>;
  useDelete: <TData extends JsonObject = any, TVariables extends JsonObject  = any, TItem extends JsonObject  = any>(props: {
    variables: TVariables;
    middleware?: QueryMiddleware[];
    listKey?: string;
    resultHelperOptions?: IUseOperationStateHelperOptions;
  }) => MutateState<TData, TVariables, TItem>;
  useUpdate: <TData extends JsonObject = any, TVariables extends JsonObject  = any, TItem extends JsonObject  = any>(props?: {
    initialItem?: Partial<TItem>;
    initialVariables?: Partial<TVariables>;
    middleware?: QueryMiddleware[];
    resultHelperOptions?: IUseOperationStateHelperOptions;
  }) => MutateState<TData, TVariables, TItem>;
  useUpdateExisting: (props?: {
    initialVariables: JsonObject;
    queryMiddleware?: QueryMiddleware[];
    mutationMiddleware?: QueryMiddleware[];
    listKey?: string;
    mutationResultHelperOptions?: IUseOperationStateHelperOptions;
  }) => UseMutationExistingState;
  useInsertJsonb: (props?: {
    initialVariables?: JsonObject;
    initialItem?: JsonObject;
    middleware?: QueryMiddleware[];
    listKey?: string;
    firstOrLast?: 'insert-first' | 'insert-last';
    resultHelperOptions?: IUseOperationStateHelperOptions;
    columnName?: string;
  }) => MutateState;
  useRemoveKeyFromJsonbObject: (props: {
    key?: string;
    variables: JsonObject;
    middleware?: QueryMiddleware[];
    listKey?: string;
    resultHelperOptions?: IUseOperationStateHelperOptions;
    columnName?: string;
  }) => DeleteJsonBMutateState;
  useRemoveItemFromJsonbArray: (props: {
    variables: JsonObject;
    middleware?: QueryMiddleware[];
    listKey?: string;
    resultHelperOptions?: IUseOperationStateHelperOptions;
    columnName?: string;
  }) => MutateState;
  useUpdateJsonb: (props?: {
    initialItem?: JsonObject;
    initialVariables?: JsonObject;
    middleware?: QueryMiddleware[];
    resultHelperOptions?: IUseOperationStateHelperOptions;
    columnName?: string;
  }) => MutateState;
  useInfiniteQueryMany: <T>(props?: UseInfiniteQueryManyProps) => IUseInfiniteQueryManyResults<T>;
  useQueryOne: (props: {
    variables: JsonObject;
    middleware?: QueryMiddleware[];
    resultHelperOptions?: IUseOperationStateHelperOptions;
    urqlContext?: Partial<OperationContext>;
  }) => QueryState;
}

export function useReactGraphql(config: HasuraDataConfig): UseReactGraphqlApi {
  return {
    useInsert: function<TData extends JsonObject = any, TVariables extends JsonObject  = any, TItem extends JsonObject  = any>(props?:  {
      initialVariables?: Partial<TVariables>;
      initialItem?: Partial<TItem>;
      middleware?: QueryMiddleware[];
      listKey?: string;
      firstOrLast?: 'insert-first' | 'insert-last';
      resultHelperOptions?: IUseOperationStateHelperOptions;
    }){
      return useMutate<TData, TVariables, TItem>({
        sharedConfig: config,
        middleware: props?.middleware || [createInsertMutation],
        initialItem: props?.initialItem,
        initialVariables: props?.initialVariables,
        operationEventType: props?.firstOrLast ?? 'insert-first',
        listKey: props?.listKey,
        resultHelperOptions: props?.resultHelperOptions,
      })
    },

    useDelete: function<TData extends JsonObject = any, TVariables extends JsonObject  = any, TItem extends JsonObject  = any>(props:  {
      variables: TVariables;
      middleware?: QueryMiddleware[];
      listKey?: string;
      resultHelperOptions?: IUseOperationStateHelperOptions;
    }){
      return useMutate<TData, TVariables, TItem>({
        sharedConfig: config,
        middleware: props.middleware || [createDeleteMutation],
        initialVariables: props.variables,
        operationEventType: 'delete',
        listKey: props.listKey,
        resultHelperOptions: props?.resultHelperOptions,
      })
    },

    useUpdate: function<TData extends JsonObject = any, TVariables extends JsonObject  = any, TItem extends JsonObject  = any>(props?:  {
      initialItem?: Partial<TItem>;
      initialVariables?: Partial<TVariables>;
      middleware?: QueryMiddleware[];
      resultHelperOptions?: IUseOperationStateHelperOptions;
    }){
      return useMutate<TData, TVariables, TItem>({
        sharedConfig: config,
        middleware: props?.middleware || [createUpdateMutation],
        initialItem: props?.initialItem,
        initialVariables: props?.initialVariables,
        operationEventType: 'update',
        resultHelperOptions: props?.resultHelperOptions,
      })
    },

    useUpdateExisting: (props?) =>
      useMutateExisting({
        sharedConfig: config,
        mutationMiddleware: props?.mutationMiddleware || [createUpdateMutation],
        queryMiddleware: props?.queryMiddleware || [createQueryOne],
        queryVariables: props?.initialVariables || {},
        mutationResultHelperOptions: props?.mutationResultHelperOptions,
      }),

    useInsertJsonb: (props?) =>
      useMutateJsonb({
        sharedConfig: config,
        middleware: props?.middleware || [createUpdateJsonbMutation],
        initialItem: props?.initialItem,
        initialVariables: props?.initialVariables,
        operationEventType: props?.firstOrLast ?? 'insert-last',
        listKey: props?.listKey,
        resultHelperOptions: props?.resultHelperOptions,
        columnName: props?.columnName,
      }),

    useRemoveKeyFromJsonbObject: (props) =>
      useDeleteJsonb({
        sharedConfig: config,
        middleware: props.middleware || [createDeleteJsonbMutation],
        initialVariables: props.variables,
        key: props.key,
        operationEventType: 'delete_jsonb_key',
        listKey: props.listKey,
        resultHelperOptions: props?.resultHelperOptions,
        columnName: props?.columnName,
      }),

    useRemoveItemFromJsonbArray: (props) =>
      useMutateJsonb({
        sharedConfig: config,
        middleware: props.middleware || [createUpdateJsonbMutation],
        initialVariables: props.variables,
        operationEventType: 'delete',
        listKey: props.listKey,
        resultHelperOptions: props?.resultHelperOptions,
        columnName: props?.columnName,
      }),

    useUpdateJsonb: (props?) =>
      useMutateJsonb({
        sharedConfig: config,
        middleware: props?.middleware || [createUpdateJsonbMutation],
        initialItem: props?.initialItem,
        initialVariables: props?.initialVariables,
        operationEventType: 'update',
        resultHelperOptions: props?.resultHelperOptions,
        columnName: props?.columnName,
      }),

    useInfiniteQueryMany: function <TData>(props?: UseInfiniteQueryManyProps) {
      return useInfiniteQueryMany<TData>({
        where: props?.where,
        orderBy: props?.orderBy,
        distinctOn: props?.distinctOn,
        sharedConfig: config,
        pageSize: props?.pageSize,
        middleware: props?.middleware || [createInfiniteQueryMany],
        listKey: props?.listKey,
        urqlContext: props?.urqlContext,
        resultHelperOptions: props?.resultHelperOptions,
      });
    },
    useQueryOne: function<TData extends JsonObject, TVariables extends JsonObject>(props: {
      variables: Partial<TVariables>;
      middleware?: QueryMiddleware[];
      resultHelperOptions?: IUseOperationStateHelperOptions;
      urqlContext?: Partial<OperationContext>;
    }) {
      return useQueryOne<TData, TVariables>({
        sharedConfig: config,
        middleware: props?.middleware || [createQueryOne],
        variables: props.variables,
        urqlContext: props?.urqlContext,
        resultHelperOptions: props?.resultHelperOptions,
      });
    },
  };
}
