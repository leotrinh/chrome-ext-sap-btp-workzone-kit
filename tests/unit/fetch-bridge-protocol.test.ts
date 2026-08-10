import { describe, expect, it } from "vitest";
import {
  FETCH_BRIDGE_CHANNEL,
  isFetchBridgeRequestMessage,
  isFetchBridgeResponseMessage,
} from "../../src/content/fetch-bridge-protocol";

describe("isFetchBridgeRequestMessage()", () => {
  it("accepts a well-formed request message", () => {
    expect(
      isFetchBridgeRequestMessage({
        channel: FETCH_BRIDGE_CHANNEL,
        type: "request",
        requestId: "abc",
        url: "/semantic/graphql",
        init: { method: "HEAD", headers: {} },
      }),
    ).toBe(true);
  });

  it.each([
    null,
    undefined,
    "a string",
    42,
    {},
    { channel: "other-channel", type: "request", requestId: "a", url: "/x", init: {} },
    { channel: FETCH_BRIDGE_CHANNEL, type: "response", requestId: "a", url: "/x", init: {} },
    { channel: FETCH_BRIDGE_CHANNEL, type: "request", requestId: 1, url: "/x", init: {} },
    { channel: FETCH_BRIDGE_CHANNEL, type: "request", requestId: "a", url: "/x" },
  ])("rejects malformed input: %j", (input) => {
    expect(isFetchBridgeRequestMessage(input)).toBe(false);
  });
});

describe("isFetchBridgeResponseMessage()", () => {
  it("accepts a well-formed response message", () => {
    expect(
      isFetchBridgeResponseMessage({
        channel: FETCH_BRIDGE_CHANNEL,
        type: "response",
        requestId: "abc",
        result: { ok: true, status: 200, redirected: false, headers: {}, bodyText: "" },
      }),
    ).toBe(true);
  });

  it.each([
    null,
    "nope",
    { channel: "other", type: "response", requestId: "a", result: {} },
    { channel: FETCH_BRIDGE_CHANNEL, type: "request", requestId: "a", result: {} },
    { channel: FETCH_BRIDGE_CHANNEL, type: "response", requestId: "a" },
  ])("rejects malformed input: %j", (input) => {
    expect(isFetchBridgeResponseMessage(input)).toBe(false);
  });
});
