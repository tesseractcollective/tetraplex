import { getFieldTypeMap } from '../support/graphqlHelpers';
import { JsonObject } from 'type-fest';
import { getFieldFragmentInfo } from '../support/HasuraConfigUtils';
import { HasuraDataConfig } from '../types/hasuraConfig';
import { OperationTypes, QueryPostMiddlewareState, QueryPreMiddlewareState } from '../types/hookMiddleware';
import { buildFragment } from './support/buildFragment';
import { buildDocument } from './support/buildDocument';

export function createPkArgsString(config: HasuraDataConfig): string {
  return config.primaryKey
    .map((key) => {
      return `${key}:$${key}`;
    })
    .join(', ');
}

function createVariableDefinitionsString(variables: JsonObject, objectType: string, config: HasuraDataConfig): string {
  if (!config.fieldFragment || !config.schema) {
    return '';
  }
  const fieldTypeMap = getFieldTypeMap(config.fieldFragment, config.schema);
  return Object.keys(variables)
    .map((key) => {
      if (key === 'item') {
        return `$${key}:${objectType}`;
      }
      const type = fieldTypeMap[key]?.toString() || 'Any!';
      return `$${key}:${type}`;
    })
    .join(', ');
}

function createVariables(
  state: QueryPreMiddlewareState,
  config: HasuraDataConfig,
  operationName: string,
  includePks: boolean = false,
): JsonObject {
  const variables: JsonObject = {
    ...state.variables,
  };

  updateVariablesFromItemIfRequested(config, state, includePks, variables);

  return variables;
}

export function findMissingPrimaryKeys(
  config: HasuraDataConfig,
  state: QueryPreMiddlewareState,
  includePks: boolean
): string[] | null {
  const missingPrimaryKeyNames: string[] = [];
  config.primaryKey.map((key) => {
    const item: any = state.variables.item;
    const valueFromItem = item && item[key];
    const valueFromVariables = state.variables && state.variables[key];

    if (!valueFromItem && !valueFromVariables && includePks) {
      missingPrimaryKeyNames.push(key);
    }

    if (valueFromItem && includePks) {
      state.variables[key] = valueFromItem;
    }
  });
  return missingPrimaryKeyNames.length ? missingPrimaryKeyNames : null;
}

function updateVariablesFromItemIfRequested(
  config: HasuraDataConfig,
  state: QueryPreMiddlewareState,
  includePks: boolean,
  variables: JsonObject,
) {
  config.primaryKey.forEach((key) => {
    const item: any = state.variables.item;
    const valueFromItem = item && item[key];

    if (valueFromItem && includePks && !variables[key]) {
      variables[key] = valueFromItem;
    }
  });
}

export function createDeleteMutation(
  state: QueryPreMiddlewareState,
  config: HasuraDataConfig,
): QueryPostMiddlewareState {
  const name = config.typename;
  const operationName = config.overrides?.operationNames?.delete_by_pk ?? `delete_${name}_by_pk`;

  const { fragment, fragmentName } = getFieldFragmentInfo(config, config.overrides?.fieldFragments?.delete_by_pk);

  const variables = createVariables(state, config, operationName, true);
  const variablesForDeleting = { ...variables };
  delete variablesForDeleting.item;
  const variableDefinitionsString = createVariableDefinitionsString(variablesForDeleting, 'Any!', config);
  const pkArgs = createPkArgsString(config);

  const variablesStr = variableDefinitionsString ? `(${variableDefinitionsString})` : '';

  const mutationStr = `mutation ${name}DeleteMutation${variablesStr} {
      ${operationName}(${pkArgs}) {
        ${config.primaryKey.join('\r\n')}
      }
    }`;

  let document = buildDocument(mutationStr, operationName, variablesForDeleting, 'createDeleteMutation', 'mutation');

  return { document, operationName, variables: variablesForDeleting };
}

export function createInsertMutation(
  state: QueryPreMiddlewareState,
  config: HasuraDataConfig,
): QueryPostMiddlewareState {
  const name = config.typename;
  const { fragment, fragmentName } = getFieldFragmentInfo(config, config.overrides?.fieldFragments?.insert_core_one);

  const operationName = config.overrides?.operationNames?.insert_one ?? `insert_${name}_one`;
  const objectType = `${name}_insert_input!`;
  const variables = createVariables(state, config, operationName, config.primaryKeyRequiredOnCreate);
  const variableDefinitionsString = createVariableDefinitionsString(variables, objectType, config);
  const onConflictVariable = config.overrides?.onConflict?.insert ? `, $onConflict:${name}_on_conflict` : '';
  const onConflictArg = config.overrides?.onConflict?.insert_args ? ', on_conflict:$onConflict' : '';

  const variablesString =
    variableDefinitionsString || onConflictVariable ? `(${variableDefinitionsString}${onConflictVariable})` : '';

  let frag = buildFragment(fragment, operationName, variables);

  const mutationStr = `mutation ${name}Mutation${variablesString} {
    ${operationName}(object:$item${onConflictArg}) {
      ...${fragmentName}
    }
  }
  ${frag}`;

  let document = buildDocument(mutationStr, operationName, variables, 'createInsertMutation', 'mutation');

  return { document, operationName, variables };
}

