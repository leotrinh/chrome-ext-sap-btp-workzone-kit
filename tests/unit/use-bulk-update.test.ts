import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBulkUpdate } from "../../src/sidepanel/hooks/useBulkUpdate";
import { sendWorkzoneCommand } from "../../src/sidepanel/hooks/useWorkzoneCommand";
import type { Ui5VersionUpdatePlan } from "../../src/domain/update-plan";

vi.mock("../../src/sidepanel/hooks/useWorkzoneCommand", () => ({
  sendWorkzoneCommand: vi.fn(),
}));

const mockedSend = vi.mocked(sendWorkzoneCommand);

function makePlan(appId: string, noOp = false): Ui5VersionUpdatePlan {
  return {
    appId,
    appTitle: appId,
    current: { displayVersion: "1.100.0", targets: [], consistency: "single" },
    targetVersion: "1.136.17",
    changes: noOp
      ? []
      : [{ kind: "targetAppConfig", from: "1.100.0", to: "1.136.17", pathDescription: "targetAppConfig" }],
    noOp,
    warnings: [],
  };
}

/** Always-succeed update + always-verified verify, for tests that don't care about the details. */
function mockAlwaysSucceeds(): void {
  mockedSend.mockImplementation(async (command: unknown, payload: unknown) => {
    const appId = (payload as { appId: string }).appId;
    if (command === "VERIFY_APP_UI5_VERSION") {
      return { ok: true, data: { appId, status: "verified" } };
    }
    return { ok: true, data: { appId } };
  });
}

function countCallsFor(command: string): number {
  return mockedSend.mock.calls.filter((call) => call[0] === command).length;
}

beforeEach(() => {
  mockedSend.mockReset();
});

describe("useBulkUpdate()", () => {
  it("never sends a no-op plan and marks it 'skipped'", async () => {
    mockAlwaysSucceeds();
    const { result } = renderHook(() => useBulkUpdate());

    await act(async () => {
      await result.current.run([makePlan("a", true)]);
    });

    expect(mockedSend).not.toHaveBeenCalled();
    expect(result.current.results.get("a")?.status).toBe("skipped");
    expect(result.current.state).toBe("completed");
  });

  it("processes actionable plans sequentially, never more than one UPDATE in flight, then verifies each", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    mockedSend.mockImplementation(async (command: unknown, payload: unknown) => {
      const appId = (payload as { appId: string }).appId;
      if (command === "UPDATE_APP_UI5_VERSION") {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight--;
      }
      if (command === "VERIFY_APP_UI5_VERSION") {
        return { ok: true, data: { appId, status: "verified" } };
      }
      return { ok: true, data: { appId } };
    });

    const { result } = renderHook(() => useBulkUpdate());

    await act(async () => {
      await result.current.run([makePlan("a"), makePlan("b"), makePlan("c")]);
    });

    expect(maxInFlight).toBe(1);
    expect(countCallsFor("UPDATE_APP_UI5_VERSION")).toBe(3);
    expect(countCallsFor("VERIFY_APP_UI5_VERSION")).toBe(3);
    expect(result.current.results.get("a")?.status).toBe("verified");
    expect(result.current.results.get("b")?.status).toBe("verified");
    expect(result.current.results.get("c")?.status).toBe("verified");
  });

  it("stops the queue after an authentication failure, marking remaining apps as unknown", async () => {
    mockedSend.mockImplementation(async (command: unknown, payload: unknown) => {
      const appId = (payload as { appId: string }).appId;
      if (command === "UPDATE_APP_UI5_VERSION") {
        if (appId === "a") {
          return { ok: true, data: { appId } };
        }
        return { ok: false, error: { code: "AUTHENTICATION_REQUIRED", message: "session expired" } };
      }
      return { ok: true, data: { appId, status: "verified" } };
    });

    const { result } = renderHook(() => useBulkUpdate());

    await act(async () => {
      await result.current.run([makePlan("a"), makePlan("b"), makePlan("c")]);
    });

    expect(countCallsFor("UPDATE_APP_UI5_VERSION")).toBe(2); // c never attempted
    expect(result.current.results.get("a")?.status).toBe("verified");
    expect(result.current.results.get("b")?.status).toBe("failed");
    expect(result.current.results.get("c")?.status).toBe("unknown");
    expect(result.current.state).toBe("completed");
  });

  it("continues past a non-auth failure instead of stopping the queue", async () => {
    mockedSend.mockImplementation(async (command: unknown, payload: unknown) => {
      const appId = (payload as { appId: string }).appId;
      if (command === "UPDATE_APP_UI5_VERSION") {
        if (appId === "a") {
          return { ok: false, error: { code: "GRAPHQL_ERROR", message: "boom" } };
        }
        return { ok: true, data: { appId } };
      }
      return { ok: true, data: { appId, status: "verified" } };
    });

    const { result } = renderHook(() => useBulkUpdate());

    await act(async () => {
      await result.current.run([makePlan("a"), makePlan("b")]);
    });

    expect(countCallsFor("UPDATE_APP_UI5_VERSION")).toBe(2);
    expect(result.current.results.get("a")?.status).toBe("failed");
    expect(result.current.results.get("b")?.status).toBe("verified");
  });

  it("marks a mismatch when verification finds a different value, without rolling back the update", async () => {
    mockedSend.mockImplementation(async (command: unknown, payload: unknown) => {
      const appId = (payload as { appId: string }).appId;
      if (command === "VERIFY_APP_UI5_VERSION") {
        return { ok: true, data: { appId, status: "mismatch" } };
      }
      return { ok: true, data: { appId } };
    });

    const { result } = renderHook(() => useBulkUpdate());

    await act(async () => {
      await result.current.run([makePlan("a")]);
    });

    expect(result.current.results.get("a")?.status).toBe("updated");
    expect(result.current.results.get("a")?.verificationStatus).toBe("mismatch");
  });

  it("waits ~300ms between sequential mutations", async () => {
    vi.useFakeTimers();
    mockAlwaysSucceeds();

    const { result } = renderHook(() => useBulkUpdate());

    const runPromise = act(async () => {
      await result.current.run([makePlan("a"), makePlan("b")]);
    });

    await vi.waitFor(() => expect(countCallsFor("UPDATE_APP_UI5_VERSION")).toBe(1));
    expect(countCallsFor("UPDATE_APP_UI5_VERSION")).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await runPromise;
    expect(countCallsFor("UPDATE_APP_UI5_VERSION")).toBe(2);

    vi.useRealTimers();
  });

  it("reset() clears state back to idle with no results", async () => {
    mockAlwaysSucceeds();
    const { result } = renderHook(() => useBulkUpdate());

    await act(async () => {
      await result.current.run([makePlan("a")]);
    });
    expect(result.current.state).toBe("completed");

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.results.size).toBe(0);
  });
});
