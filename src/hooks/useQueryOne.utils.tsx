import React from 'react';
import { JsonObject } from 'type-fest';

import { getFieldFragmentInfo } from '../support/HasuraConfigUtils';
import { QueryPostMiddlewareState, QueryPreMiddlewareState } from '../types/hookMiddleware';
import { HasuraDataConfig } from '../types/hasuraConfig';
import { buildFragment } from './support/buildFragment';
import { buildDocument } from './support/buildDocument';
import { getFieldTypeMap } from '../support';

function createVariableDefinitionsString(variables: JsonObject, config: HasuraDataConfig): string {
  if (!config.fieldFragment || !config.schema) {
    return '';
  }
  const fieldTypeMap = getFieldTypeMap(config.fieldFragment, config.schema);
  return Object.keys(variables)
    .map((key) => {
      const type = fieldTypeMap[key]?.toString() || 'Any!';
      return `$${key}: ${type}`;
    })
    .join(', ');
}

export function createQueryOne(
  state: QueryPreMiddlewareState,
  config: HasuraDataConfig,
): QueryPostMiddlewareState {
  const name = config.typename;
  const operationName = config.overrides?.operationNames?.query_by_pk ?? `${name}_by_pk`;

  const { fragment, fragmentName } = getFieldFragmentInfo(config, config.overrides?.fieldFragments?.query_by_pk);

  const variables = state.variables;

  let warnings = [];
  for (const key of config.primaryKey) {
    if (!variables[key]) {
      warnings.push(`useQueryOne: no value for primary key ${key}`);
    }
  }

  const operationStrBase = config.primaryKey
    .map((key) => {
      return variables[key] ? `${key}: $${key}` : null;
    })
    .filter((x) => !!x)
    .join(', ');

  const operationStr = operationStrBase ? `(${operationStrBase})` : '';
  const variableDefinitionsString = createVariableDefinitionsString(variables, config);

  let frag = buildFragment(fragment, operationStr, variables);

  const queryString = `query ${name}Query(${variableDefinitionsString}) {
    ${operationName}${operationStr} {
      ...${fragmentName}
    }
  }
  ${frag}`;

  console.log('🚀 ~ file: useQueryOne.utils.tsx ~ line 1 ~ queryString', queryString, variables);

  const document = buildDocument(queryString, operationStr, variables, 'createQueryOne', 'query');

  return { document, variables, operationName };
}
