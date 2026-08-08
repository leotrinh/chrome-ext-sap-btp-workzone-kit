import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkzoneEnvironment } from "../../integrations/sap-workzone/types";
import { sendWorkzoneCommand } from "./useWorkzoneCommand";

export type WorkzoneEnvironmentState =
  | { status: "loading" }
  | { status: "ready"; environment: WorkzoneEnvironment }
  | { status: "error"; message: string };

export function useWorkzoneEnvironment(): {
  state: WorkzoneEnvironmentState;
  refresh: () => void;
} {
  const [state, setState] = useState<WorkzoneEnvironmentState>({ status: "loading" });
  // Guards against an older in-flight refresh() overwriting a newer one's result.
  const requestIdRef = useRef(0);

  const refresh = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setState({ status: "loading" });
    sendWorkzoneCommand<WorkzoneEnvironment>("GET_ENVIRONMENT").then((response) => {
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (response.ok) {
        setState({ status: "ready", environment: response.data });
      } else {
        setState({ status: "error", message: response.error.message });
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { state, refresh };
}
