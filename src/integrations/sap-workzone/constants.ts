export const GRAPHQL_ENDPOINT = "/semantic/graphql";
export const HTML5_ENDPOINT = "/semantic/entity/provider/html5";
export const CONTEXT_ID = "SUB_ACCOUNT";
export const APP_DETAIL_CONCURRENCY = 5;
export const MUTATION_DELAY_MS = 300;
export const HTML5_PROVIDER_ID = "saas_approuter";
export const HTML5_CONTENT_ADDITION_MODE = "manual";

export const VALID_WORKZONE_HASH_SEGMENTS = [
  "Content-Manage",
  "Site-Directory",
  "Provider-Manage",
  "SubAccount-Settings",
  "Transport-Manager",
] as const;

export type WorkzoneHashSegment = (typeof VALID_WORKZONE_HASH_SEGMENTS)[number];
