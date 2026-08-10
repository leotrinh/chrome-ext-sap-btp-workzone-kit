import { executeGraphQlRequest, type GraphQlResult } from "./graphql-client";
import {
  GET_ENTITIES_QUERY,
  buildGetEntitiesVariables,
  type GetEntitiesItem,
  type GetEntitiesResponseData,
} from "./graphql/get-entities";
import type { WorkzoneRequestError } from "../../shared/errors";

export interface WorkzoneAppSummary {
  id: string;
  title: string;
  baseId: string | null;
  entityType: string;
}

export type ListLocalAppsResult =
  | { ok: true; apps: WorkzoneAppSummary[] }
  | { ok: false; error: WorkzoneRequestError };

// Defensive cap — at pageSize 50 this is 10,000 apps. Reaching it means SAP never
// signaled completion (a null continuationToken), which is a protocol violation, not a
// real tenant size; fail safely rather than loop forever or silently truncate.
const MAX_PAGES = 200;

function toSummary(item: GetEntitiesItem): WorkzoneAppSummary {
  return { id: item.id, title: item.title, baseId: item.baseId, entityType: item.entityType };
}

/**
 * Lists local (baseId === null) business apps, paginating via continuationToken
 * (blueprint §3.5). Guards against a stuck/repeating token, which would otherwise
 * loop forever.
 */
export async function listLocalBusinessApps(): Promise<ListLocalAppsResult> {
  const allItems: GetEntitiesItem[] = [];
  let continuationToken: string | null = null;
  const seenTokens = new Set<string>();
  let terminated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const result: GraphQlResult<GetEntitiesResponseData> = await executeGraphQlRequest<GetEntitiesResponseData>({
        query: GET_ENTITIES_QUERY,
        variables: buildGetEntitiesVariables(continuationToken),
      });

    if (!result.ok) {
      return result;
    }

    allItems.push(...(result.data.entities.items ?? []));

    const nextToken: string | null = result.data.entities.continuationToken;
    if (!nextToken) {
      terminated = true;
      break;
    }
    if (seenTokens.has(nextToken)) {
      return {
        ok: false,
        error: {
          code: "PAGE_CHANGED",
          message: "SAP returned a repeated pagination token; aborting scan to avoid an infinite loop.",
        },
      };
    }
    seenTokens.add(nextToken);
    continuationToken = nextToken;
  }

  if (!terminated) {
    return {
      ok: false,
      error: {
        code: "PAGE_CHANGED",
        message: `Scan exceeded ${MAX_PAGES} pages without SAP signaling completion; aborting.`,
      },
    };
  }

  return { ok: true, apps: allItems.filter((item) => item.baseId === null).map(toSummary) };
}
