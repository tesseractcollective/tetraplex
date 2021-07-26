import { useState, useEffect } from 'react';
import { HasuraDataConfig } from '../types/hasuraConfig';
import { QueryMiddleware } from '../types/hookMiddleware';
import { OperationContext, useQuery, UseQueryState } from 'urql';
import { stateFromQueryMiddleware } from '../support/middlewareHelpers';
import { keyExtractor } from '../support/HasuraConfigUtils';
import { useAtom } from 'jotai';
import { IMutationEvent, mutationEventAtom } from './support/mutationEventAtom';
import { JsonObject } from 'type-fest';
import _ from 'lodash';
import { IUseOperationStateHelperOptions, useOperationStateHelper } from './useOperationStateHelper';

interface IUseQueryOne {
  sharedConfig: HasuraDataConfig;
  middleware: QueryMiddleware[];
  variables: JsonObject;
  resultHelperOptions?: IUseOperationStateHelperOptions;
  urqlContext?: Partial<OperationContext>;
}

export interface QueryState {
  item?: any;
  localError: undefined;
  fetching: boolean;
  error?: Error;
  queryState?: UseQueryState;
  stale: boolean;
  refresh: ()=> void;
  setVariables: React.Dispatch<React.SetStateAction<JsonObject>>;
  variables: JsonObject;
}

const defaultUrqlContext: Partial<OperationContext> = { requestPolicy: 'cache-and-network' };

export function useQueryOne<TData extends JsonObject, TVariables extends JsonObject>(props: IUseQueryOne): QueryState {
  const { sharedConfig, middleware, variables, urqlContext = defaultUrqlContext } = props;

  const [item, setItem] = useState<TData | null>();
  const [key, setKey] = useState<string>();
  const [objectVariables, setObjectVariables] = useState<JsonObject>(variables);

  const [mutationEvent] = useAtom<IMutationEvent>(mutationEventAtom);

  //Guards
  if (!sharedConfig || !middleware?.length) {
    throw new Error(`Hasura config and at least one middleware required.
    You are missing: ${!sharedConfig ? 'HasuraConfig' : ''} ${!!middleware?.length ? ' Middleware' : ''}`);
  }

  const [queryCfg, setQueryCfg] = useState(computeConfig);

  const isMissingPrimaryKey = queryCfg.warnings?.filter((warning) =>
    warning.startsWith(`useQueryOne: no value for primary key`),
  );
  const pauseForMissingPrimaryKey = isMissingPrimaryKey && !urqlContext?.pause;
  if (pauseForMissingPrimaryKey) {
    console.warn(
      `Attempted to execute useQueryOne without a value for the primary key.  Pass urqlContext.pause: true into useQueryOne until your primaryKeyValue is ready.  Query has been automatically paused.`,
    );
  }
  
  const [resp, reExecuteQuery] = useQuery<TData>({
    query: queryCfg?.document,
    variables: queryCfg.variables,
    context: pauseForMissingPrimaryKey ? {...urqlContext, pause: true} : urqlContext,
  });

  useEffect(() => {
    updateItemKey();
  }, [item, objectVariables]);

  useEffect(() => {
    if (mutationEvent.type === 'init') {
      return;
    }

    logMutationEvent();

    if (mutationEvent.listKey === sharedConfig.typename && (mutationEvent.key === key || !key)) {
      if (mutationEvent.type === 'delete') {
        setItem(null);
      } else {
        setItem(mutationEvent.payload as TData);
      }
    } else if (mutationEvent.listKey && sharedConfig.typename && mutationEvent.listKey !== sharedConfig.typename) {
      logMismatchedMutationEvent();
    }
  }, [mutationEvent]);

  useEffect(() => {
    reExecuteQuery();
  }, [queryCfg]);

  useEffect(() => {
    const newState = computeConfig();
    if (!_.isEqual(newState, queryCfg)) {
      console.log('useQueryOne -> useEffect -> computeConfig -> newState', newState);
      setQueryCfg(newState);
    }
  }, [objectVariables]);

  //Parse response
  useEffect(() => {
    if (resp.data) {
      console.log('⛱️ resp.data', resp.data);
      setItem(resp.data[queryCfg.operationName] as any);
    }
  }, [resp.data]);

  useOperationStateHelper(resp, props.resultHelperOptions || {});

  return {
    item,
    localError: undefined,
    fetching: resp.fetching,
    error: resp.error,
    stale: resp.stale,
    refresh: reExecuteQuery,
    setVariables: setObjectVariables,
    variables: objectVariables,
  };

  function logMismatchedMutationEvent() {
    console.log(
      `❗ <- mismatched model types <- mutationEvent recieved <- useQueryOne
               ${mutationEvent.listKey} !== ${sharedConfig.typename}
               Recieved a mutationEvent with a key of ${mutationEvent.listKey}
               This instance of the useQueryOne hook was given a config for ${sharedConfig.typename}
        `,
    );
  }

  function logMutationEvent() {
    console.log(
      'mutationEvent recieved <- Before check <- useQueryOne',
      JSON.stringify(
        {
          c1: mutationEvent.listKey == sharedConfig.typename,
          'me:listKey': mutationEvent.listKey,
          typename: sharedConfig.typename,
          c2: mutationEvent.key === key || !key,
          'me:key': mutationEvent.key,
          key: key ?? 'NO KEY',
          mutationEvent,
        },
        null,
        2,
      ),
    );
  }

  function updateItemKey() {
    if (!sharedConfig || (!item && !objectVariables)) {
      return;
    }
    let newKey = item ? keyExtractor(sharedConfig, item) : keyExtractor(sharedConfig, objectVariables);
    if (newKey) {
      if (newKey !== key) {
        setKey(newKey);
      }
    } else if (item?.typename !== sharedConfig.typename) {
      console.log(
        `❗ useQueryOne -> item -> keyExtractor failed',
                  //  ${item?.typename} !== ${sharedConfig.typename}
                   Recieved a item with a key of ${item?.listKey}
                   This instance of the useQueryOne hook was given a config for ${sharedConfig.typename}
            `,
      );
    } else {
      console.log(
        `❗ useQueryOne -> item -> keyExtractor failed for unknown reasons'`,
        JSON.stringify(
          {
            item,
            'sharedConfig.typename': sharedConfig.typename,
          },
          null,
          2,
        ),
      );
    }
  }

  function computeConfig() {
    return stateFromQueryMiddleware({ variables: objectVariables }, middleware, sharedConfig);
  }
}
