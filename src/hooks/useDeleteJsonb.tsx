import { useEffect, useState, useCallback } from "react";
import { HasuraDataConfig } from "../types/hasuraConfig";
import {
  OperationTypes,
  QueryMiddleware,
  QueryPostMiddlewareState,
} from "../types/hookMiddleware";
import { OperationContext, useMutation, UseMutationState } from "urql";
import { stateFromQueryMiddleware } from "../support/middlewareHelpers";
import { useMonitorResult } from "./support/monitorResult";
import { mutationEventAtom } from "./support/mutationEventAtom";
import { useAtom } from "jotai";
import { keyExtractor } from "../support/HasuraConfigUtils";
import { print } from "graphql";
import { JsonObject, JsonValue } from "type-fest";
import {
  IUseOperationStateHelperOptions,
  useOperationStateHelper,
} from "./useOperationStateHelper";
import { log } from "../support/log";

interface IUseMutateJsonbProps {
  columnName?: string;
  sharedConfig: HasuraDataConfig;
  middleware: QueryMiddleware[];
  key?: string;
  initialVariables?: JsonObject;
  operationEventType: OperationTypes;
  listKey?: string;
  resultHelperOptions?: IUseOperationStateHelperOptions;
}

export function useDeleteJsonb<T extends JsonObject>(
  props: IUseMutateJsonbProps
): DeleteJsonBMutateState {
  const {
    sharedConfig,
    middleware,
    initialVariables,
    key,
    listKey,
    operationEventType,
    columnName,
  } = props;
  //MutationConfig is what we internally refer to the middlewareState as

  const [variables, setVariables] = useState<JsonObject>(
    initialVariables || {}
  );
  const [item, setItem] = useState<string | undefined>(key);
  const [needsExecuteMutation, setNeedsExecuteMutation] = useState<boolean>();
  const [executeContext, setExecuteContext] =
    useState<Partial<OperationContext> | null>();
  const [_, setMutationEvent] = useAtom(mutationEventAtom);

  const _columnName = columnName || sharedConfig.jsonb?.columnName;

  //Guards
  if (!sharedConfig) {
    throw new Error("config if required, recieved: " + sharedConfig);
  }
  if (!middleware?.length) {
    throw new Error("At least one middleware required");
  }
  if (!_columnName) {
    throw new Error(
      "Column name required as paramter, or on config.jsonb.columnName for useMutateJsonb"
    );
  }
  const computeConfig = (variables: JsonObject, item?: JsonValue) => {
    const variablesWithItem = {
      ...variables,
      item,
    };

    return stateFromQueryMiddleware(
      {
        variables: variablesWithItem,
        meta: {
          jsonbColumnName: _columnName,
          operationEventType,
        },
      },
      middleware,
      sharedConfig
    );
  };

  const [mutationCfg, setMutationCfg] = useState(
    computeConfig(variables, item)
  );
  useEffect(() => {
    const newState = computeConfig(variables, item);
    setMutationCfg(newState);
  }, [variables, item]);

  //The mutation
  const [mutationResult, executeMutation] = useMutation(mutationCfg.document);
  const resultItem = mutationResult.data?.[mutationCfg.operationName];

  useEffect(() => {
    (async () => {
      if (needsExecuteMutation && !executeContext) {
        setNeedsExecuteMutation(false);

        log.debug("💪 executingMutation");
        log.debug(print(mutationCfg.document));
        log.debug(JSON.stringify({ variables: mutationCfg.variables }));

        //_append, _prepend, set -> These all expect an object with the shape of: { columnName: CHANGES }
        //for _append and _prepend this should be an object that is added to the existing array
        //for _set: this will replace the entire jsonb
        //_delete_elem -> This expects a number to know which index number to delete at
        const resp = await executeMutation(mutationCfg.variables);
        const successItem = resp?.data?.[mutationCfg.operationName];

        if (successItem) {
          const key = keyExtractor(sharedConfig, successItem);
          log.debug("setMutationEvent");

          setMutationEvent(() => ({
            listKey: listKey ?? sharedConfig.typename,
            type: props.operationEventType,
            key: key,
            payload: {
              ...successItem,
            },
          }));
        }
      }
    })();
  }, [needsExecuteMutation, executeContext, executeMutation, mutationCfg]);

  useMonitorResult("mutation", mutationResult);

  //Handling variables
  const setVariable = useCallback((name: string, value: any) => {
    setVariables((original) => ({
      ...original,
      [name]: value,
    }));
  }, []);

  const wrappedExecuteMutation = (
    _itemValues?: string,
    _variables?: JsonObject,
    context?: Partial<OperationContext>
  ) => {
    if (_variables || _itemValues) {
      const newVariables = {
        ...variables,
        ..._variables,
      };
      const newItem = _itemValues;
      setMutationCfg(computeConfig(newVariables, newItem));
      setVariables(newVariables);
      setItem(newItem);

      // you need to do both because setVariables triggers the
      // useEffect to compute the new config on the next render
      // cycle
    }
    if (context) {
      setExecuteContext(context);
    } else {
      setNeedsExecuteMutation(true);
    }
  };

  useOperationStateHelper(mutationResult, props.resultHelperOptions || {});

  //Return values
  return {
    resultItem,
    mutating: mutationResult.fetching,
    error: mutationResult.error,
    mutationState: mutationResult,
    mutationConfig: mutationCfg,
    executeMutation: wrappedExecuteMutation,
    key: item,
    setKey: setItem,
    variables,
    setVariable,
  };
}

export interface DeleteJsonBMutateState {
  resultItem?: any;
  mutating: boolean;
  error?: Error;
  mutationState: UseMutationState;
  mutationConfig: QueryPostMiddlewareState;
  executeMutation: (
    itemValues?: string,
    variables?: JsonObject,
    context?: Partial<OperationContext>
  ) => void;
  setKey: (newValue: string) => void;
  key?: string;
  setVariable: (name: string, value: any) => void;
  variables: JsonObject;
}
