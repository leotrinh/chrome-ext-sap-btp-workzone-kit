import type { BridgedResponse } from "../../../src/content/fetch-bridge";

/**
 * Test-only helper: builds a BridgedResponse fixture from a real Response, so tests
 * for csrf.ts/graphql-client.ts/html5-refresh.ts can keep constructing familiar
 * `new Response(...)` fixtures while mocking `bridgedFetch` (which returns
 * BridgedResponse, not Response, in production — see src/content/fetch-bridge.ts).
 */
export async function toBridgedResponse(response: Response): Promise<BridgedResponse> {
  const bodyText = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const bridged: BridgedResponse = {
    status: response.status,
    redirected: response.redirected,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: () => Promise.resolve(bodyText),
    json: async () => JSON.parse(bodyText) as unknown,
    clone: () => bridged,
  };
  return bridged;
}