export function createUpdateMutation(
  state: QueryPreMiddlewareState,
  config: HasuraDataConfig,
): QueryPostMiddlewareState {
  const name = config.typename;
  const { fragment, fragmentName } = getFieldFragmentInfo(config, config.overrides?.fieldFragments?.update_core);

  const operationName = config.overrides?.operationNames?.update_by_pk ?? `update_${name}_by_pk`;

  const objectType = `${name}_set_input!`;
  const variables = createVariables(state, config, operationName, true);
  const variableDefinitionsString = createVariableDefinitionsString(variables, objectType, config);
  const pkArgs = createPkArgsString(config);

  const variablesStr = variableDefinitionsString ? `(${variableDefinitionsString})` : '';

  let frag = buildFragment(fragment, operationName, variables);

  const mutationStr = `mutation ${name}Mutation${variablesStr} {
    ${operationName}(pk_columns: {${pkArgs}} _set:$item ) {
      ...${fragmentName}
    }
  }
  ${frag}`;

  let document = buildDocument(mutationStr, operationName, variables, 'createUploadMutation', 'mutation');

  return { document, operationName, variables };
}

// '_delete_at_path' | '_delete_elem' | '_delete_key'

//Add to start, add to end, edit (replace all), delete by path, delete by index

const localOperationToHasuraMap = {
  'insert-first': '_prepend',
  'insert-last': '_append',
  update: '_set',
  delete: '_delete_elem',
  delete_jsonb_key: '_delete_key',
};

export function createUpdateJsonbMutation(
  state: QueryPreMiddlewareState,
  config: HasuraDataConfig,
): QueryPostMiddlewareState {
  if (!state.meta) {
    throw new Error('Using jsonbMutations requires middleware that passes in state.meta');
  }

  const { jsonbColumnName, operationEventType } = state.meta;

  // jsonbOperation: OperationTypes = 'insert-first',
  // jsonbColumnName: string
  const name = config.typename;
  const { fragment, fragmentName } = getFieldFragmentInfo(config, config.overrides?.fieldFragments?.update_core);

  const operationName = config.overrides?.operationNames?.update_by_pk ?? `update_${name}_by_pk`;

  const item = state.variables.item;
  const itemIsString = typeof item === 'string';
  const itemIsNumber = typeof item === 'number';

  let objectType = `jsonb`;

  const variables = createVariables(state, config, operationName, true);
  const variableDefinitionsString = createVariableDefinitionsString(variables, objectType, config);
  const pkArgs = createPkArgsString(config);

  const variablesStr = variableDefinitionsString ? `(${variableDefinitionsString})` : '';

  let frag = buildFragment(fragment, operationName, variables);

  const jsonbOperationName = localOperationToHasuraMap[operationEventType || 'insert-first'];

  const mutationStr = `mutation ${name}Mutation${variablesStr} {
    ${operationName}(pk_columns: {${pkArgs}} ${jsonbOperationName}:{ ${jsonbColumnName} : $item } ) {
      ...${fragmentName}
    }
  }
  ${frag}`;

  let document = buildDocument(mutationStr, operationName, variables, 'createUploadMutation', 'mutation');

  return { document, operationName, variables, meta: state.meta };
}

export function createDeleteJsonbMutation(
  state: QueryPreMiddlewareState,
  config: HasuraDataConfig,
): QueryPostMiddlewareState {
  if (!state.meta) {
    throw new Error('Using jsonbMutations requires middleware that passes in state.meta');
  }

  const { jsonbColumnName, operationEventType } = state.meta;

  const name = config.typename;
  const { fragment, fragmentName } = getFieldFragmentInfo(config, config.overrides?.fieldFragments?.update_core);

  const operationName = config.overrides?.operationNames?.update_by_pk ?? `update_${name}_by_pk`;

  let objectType = 'String';

  const variables = createVariables(state, config, operationName, true);
  const variableDefinitionsString = createVariableDefinitionsString(variables, objectType, config);
  const pkArgs = createPkArgsString(config);

  const variablesStr = variableDefinitionsString ? `(${variableDefinitionsString})` : '';

  let frag = buildFragment(fragment, operationName, variables);

  const mutationStr = `mutation ${name}Mutation${variablesStr} {
    ${operationName}(pk_columns: {${pkArgs}} _delete_key:{ ${jsonbColumnName} : $item } ) {
      ...${fragmentName}
    }
  }
  ${frag}`;

  let document = buildDocument(mutationStr, operationName, variables, 'createUploadMutation', 'mutation');

  return { document, operationName, variables, meta: state.meta };
}
