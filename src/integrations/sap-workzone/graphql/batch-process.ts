import { CONTEXT_ID } from "../constants";

/** Blueprint §18/§52 — copied verbatim from the working source userscript. */
export const BATCH_PROCESS_MUTATION = `
  mutation batchProcess(
    $batchOperations: Batch!,
    $actions: ActionsRequest,
    $contextId: String!,
    $contextType: Context,
    $isCherryPickScenario: Boolean
  ) {
    batchProcess(
      batchOperations: $batchOperations,
      actions: $actions,
      contextId: $contextId,
      contextType: $contextType,
      isCherryPickScenario: $isCherryPickScenario
    ) {
      activation
    }
  }
`;

export interface BatchProcessResponseData {
  batchProcess: { activation: unknown } | null;
}

export function buildBatchProcessVariables(cdm: unknown): Record<string, unknown> {
  return {
    batchOperations: {
      BATCH: [
        {
          metadata: { operation: "UPDATE" },
          cdm,
        },
      ],
    },
    actions: {},
    contextId: CONTEXT_ID,
    contextType: CONTEXT_ID,
    isCherryPickScenario: false,
  };
}
