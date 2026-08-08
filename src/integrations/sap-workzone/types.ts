import type { WorkzoneHashSegment } from "./constants";
import type { EnvironmentMetadataSource } from "./environment";

export type WorkzoneCompatibilityStatus =
  | "ready"
  | "partial"
  | "sign_in_required"
  | "unsupported_page"
  | "page_changed";

export interface WorkzoneEnvironment {
  eligible: boolean;
  matchedRoute?: WorkzoneHashSegment;
  subaccountId?: string;
  subdomain?: string;
  metadataSource?: EnvironmentMetadataSource;
  compatibilityStatus: WorkzoneCompatibilityStatus;
  warnings: string[];
}
