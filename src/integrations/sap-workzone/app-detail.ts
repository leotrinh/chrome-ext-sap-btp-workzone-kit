import { executeGraphQlRequest } from "./graphql-client";
import { GET_ENTITY_QUERY, buildGetEntityVariables, type GetEntityResponseData } from "./graphql/get-entity";
import { mapWithConcurrency } from "../../shared/concurrency";
import { APP_DETAIL_CONCURRENCY } from "./constants";
import type { WorkzoneRequestError } from "../../shared/errors";

export interface WorkzoneAppDetail {
  id: string;
  cdm: unknown;
}

export type AppDetailResult =
  | { ok: true; detail: WorkzoneAppDetail }
  | { ok: false; error: WorkzoneRequestError };

export async function getBusinessAppDetail(appId: string): Promise<AppDetailResult> {
  const result = await executeGraphQlRequest<GetEntityResponseData>({
    query: GET_ENTITY_QUERY,
    variables: buildGetEntityVariables(appId),
  });

  if (!result.ok) {
    return result;
  }
  if (!result.data.entity) {
    return { ok: false, error: { code: "INVALID_RESPONSE", message: `No entity returned for app ${appId}.` } };
  }

  return { ok: true, detail: { id: appId, cdm: result.data.entity.cdm } };
}

export interface AppDetailBatchItem {
  appId: string;
  result: AppDetailResult;
}

/**
 * Fetches details for many apps at the blueprint's fixed concurrency of 5
 * (APP_DETAIL_CONCURRENCY). One app's failure never aborts the batch — each result
 * carries its own ok/error outcome so the caller can render per-row status.
 */
export async function getBusinessAppDetails(appIds: readonly string[]): Promise<AppDetailBatchItem[]> {
  return mapWithConcurrency(appIds, APP_DETAIL_CONCURRENCY, async (appId) => ({
    appId,
    result: await getBusinessAppDetail(appId),
  }));
}
