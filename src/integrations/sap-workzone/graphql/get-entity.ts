import { CONTEXT_ID } from "../constants";

/** Blueprint §3.6/§52 — copied verbatim from the working source userscript. */
export const GET_ENTITY_QUERY = `
  query getEntity($baseCdmEntity: BaseCdmEntityInput!) {
    entity(baseCdmEntity: $baseCdmEntity) {
      cdm
    }
  }
`;

export interface GetEntityResponseData {
  entity: { cdm: unknown } | null;
}

export function buildGetEntityVariables(entityId: string): Record<string, unknown> {
  return {
    baseCdmEntity: {
      entityId,
      entityType: "businessapp",
      contextId: CONTEXT_ID,
      contextType: CONTEXT_ID,
    },
  };
}
