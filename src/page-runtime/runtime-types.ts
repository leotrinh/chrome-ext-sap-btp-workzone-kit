import type { WorkzoneCommand } from "../messaging/protocol";

export type WorkzoneCommandResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface WorkzoneRuntime {
  runtimeVersion: string;
  protocolVersion: 1;
  handle(command: WorkzoneCommand, payload?: unknown): Promise<WorkzoneCommandResponse>;
}

declare global {
  interface Window {
    __BTP_WORKZONE_KIT__?: WorkzoneRuntime;
  }
}
