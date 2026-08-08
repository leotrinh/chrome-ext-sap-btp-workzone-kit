import { describe, expect, it } from "vitest";
import { scanFileForRemoteCode } from "../../scripts/check-no-remote-code.mjs";

describe("scanFileForRemoteCode()", () => {
  it("passes clean bundled JS", () => {
    expect(scanFileForRemoteCode("dist/service-worker.js", "console.log('ok');")).toEqual([]);
  });

  it("flags eval()", () => {
    const violations = scanFileForRemoteCode("dist/x.js", "eval('1+1')");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/eval/);
  });

  it("flags new Function()", () => {
    const violations = scanFileForRemoteCode("dist/x.js", "const f = new Function('return 1');");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/Function/);
  });

  it("flags a remote <script src> tag", () => {
    const violations = scanFileForRemoteCode(
      "dist/sidepanel/index.html",
      '<script src="https://cdn.example.com/lib.js"></script>',
    );
    expect(violations.length).toBeGreaterThan(0);
  });

  it("allows the whitelisted external links (github/coffee/ui5) as plain hrefs", () => {
    const violations = scanFileForRemoteCode(
      "dist/sidepanel/index.html",
      '<a href="https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit">GitHub</a>' +
        '<a href="https://buymeacoffee.com/leotrinh">Coffee</a>' +
        '<a href="https://ui5.sap.com/versionoverview.html">UI5</a>',
    );
    expect(violations).toEqual([]);
  });
});
