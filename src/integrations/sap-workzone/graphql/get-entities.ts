import { CONTEXT_ID } from "../constants";

/** Blueprint §3.5/§52 — copied verbatim from the working source userscript. */
export const GET_ENTITIES_QUERY = `
  query getEntities(
    $contextId: String!,
    $contextType: Context!,
    $queryData: QueryData,
    $queryOptions: QueryOptions,
    $tenantId: String
  ) {
    entities(
      contextId: $contextId,
      contextType: $contextType,
      queryData: $queryData,
      queryOptions: $queryOptions,
      tenantId: $tenantId
    ) {
      items {
        id
        title
        baseId
        entityType
      }
      continuationToken
    }
  }
`;

export interface GetEntitiesItem {
  id: string;
  title: string;
  baseId: string | null;
  entityType: string;
}

export interface GetEntitiesResponseData {
  entities: {
    items: GetEntitiesItem[] | null;
    continuationToken: string | null;
  };
}

export function buildGetEntitiesVariables(continuationToken: string | null): Record<string, unknown> {
  return {
    contextId: CONTEXT_ID,
    contextType: CONTEXT_ID,
    tenantId: "",
    queryData: {
      entityTypes: ["businessapp"],
      pageSize: 50,
      continuationToken,
    },
    queryOptions: {},
  };
}
