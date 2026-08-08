# SAP BTP Workzone Kit
## Full Product Blueprint + Master Implementation Prompt for Codex

> **Product name:** SAP BTP Workzone Kit  
> **Public-safe alternative (only if Store/trademark review requires it):** BTP Workzone Kit — for SAP BTP Work Zone  
> **Repository:** https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit  
> **Author:** Leo Trinh  
> **Support:** https://buymeacoffee.com/leotrinh  
> **Target:** Google Chrome + Microsoft Edge, Manifest V3  
> **Primary color:** `#00c8e8`  
> **Secondary color:** `#0B1F33`  
> **Accent:** `#7659FF`  
> **Source baseline:** `update-ui-version-script.js` / SAP Workzone Helper V16.5  
> **Purpose:** Self-contained product blueprint and implementation prompt for Codex  
> **Version:** 1.0 — August 2026

---

# 0. Master Instruction to Codex

Build a production-ready Chromium browser extension named **SAP BTP Workzone Kit**.

Convert the existing Tampermonkey userscript into a maintainable Manifest V3 extension while preserving its working business behavior and improving safety, UX, testing, error handling, and Chrome Web Store readiness.

The source userscript currently supports:

1. SAP BTP Work Zone admin-page detection.
2. Subaccount/subdomain discovery from SAP page metadata.
3. CSRF retrieval through `/semantic/graphql`.
4. Business-app discovery via Work Zone GraphQL.
5. Continuation-token pagination.
6. App-detail loading with concurrency/batch size 5.
7. UI5-version detection from two CDM locations.
8. Search by application name/current version.
9. Sort by app name/current config.
10. Global target UI5 version.
11. Per-app target-version override.
12. Select-all/per-row selection.
13. Sequential bulk application updates.
14. GraphQL `batchProcess` CDM mutation.
15. Manual HTML5 content refresh.
16. SAPUI5 Version Overview link.
17. Progress/status/error UI.
18. Restriction to selected Work Zone administration routes.

The extension must preserve these capabilities but add a mandatory safety model:

```text
Inspect → Select → Preview → Confirm → Execute → Verify
```

Do not add a backend for V1.

Do not request or store SAP credentials, cookies, CSRF tokens, or API keys.

Do not bypass SAP permissions. Every operation must run only with the current signed-in SAP user's existing authorization.

Do not perform background mutations. Every write action must be explicitly initiated by the user.

---

# 1. Product Positioning

## 1.1 Problem

Work Zone administrators may need to inspect or update `sap-ui-version` configuration across many local business applications. Doing this manually can be repetitive and error-prone.

The working Tampermonkey script proves that the current authenticated Work Zone browser session can perform the same internal UI operations required to:

- list local business apps;
- inspect their CDM;
- detect current UI5 version configuration;
- update known `sap-ui-version` paths;
- trigger manual HTML5 provider refresh.

Productize this workflow into a safer, maintainable browser extension.

## 1.2 Product promise

```text
Inspect → Select → Preview Changes → Update → Verify
```

Tagline suggestion:

```text
A lightweight browser toolkit for SAP BTP Work Zone administration.
```

## 1.3 Disclaimer

Display in README, About, Store listing, and privacy docs:

```text
SAP BTP Workzone Kit is an independent browser extension.
It is not affiliated with, endorsed by, sponsored by, or produced by SAP SE.
SAP, SAP BTP, SAPUI5, and SAP Build Work Zone are trademarks or registered
trademarks of SAP SE or its affiliates.
```

Do not use the official SAP logo as the extension icon unless explicitly authorized.

If the public Store name causes trademark/review friction, support changing only the display name to:

```text
BTP Workzone Kit — for SAP BTP Work Zone
```

without changing architecture or functionality.

---

# 2. Branding

## 2.1 Palette

Primary:

```text
#00c8e8
```

Secondary:

```text
#0B1F33
```

Accent:

```text
#7659FF
```

Supporting:

```text
Surface Dark:    #102A43
Surface Dark 2:  #163A52
Surface Light:   #F5FBFD
Border Light:    #D5EEF3
Success:         #19B879
Warning:         #F5A623
Danger:          #E5484D
Text Dark:       #10212B
Text Muted:      #6E8794
Text On Dark:    #F7FCFD
```

Optional accent gradient:

```css
linear-gradient(135deg, #00c8e8 0%, #7659ff 100%)
```

Use it sparingly.

## 2.2 Footer

Use:

```text
Made with ❤️ by Leo
```

`Leo` links to:

```text
https://buymeacoffee.com/leotrinh
```

Also include GitHub:

```text
https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit
```

Correct the malformed URL from any old notes. Never use:

```text
https://buymeacoffee.com/leotrinh|
```

Donation must remain optional and non-blocking.

---

# 3. Source Logic Baseline

## 3.1 Constants

Preserve the current functional contract:

```ts
const GRAPHQL_ENDPOINT = "/semantic/graphql";
const HTML5_ENDPOINT = "/semantic/entity/provider/html5";
const CONTEXT_ID = "SUB_ACCOUNT";
const APP_DETAIL_CONCURRENCY = 5;
const MUTATION_DELAY_MS = 300;
```

Current source default version:

```text
1.136.17
```

In the extension, move this to user preferences/default settings. Do not treat it as a permanent business rule.

## 3.2 Eligible pages

The source only exposes the helper when:

```text
hostname contains ".dt."
```

and hash includes one of:

```text
Content-Manage
Site-Directory
Provider-Manage
SubAccount-Settings
Transport-Manager
```

Preserve this V1 eligibility behavior.

Centralize it:

```ts
const VALID_WORKZONE_HASH_SEGMENTS = [
  "Content-Manage",
  "Site-Directory",
  "Provider-Manage",
  "SubAccount-Settings",
  "Transport-Manager"
] as const;
```

## 3.3 Environment extraction

Preserve the source fallback order.

Start with:

```ts
subdomain = window.location.hostname.split(".")[0]
```

Then inspect:

```text
meta[name="sap.flp.cf.Config"]
meta[name="sap.ushellConfig.siteConfig"]
```

Parse JSON safely.

Preferred:

```text
accountData.tenantId
accountData.subDomain
```

Fallback:

```text
tenantId
identityZoneId
```

Never crash because one metadata element contains invalid JSON.

## 3.4 CSRF

Source behavior:

```http
HEAD /semantic/graphql
x-csrf-token: Fetch
```

Then read response header:

```text
x-csrf-token
```

Preserve this working contract.

Improve it by:

- checking HTTP status;
- detecting redirect/login;
- classifying 401/403 separately;
- requiring token presence;
- keeping token only inside the page runtime;
- refreshing before mutations when needed.

## 3.5 List local business apps

Current GraphQL query:

```graphql
query getEntities(
  $contextId: String!,
  $contextType: Context!,
  $queryData: QueryData,
  $queryOptions: QueryOptions,
  $tenantId: String
) {
  entities(
    contextId: $contextId,
    contextType: $contextType,
    queryData: $queryData,
    queryOptions: $queryOptions,
    tenantId: $tenantId
  ) {
    items {
      id
      title
      baseId
      entityType
    }
    continuationToken
  }
}
```

Variables:

```json
{
  "contextId": "SUB_ACCOUNT",
  "contextType": "SUB_ACCOUNT",
  "tenantId": "",
  "queryData": {
    "entityTypes": ["businessapp"],
    "pageSize": 50,
    "continuationToken": null
  },
  "queryOptions": {}
}
```

Continue until no continuation token remains.

Preserve the source filter:

```ts
baseId === null
```

V1 therefore operates on local/root business apps only.

## 3.6 App details

Current query:

```graphql
query getEntity($baseCdmEntity: BaseCdmEntityInput!) {
  entity(baseCdmEntity: $baseCdmEntity) {
    cdm
  }
}
```

Variables:

```json
{
  "baseCdmEntity": {
    "entityId": "<dynamic-app-id>",
    "entityType": "businessapp",
    "contextId": "SUB_ACCOUNT",
    "contextType": "SUB_ACCOUNT"
  }
}
```

Current userscript loads details in batches of 5.

Preserve max concurrency:

```text
5
```

Implement a reusable concurrency limiter.

## 3.7 UI5 version extraction

Supported source path A:

```ts
payload
  .targetAppConfig["sap.integration"]
  .urlTemplateParams
  .query["sap-ui-version"]
```

Supported source path B:

```ts
payload
  .visualizations[key]
  .vizConfig["sap.flp"]
  .target
  .parameters["sap-ui-version"]
  .value
```

The current script returns the first value it finds.

The extension must improve this and detect all supported targets.

Use:

```ts
interface Ui5VersionTarget {
  kind: "targetAppConfig" | "visualization";
  visualizationKey?: string;
  currentValue: string | null;
  writable: boolean;
}

interface Ui5VersionDetection {
  displayVersion: string | null;
  targets: Ui5VersionTarget[];
  consistency: "none" | "single" | "consistent" | "mixed";
}
```

If multiple targets contain different versions, show:

```text
Mixed
```

instead of silently choosing one.

## 3.8 Search and sort

Preserve source search:

```text
application title contains search text
OR
current UI5 config contains search text
```

Enhance optionally with app ID.

Preserve sortable app title/current version.

Improve version sorting to numeric/semantic-ish ordering rather than simple lexicographic sorting.

## 3.9 Bulk update

Current userscript:

1. iterates selected rows;
2. reads target version;
3. deep clones CDM;
4. updates known version paths;
5. sends `batchProcess` mutation;
6. waits 300 ms;
7. continues.

The extension must preserve the actual mutation shape but insert:

```text
Plan → Preview → Confirm
```

before any write.

## 3.10 HTML5 refresh

Preserve:

```http
POST /semantic/entity/provider/html5
```

Payload:

```json
{
  "providerId": "saas_approuter",
  "contentAdditionMode": "manual",
  "subdomain": "<dynamic>",
  "subaccountId": "<dynamic>"
}
```

Require explicit user confirmation.

---

# 4. Security Model

## 4.1 Authentication

The extension does not implement SAP login.

Flow:

```text
User logs into Work Zone normally
        ↓
opens supported admin page
        ↓
opens extension
        ↓
extension validates active tab
        ↓
packaged runtime performs same-origin SAP requests
        ↓
SAP enforces current user's permissions
```

Never:

- ask for SAP username/password;
- collect IAS credentials;
- read Chrome cookies;
- store session cookies;
- persist CSRF;
- use shared technical users;
- use API keys;
- bypass roles.

## 4.2 Permissions

Use only:

```json
[
  "activeTab",
  "scripting",
  "storage",
  "sidePanel"
]
```

Do not add:

```text
cookies
webRequest
declarativeNetRequest
history
identity
nativeMessaging
unlimitedStorage
<all_urls>
```

unless a future requirement is separately reviewed and justified.

V1 should not need permanent host permissions.

## 4.3 Host validation

Do not use a weak substring test.

Implement:

```ts
export function isSapWorkzoneHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");

  return (
    host.endsWith(".hana.ondemand.com") &&
    host.includes(".dt.")
  );
}
```

Also require:

```ts
url.protocol === "https:"
```

Reject:

```text
hana.ondemand.com.attacker.example
fakehana.ondemand.com
sap.dt.hana.ondemand.com.evil.test
http://...
```

## 4.4 Private/internal endpoint isolation

Treat Work Zone GraphQL and HTML5 endpoints as internal UI contracts, not a guaranteed public extension API.

Therefore:

- all endpoint strings live in the Work Zone adapter;
- all GraphQL documents live in one integration folder;
- React components never contain GraphQL text;
- unexpected response shape fails safely;
- compatibility assumptions are documented/versioned.

---

# 5. Architecture

Use a React side panel rather than injecting the old 900px Tampermonkey dashboard into the SAP DOM.

```text
┌──────────────────────────────────────────────────────┐
│ Chromium Browser                                     │
│                                                      │
│  React Side Panel                                    │
│  Apps / HTML5 / About                                │
│          │                                           │
│          ▼                                           │
│  MV3 Service Worker                                  │
│  - active-tab validation                             │
│  - inject packaged runtime                           │
│          │                                           │
│          ▼                                           │
│  Work Zone Page Runtime (MAIN world)                 │
│  - environment                                       │
│  - CSRF                                              │
│  - GraphQL                                           │
│  - HTML5 refresh                                     │
│          │                                           │
└──────────┼───────────────────────────────────────────┘
           ▼
  Current authenticated SAP Work Zone tenant
```

Benefits:

- no CSS collision with SAP;
- clearer permission model;
- better accessibility;
- easier tests;
- cleaner SPA navigation;
- better Store story.

---

# 6. Project Structure

Create:

```text
chrome-ext-sap-btp-workzone-kit/
├── README.md
├── CHANGELOG.md
├── PRIVACY.md
├── SECURITY.md
├── CONTRIBUTING.md
├── LICENSE.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.js
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── app.css
│   │   ├── components/
│   │   │   ├── AppHeader.tsx
│   │   │   ├── ConnectionCard.tsx
│   │   │   ├── EnvironmentBadge.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   ├── SearchBox.tsx
│   │   │   ├── SortMenu.tsx
│   │   │   ├── VersionInput.tsx
│   │   │   ├── AppsTable.tsx
│   │   │   ├── AppRow.tsx
│   │   │   ├── AppDetailsDrawer.tsx
│   │   │   ├── UpdatePreview.tsx
│   │   │   ├── UpdateProgress.tsx
│   │   │   ├── UpdateResults.tsx
│   │   │   ├── Html5RefreshCard.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── CompatibilityBanner.tsx
│   │   │   ├── ErrorBanner.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── AboutPanel.tsx
│   │   └── hooks/
│   ├── page-runtime/
│   │   ├── index.ts
│   │   ├── command-handler.ts
│   │   └── runtime-types.ts
│   ├── integrations/
│   │   └── sap-workzone/
│   │       ├── adapter.ts
│   │       ├── eligibility.ts
│   │       ├── environment.ts
│   │       ├── csrf.ts
│   │       ├── constants.ts
│   │       ├── graphql/
│   │       │   ├── get-entities.ts
│   │       │   ├── get-entity.ts
│   │       │   └── batch-process.ts
│   │       ├── app-list.ts
│   │       ├── app-detail.ts
│   │       ├── ui5-version-reader.ts
│   │       ├── ui5-version-writer.ts
│   │       ├── html5-refresh.ts
│   │       ├── response-classifier.ts
│   │       ├── compatibility.ts
│   │       └── types.ts
│   ├── domain/
│   │   ├── app-record.ts
│   │   ├── ui5-version.ts
│   │   ├── update-plan.ts
│   │   ├── update-result.ts
│   │   ├── sorting.ts
│   │   ├── search.ts
│   │   └── selection.ts
│   ├── messaging/
│   │   ├── protocol.ts
│   │   └── validation.ts
│   ├── storage/
│   │   ├── schema.ts
│   │   ├── preferences-repository.ts
│   │   └── migrations.ts
│   ├── shared/
│   │   ├── errors.ts
│   │   ├── guards.ts
│   │   ├── logger.ts
│   │   ├── sleep.ts
│   │   ├── concurrency.ts
│   │   └── version-format.ts
│   └── i18n/
│       ├── en.ts
│       └── index.ts
├── tests/
│   ├── fixtures/
│   │   ├── workzone-pages/
│   │   ├── graphql/
│   │   └── cdm/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
│   ├── build-extension.mjs
│   ├── package-extension.mjs
│   ├── verify-manifest.mjs
│   └── check-no-remote-code.mjs
├── docs/
│   ├── architecture.md
│   ├── decisions.md
│   ├── compatibility.md
│   ├── release-checklist.md
│   ├── store-listing.md
│   └── reviewer-instructions.md
└── dist/
```

---

# 7. Manifest V3

Initial manifest:

```json
{
  "manifest_version": 3,
  "name": "SAP BTP Workzone Kit",
  "short_name": "Workzone Kit",
  "version": "0.1.0",
  "description": "Inspect and safely maintain supported SAP BTP Work Zone application UI5 version configuration from the current authenticated admin session.",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "sidePanel"
  ],
  "background": {
    "service_worker": "service-worker.js",
    "type": "module"
  },
  "action": {
    "default_title": "Open SAP BTP Workzone Kit"
  },
  "side_panel": {
    "default_path": "sidepanel/index.html"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

No host permissions in V1.

No remote code.

No inline JS.

No `unsafe-eval`.

No remote fonts.

---

# 8. Service Worker + Command Protocol

On install:

```ts
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
});
```

Before each page operation:

1. query active tab;
2. validate HTTPS;
3. validate Work Zone host;
4. validate admin route;
5. inject packaged page runtime;
6. execute fixed command.

Commands:

```ts
type WorkzoneCommand =
  | "PING"
  | "GET_ENVIRONMENT"
  | "SCAN_APPS"
  | "GET_APP_VERSION_TARGETS"
  | "BUILD_UPDATE_PLAN"
  | "UPDATE_APP_UI5_VERSION"
  | "VERIFY_APP_UI5_VERSION"
  | "REFRESH_HTML5_CONTENT";
```

Never accept arbitrary:

```text
URL
GraphQL query
GraphQL mutation
HTTP headers
JavaScript
```

from React.

---

# 9. MAIN-World Runtime

Use packaged `chrome.scripting.executeScript(... world: "MAIN")`.

Runtime namespace:

```ts
declare global {
  interface Window {
    __BTP_WORKZONE_KIT__?: {
      runtimeVersion: string;
      protocolVersion: 1;
      handle(
        command: WorkzoneCommand,
        payload: unknown
      ): Promise<WorkzoneCommandResponse>;
    };
  }
}
```

Requirements:

- idempotent bootstrap;
- Zod validation;
- fixed endpoints only;
- no secrets exposed globally;
- no CSRF returned to React;
- no raw HTML returned;
- no arbitrary network operation.

Preferred privacy boundary:

```text
React asks SCAN_APPS
runtime internally obtains CSRF
runtime calls SAP
runtime returns normalized app data
```

---

# 10. Adapter Contracts

```ts
export interface SapWorkzoneAdapter {
  detectEnvironment(): Promise<WorkzoneEnvironment>;

  listLocalBusinessApps(): Promise<WorkzoneAppSummary[]>;

  getBusinessAppDetail(
    appId: string
  ): Promise<WorkzoneAppDetail>;

  inspectUi5Version(
    detail: WorkzoneAppDetail
  ): Ui5VersionDetection;

  createUi5VersionUpdatePlan(
    detail: WorkzoneAppDetail,
    targetVersion: string
  ): Ui5VersionUpdatePlan;

  updateUi5Version(
    plan: Ui5VersionUpdatePlan
  ): Promise<Ui5VersionUpdateResult>;

  verifyUi5Version(
    appId: string,
    expectedVersion: string
  ): Promise<Ui5VersionVerification>;

  refreshHtml5Content(): Promise<Html5RefreshResult>;
}
```

Environment:

```ts
interface WorkzoneEnvironment {
  eligible: boolean;
  matchedRoute?: string;
  subaccountId?: string;
  subdomain?: string;
  metadataSource?: string;
  compatibilityStatus:
    | "ready"
    | "partial"
    | "sign_in_required"
    | "unsupported_page"
    | "page_changed";
  warnings: string[];
}
```

App summary:

```ts
interface WorkzoneAppSummary {
  id: string;
  title: string;
  baseId: string | null;
  entityType: string;
  locality: "local" | "linked";
}
```

V1 only displays local apps.

---

# 11. GraphQL Client

Every request must:

- use relative same-origin `/semantic/graphql`;
- include `Content-Type: application/json`;
- use current internally acquired CSRF;
- use `credentials: "same-origin"`;
- detect redirects;
- validate HTTP status;
- parse JSON safely;
- inspect GraphQL `errors`.

Error codes:

```ts
type WorkzoneRequestErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "AUTHORIZATION_DENIED"
  | "CSRF_MISSING"
  | "CSRF_REJECTED"
  | "HTTP_ERROR"
  | "GRAPHQL_ERROR"
  | "INVALID_RESPONSE"
  | "NETWORK_ERROR"
  | "PAGE_CHANGED"
  | "UNKNOWN";
```

Never log raw request/response bodies in production.

---

# 12. Scan Flow

```text
Open extension
   ↓
Validate environment
   ↓
Scan Applications
   ↓
Acquire CSRF internally
   ↓
getEntities with pagination
   ↓
filter baseId === null
   ↓
render app summaries
   ↓
getEntity details with max concurrency 5
   ↓
inspect UI5 paths
   ↓
progressively update rows
```

Show:

```text
53 local apps found
35 / 53 inspected
```

Do not wait for all details before rendering.

Provide:

```text
Cancel Scan
Re-scan
```

Protect against repeated continuation tokens causing an infinite loop.

---

# 13. Version Inspection

User-facing states:

```text
1.136.17
N/A
Mixed
Error
```

Use `N/A` only when CDM is valid but no supported version path exists.

Use `Error` for fetch/parsing/permission failures.

If mixed:

```text
Mixed (2 versions)
```

Details drawer example:

```text
targetAppConfig              1.136.17
visualization: launchTile    1.120.7
visualization: appTile       1.136.17
```

Record every writable target.

---

# 14. Search, Sort, Selection

Search by:

- title;
- current version;
- app ID;
- N/A/Mixed text.

Sort:

- App Name;
- Current UI5;
- Status.

Version sort must correctly order:

```text
1.9.0
1.10.0
1.100.0
1.136.17
```

Selection state must use app IDs, not DOM indices.

Keep selection across search/sort.

Actions:

```text
Select all visible
Select all loaded
Clear selection
```

Never ambiguously select hidden rows.

---

# 15. Target Version

Toolbar:

```text
Target UI5 Version: [1.136.17]
[Apply to selected]
```

Also allow:

```text
Apply to visible
Apply to all loaded
```

but default to `Apply to selected`.

Per-app overrides supported.

Validate syntax:

```regex
^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$
```

Show:

```text
Format valid — existence not verified.
```

External link:

```text
https://ui5.sap.com/versionoverview.html
```

Do not scrape it in V1.

---

# 16. Mandatory Update Planner

Never mutate directly from the table.

Flow:

```text
Select → Configure Target → Preview Changes → Confirm → Execute
```

Plan:

```ts
interface Ui5VersionUpdatePlan {
  appId: string;
  appTitle: string;
  current: Ui5VersionDetection;
  targetVersion: string;
  changes: Ui5VersionChange[];
  noOp: boolean;
  warnings: string[];
}

interface Ui5VersionChange {
  kind: "targetAppConfig" | "visualization";
  visualizationKey?: string;
  from: string | null;
  to: string;
  pathDescription: string;
}
```

No-op:

```text
Already configured
```

Skip by default.

No writable target:

```text
No supported UI5 version target found
```

Do not post unchanged CDM.

Mixed target preview:

```text
3 configuration targets will be normalized to 1.136.17
```

---

# 17. Update Confirmation

Before mutation:

```text
Update UI5 Version Configuration?

Apps selected:       14
Apps changing:       11
Already configured:   2
Unsupported:          1

Target versions:
1.136.17 → 10 apps
1.120.32 → 1 app

This will modify SAP BTP Work Zone application configuration
using your current signed-in SAP account.

[Cancel] [Update 11 Applications]
```

The final button must contain the exact count.

---

# 18. CDM Mutation

Always clone original CDM.

Preferred:

```ts
structuredClone(detail.cdm)
```

Path A:

```ts
payload
  .targetAppConfig["sap.integration"]
  .urlTemplateParams
  .query["sap-ui-version"] = targetVersion;
```

Path B:

```ts
payload
  .visualizations[key]
  .vizConfig["sap.flp"]
  .target
  .parameters["sap-ui-version"] = {
    value: targetVersion,
    format: "plain"
  };
```

Do not modify sibling parameters.

Do not send mutation if:

```ts
plan.changes.length === 0
```

Mutation reference:

```graphql
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
```

Variables preserve current behavior:

```json
{
  "batchOperations": {
    "BATCH": [
      {
        "metadata": {
          "operation": "UPDATE"
        },
        "cdm": "<modified-cdm>"
      }
    ]
  },
  "actions": {},
  "contextId": "SUB_ACCOUNT",
  "contextType": "SUB_ACCOUNT",
  "isCherryPickScenario": false
}
```

Success requires:

- acceptable HTTP status;
- parseable response;
- no GraphQL errors.

---

# 19. Update Queue

Preserve sequential writes.

Default delay:

```text
300 ms
```

Never use `Promise.all()` for writes.

States:

```ts
type BulkUpdateState =
  | "idle"
  | "planning"
  | "confirming"
  | "updating"
  | "verifying"
  | "completed"
  | "cancelled";
```

Per app:

```ts
type AppUpdateStatus =
  | "pending"
  | "updating"
  | "updated"
  | "verifying"
  | "verified"
  | "failed"
  | "skipped"
  | "unknown";
```

V1 default:

```text
No automatic mutation retry.
```

If auth/CSRF fails:

- stop queue;
- do not continue;
- explain session problem.

---

# 20. Verification

After successful mutation:

1. re-fetch app detail;
2. re-run version inspection;
3. compare every writable target with expected version.

Result:

```ts
type VerificationStatus =
  | "verified"
  | "mismatch"
  | "not_verifiable"
  | "verification_failed";
```

Display distinct states:

```text
Updated + Verified
Updated, verification mismatch
Updated, verification unavailable
```

Never call mutation-only success “Verified”.

---

# 21. HTML5 Refresh

Dedicated tab/card:

```text
HTML5 Content Refresh

Provider:     saas_approuter
Subdomain:    <detected>
Subaccount:   <detected>

[Refresh HTML5 Content]
```

Require confirmation:

```text
Refresh HTML5 Content?

This sends a manual content refresh request for the current
SAP BTP Work Zone subaccount.

[Cancel] [Refresh Content]
```

Disable if subdomain/subaccount context is missing.

Use:

```http
POST /semantic/entity/provider/html5
```

with:

```json
{
  "providerId": "saas_approuter",
  "contentAdditionMode": "manual",
  "subdomain": "<dynamic>",
  "subaccountId": "<dynamic>"
}
```

Typed result:

```ts
type Html5RefreshStatus =
  | "triggered"
  | "authentication_required"
  | "authorization_denied"
  | "csrf_error"
  | "server_error"
  | "invalid_response"
  | "network_error";
```

Do not auto-trigger HTML5 refresh after UI5 bulk updates.

---

# 22. UI Information Architecture

Tabs:

```text
Apps
HTML5
About
```

Header:

```text
SAP BTP Workzone Kit
[Ready]

Subaccount: <abbreviated>
Subdomain:  <detected>
Route:      Content Manager
```

Apps tab:

```text
Connection
Scan toolbar
Search / Sort
Target version
App list/table
Sticky action footer
```

HTML5 tab:

```text
Current environment
Refresh explanation
Confirmation action
Current-session result
```

About:

```text
Version
Independent-product disclaimer
GitHub
Made with ❤️ by Leo
Privacy
Security
Compatibility
```

---

# 23. Table UX

Columns:

```text
☐
Application
Current UI5
Targets
Target UI5
Status
⋯
```

Application:

```text
Title
app-id
Local
```

Current UI5 badges:

```text
1.136.17
N/A
Mixed
Error
```

Targets:

```text
2 targets
```

Status:

```text
Loading
Ready
Queued
Updating
Updated
Verified
Failed
Skipped
```

On narrow side-panel width, switch rows to cards.

---

# 24. React Security

Never use:

```ts
dangerouslySetInnerHTML
```

The source userscript interpolates SAP app values into HTML strings. The extension must rely on React escaping.

Use text rendering only.

No raw GraphQL/SAP HTML inside the UI.

---

# 25. Local Preferences

Use `chrome.storage.local` only for lightweight non-sensitive preferences:

```ts
interface UserPreferences {
  schemaVersion: 1;
  defaultTargetVersion: string;
  sortColumn: "title" | "currentVersion" | "status";
  sortDirection: "asc" | "desc";
  compactRows: boolean;
  onboardingCompleted: boolean;
}
```

Do not persist:

- CSRF;
- raw CDM;
- app catalog;
- app IDs across tenants;
- subaccount IDs;
- GraphQL responses;
- mutation results;
- session state.

No `unlimitedStorage`.

V1 may require a new scan after side-panel reload.

---

# 26. Safe Diagnostics

Provide:

```text
Copy Safe Diagnostics
```

Model:

```ts
interface WorkzoneCompatibilityDiagnostic {
  extensionVersion: string;
  adapterVersion: string;
  hostnameClass: "hana.ondemand.com";
  route?: string;
  metadataSource?: string;
  csrfAvailable: boolean;
  graphqlReachable: boolean;
  capabilities: {
    listApps: boolean;
    appDetails: boolean;
    updateUi5: boolean;
    html5Refresh: boolean;
  };
  errorCodes: string[];
}
```

Exclude:

- actual hostname;
- tenant/subaccount;
- app IDs;
- app names;
- CDM;
- tokens.

---

# 27. Error Model

```ts
type AppErrorCode =
  | "NOT_SAP_WORKZONE_PAGE"
  | "UNSUPPORTED_PROTOCOL"
  | "UNSUPPORTED_ROUTE"
  | "ENVIRONMENT_NOT_FOUND"
  | "SUBACCOUNT_NOT_FOUND"
  | "SUBDOMAIN_NOT_FOUND"
  | "AUTHENTICATION_REQUIRED"
  | "AUTHORIZATION_DENIED"
  | "CSRF_NOT_FOUND"
  | "CSRF_REJECTED"
  | "GRAPHQL_HTTP_ERROR"
  | "GRAPHQL_ERROR"
  | "INVALID_GRAPHQL_RESPONSE"
  | "APP_LIST_FAILED"
  | "APP_DETAIL_FAILED"
  | "CDM_INVALID"
  | "INVALID_TARGET_VERSION"
  | "NO_WRITABLE_TARGET"
  | "UPDATE_FAILED"
  | "UPDATE_RESULT_UNKNOWN"
  | "VERIFICATION_FAILED"
  | "HTML5_REFRESH_FAILED"
  | "PAGE_CHANGED"
  | "NETWORK_ERROR";
```

```ts
interface AppError {
  code: AppErrorCode;
  userMessage: string;
  technicalMessage?: string;
  retryable: boolean;
  safeDiagnostic?: Record<string, string | number | boolean>;
}
```

---

# 28. Logging

Production logs:

```text
errors + privacy-safe diagnostics only
```

Never log:

- CSRF;
- CDM;
- GraphQL bodies;
- response bodies;
- tenant IDs;
- app names;
- cookies.

Implement:

```ts
redactForLog()
```

---

# 29. Accessibility

Required:

- keyboard navigation;
- visible focus;
- labels;
- `aria-live` progress;
- accessible modal focus;
- ESC close where safe;
- no color-only status;
- accessible checkboxes;
- sufficient contrast;
- reduced motion.

---

# 30. Synthetic Test Fixtures

Never commit production SAP data.

Use fake apps:

```text
Sales Overview
Purchase Order Cockpit
Warehouse Monitor
Example HTML5 App
Internal Demo Portal
```

Fake IDs:

```text
app-sales-overview
app-po-cockpit
app-warehouse-monitor
```

Fixture A — targetAppConfig:

```json
{
  "payload": {
    "targetAppConfig": {
      "sap.integration": {
        "urlTemplateParams": {
          "query": {
            "sap-ui-version": "1.120.7"
          }
        }
      }
    }
  }
}
```

Fixture B — visualization:

```json
{
  "payload": {
    "visualizations": {
      "viz-1": {
        "vizConfig": {
          "sap.flp": {
            "target": {
              "parameters": {
                "sap-ui-version": {
                  "value": "1.136.17",
                  "format": "plain"
                }
              }
            }
          }
        }
      }
    }
  }
}
```

Fixture C: mixed versions.

Fixture D: no supported UI5 path.

Fixture E: malformed CDM.

---

# 31. Test Plan

## Host

Test:

- valid `.dt.*.hana.ondemand.com`;
- uppercase;
- trailing dot;
- no `.dt.`;
- malicious suffix;
- HTTP;
- unrelated domain.

## Routes

Test all:

```text
Content-Manage
Site-Directory
Provider-Manage
SubAccount-Settings
Transport-Manager
```

and unsupported hashes.

## Environment

Test both metadata selectors and all fallback fields.

Test malformed JSON.

## CSRF

Test:

- token;
- missing token;
- 401;
- 403;
- redirect;
- 500.

## Pagination

Test:

- one page;
- multiple pages;
- empty;
- GraphQL error;
- repeated continuation token protection;
- linked apps filtered.

## Concurrency

Assert app-detail requests never exceed 5 concurrently.

## Version detection

Test:

- path A;
- path B;
- both same;
- mixed;
- multiple visualizations;
- N/A;
- malformed.

## Search/sort

Test title/version/ID and semantic version ordering.

## Planner

Test:

- one target;
- multiple targets;
- no-op;
- mixed normalization;
- unsupported;
- invalid target;
- original CDM unchanged.

## Mutation

Test:

- HTTP 200 success;
- HTTP 200 GraphQL error;
- 401;
- 403;
- 500;
- invalid JSON;
- network error.

## Verification

Test exact/mismatch/failure.

## HTML5

Test dynamic environment payload and all failure classes.

## React

Test full happy path, selection persistence, preview, confirmation, queue, verification, HTML5, GitHub and donation links.

---

# 32. E2E Mock Work Zone

Create a local mock server emulating:

```text
/semantic/graphql
/semantic/entity/provider/html5
```

Support:

```text
getEntities
getEntity
batchProcess
```

Mock page includes metadata and an eligible hash route.

Required E2E:

1. Open mock Work Zone.
2. Open extension.
3. Environment Ready.
4. Scan apps.
5. Test >50 apps pagination.
6. Max detail concurrency 5.
7. Search/sort.
8. Stable selection.
9. Target version.
10. Preview.
11. Confirm.
12. Exact mutation check.
13. Verify only known CDM paths changed.
14. Re-fetch verification.
15. HTML5 refresh.
16. Auth expiration stops queue.
17. No developer-domain calls occur unless user clicks an external link.

---

# 33. Privacy Policy Draft

Create `PRIVACY.md`:

```text
Privacy Policy — SAP BTP Workzone Kit

Effective date: [INSERT RELEASE DATE]

SAP BTP Workzone Kit is an independent browser extension developed by
Leo Trinh.

Repository:
https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit

1. Purpose

The extension assists authenticated SAP BTP Work Zone administrators with
inspecting application UI5 version configuration, updating supported UI5
version parameters after explicit confirmation, and triggering the current
subaccount's manual HTML5 content refresh.

2. SAP authentication

The extension does not provide SAP login. Users sign in directly to SAP BTP
Work Zone. The extension does not collect or store SAP usernames, passwords,
browser session cookies, or CSRF tokens.

3. Local operation

Supported operations are executed from the user's browser against the current
SAP BTP Work Zone tenant using the permissions of the currently signed-in SAP
account.

4. Developer data collection

V1 does not transmit SAP tenant data, application configuration, application
names, app IDs, CSRF tokens, or Work Zone responses to the developer.

5. Local preferences

The extension may store lightweight interface preferences such as the last
target UI5 version and sort preference in Chrome extension local storage.

6. No sale of user data

The developer does not sell user data.

7. External links

GitHub:
https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit

Support:
https://buymeacoffee.com/leotrinh

These open only after explicit user interaction.

8. SAP

SAP BTP Work Zone is a third-party service. Data processed by SAP is governed
by the agreements and policies applicable to the user's SAP environment.

9. Disclaimer

SAP BTP Workzone Kit is an independent browser extension. It is not affiliated
with, endorsed by, sponsored by, or produced by SAP SE.
```

---

# 34. Store Listing Draft

Name:

```text
SAP BTP Workzone Kit
```

Fallback:

```text
BTP Workzone Kit — for SAP BTP Work Zone
```

Short description:

```text
Inspect and safely update supported SAP BTP Work Zone UI5 version settings and trigger HTML5 content refresh.
```

Long description:

```text
SAP BTP Workzone Kit is an independent browser helper for SAP BTP Work Zone
administrators.

FEATURES

• Scan local Work Zone business applications
• Inspect configured sap-ui-version values
• Detect target-app and visualization UI5 configuration
• Search and sort applications
• Set a global target UI5 version
• Override target version per application
• Preview exact changes before writing
• Bulk update selected applications sequentially
• Verify configuration after update
• Trigger manual HTML5 content refresh
• Open SAPUI5 version overview
• Copy privacy-safe compatibility diagnostics

SECURITY & PRIVACY

• Uses your existing signed-in SAP browser session
• Does not collect SAP passwords
• Does not read or store browser cookies
• Does not store CSRF tokens
• No backend
• No telemetry in V1
• No remote executable code
• Mutations require explicit confirmation

SAP BTP Workzone Kit is an independent browser extension. It is not affiliated
with, endorsed by, sponsored by, or produced by SAP SE.

Repository:
https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit

Made with ❤️ by Leo
https://buymeacoffee.com/leotrinh
```

---

# 35. Store Single Purpose

```text
SAP BTP Workzone Kit's single purpose is to help an authenticated SAP BTP
Work Zone administrator inspect and maintain supported Work Zone application
configuration and trigger the current subaccount's manual HTML5 content refresh
through explicit user-initiated actions.
```

---

# 36. Permission Justification

`activeTab`:

```text
Temporary access to the active SAP BTP Work Zone administration tab after
explicit user action.
```

`scripting`:

```text
Runs the packaged Work Zone adapter in the current page context so same-origin
authenticated requests can use the current SAP browser session.
```

`storage`:

```text
Stores lightweight preferences only. No SAP tokens, cookies, CDM, tenant data,
or GraphQL responses are persisted.
```

`sidePanel`:

```text
Provides the scan, preview, update, HTML5 refresh, and results interface.
```

---

# 37. Remote Code

All executable JavaScript must be bundled.

No CDN scripts.

No `eval`.

No `new Function`.

External links may include only user-click navigation such as:

```text
https://ui5.sap.com/versionoverview.html
https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit
https://buymeacoffee.com/leotrinh
```

---

# 38. README Requirements

README sections:

1. Overview.
2. Screenshots.
3. Features.
4. Security model.
5. Privacy.
6. Supported Work Zone routes.
7. Store installation.
8. Load-unpacked development install.
9. Development commands.
10. Architecture.
11. How UI5 update works.
12. HTML5 refresh.
13. Compatibility limitations.
14. Troubleshooting.
15. Security reporting.
16. Disclaimer.
17. Support development.

Header:

```text
# SAP BTP Workzone Kit

A browser toolkit for inspecting and safely maintaining supported SAP BTP
Work Zone administration configuration.

Repository:
https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit

Made with ❤️ by Leo
https://buymeacoffee.com/leotrinh
```

---

# 39. Git Hygiene

Never commit:

```text
production Work Zone HTML
production GraphQL responses
production CDM
subaccount IDs
real tenant hostnames
customer application names
cookies
CSRF
production screenshots
```

Synthetic fixtures only.

---

# 40. Build Stack

Use:

- React;
- TypeScript strict;
- Vite;
- Zod;
- native fetch;
- Vitest;
- Testing Library;
- Playwright;
- ESLint;
- Prettier.

No Axios required.

No heavy UI framework unless justified.

Scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "build": "node scripts/build-extension.mjs",
    "package": "node scripts/package-extension.mjs",
    "verify:manifest": "node scripts/verify-manifest.mjs",
    "verify:no-remote-code": "node scripts/check-no-remote-code.mjs",
    "ci": "pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm verify:manifest && pnpm verify:no-remote-code"
  }
}
```

Package:

```text
artifacts/sap-btp-workzone-kit-v0.1.0.zip
```

`manifest.json` must be at ZIP root.

---

# 41. GitHub Actions

On PR/main:

```text
install
typecheck
lint
tests
build
manifest verification
remote-code verification
package
upload ZIP artifact
```

Do not store SAP credentials in CI.

Do not run tests against production SAP.

---

# 42. Implementation Phases

## Phase 0 — Foundation

Deliver:

- repo/tooling;
- MV3 manifest;
- React side panel;
- service worker;
- branding/theme;
- footer/About;
- tests/build.

Acceptance:

- Chrome load unpacked;
- Edge load unpacked;
- action opens panel;
- permissions exact;
- no remote code.

## Phase 1 — Connection

Deliver:

- host validation;
- route validation;
- MAIN-world runtime;
- environment extraction;
- compatibility status.

Acceptance:

- valid SAP Work Zone page detected;
- malicious domain rejected;
- malformed metadata safe;
- no token returned to React.

## Phase 2 — CSRF + GraphQL

Deliver:

- CSRF acquisition;
- fixed GraphQL client;
- typed errors.

Acceptance:

- CSRF internal only;
- auth/GraphQL errors classified;
- no sensitive logs.

## Phase 3 — Scan

Deliver:

- pagination;
- local-app filter;
- detail query;
- concurrency 5;
- progressive rows;
- cancel/re-scan.

Acceptance:

- continuation loop protected;
- max 5 concurrent detail requests;
- one app failure does not kill whole scan.

## Phase 4 — UI5 Inspection

Deliver:

- both source paths;
- all target detection;
- Mixed;
- N/A vs Error;
- detail drawer.

Acceptance:

- fixture classifications correct.

## Phase 5 — Table UX

Deliver:

- search;
- version sort;
- stable selection;
- select-visible/all;
- target input;
- global/per-row values.

Acceptance:

- filter/sort preserves selection;
- invalid target blocked.

## Phase 6 — Planner

Deliver:

- immutable clone;
- exact diff;
- no-op;
- unsupported;
- preview;
- confirmation.

Acceptance:

- no SAP mutation before confirm;
- unrelated CDM unchanged.

## Phase 7 — Mutation

Deliver:

- batchProcess;
- sequential queue;
- 300ms delay;
- typed result;
- stop on auth/CSRF.

Acceptance:

- no parallel writes;
- GraphQL errors not called success.

## Phase 8 — Verification

Deliver:

- re-fetch;
- compare expected;
- final result summary.

Acceptance:

- mutation and verification are separate statuses.

## Phase 9 — HTML5

Deliver:

- HTML5 tab;
- dynamic context;
- confirmation;
- fixed payload;
- typed result.

Acceptance:

- disabled if context missing;
- no auto-refresh after version update.

## Phase 10 — Store

Deliver:

- privacy;
- security;
- listing;
- permission justification;
- reviewer instructions;
- sanitized screenshots;
- package.

---

# 43. Reviewer Instructions

Because full behavior requires an authenticated Work Zone admin environment:

- provide a sanitized screen recording;
- provide screenshots;
- explain permissions;
- use a legitimate test tenant/account only if available;
- never provide production credentials;
- never implement an auth bypass/demo backdoor.

---

# 44. Compatibility Documentation

Track:

```text
extension version
adapter version
last manual test date
Chrome version
Edge version
observed Work Zone route variants
GraphQL operation names
supported CDM paths
known limitations
```

State clearly:

```text
The extension relies on authenticated SAP BTP Work Zone UI behavior and
internal same-origin endpoints. SAP may change these without an
extension-specific compatibility contract.
```

---

# 45. When SAP Changes Behavior

1. Reproduce in an authorized environment.
2. Compare normal browser network flow.
3. Sanitize response into fixture.
4. Update only the Work Zone adapter.
5. Add regression test.
6. Bump adapter compatibility version.
7. Release patch.

Do not broaden permissions as a shortcut.

---

# 46. Future Roadmap

V1.1:

- German UI;
- app filters;
- export safe result summary;
- improved version sort;
- optional re-scan after update.

V1.2:

- filter:
  - has override;
  - N/A;
  - Mixed;
  - errors;
- config diff viewer.

V2:

Potential broader Workzone Kit tools:

- content-provider diagnostics;
- site-directory diagnostics;
- transport helper;
- configuration inspection;
- safe export/report.

Every new write capability must follow:

```text
Inspect → Preview → Confirm → Execute → Verify
```

---

# 47. Explicit Non-Goals

Do not:

- automate SAP login;
- bypass SAP auth;
- use cookie API;
- expose CSRF;
- run background mutations;
- auto-update on panel open;
- auto-refresh HTML5 after update;
- mutate unknown CDM by guess;
- accept arbitrary GraphQL;
- add telemetry;
- add remote code;
- persist raw CDM;
- use unlimitedStorage.

---

# 48. Safety Invariants

Always true:

```text
Mutations require explicit user action.
Bulk mutation requires preview + confirmation.
React never receives raw CSRF.
Chrome cookies are never read.
Only the active eligible Work Zone tab can be operated on.
Only fixed Work Zone endpoints are callable.
Only known sap-ui-version paths are changed.
Original CDM stays immutable.
No-op plans do not write.
Bulk writes are sequential.
Verification is distinct from mutation success.
```

---

# 49. Definition of Done

- [ ] Chrome works.
- [ ] Edge works.
- [ ] Only activeTab/scripting/storage/sidePanel.
- [ ] No permanent host permission.
- [ ] No cookies.
- [ ] No unlimitedStorage.
- [ ] Side panel architecture.
- [ ] Valid Work Zone host/route validation.
- [ ] Both metadata variants.
- [ ] CSRF internal to runtime.
- [ ] Pagination.
- [ ] Local apps only.
- [ ] Detail concurrency ≤5.
- [ ] Path A detection.
- [ ] Path B detection.
- [ ] Mixed detection.
- [ ] N/A distinct from Error.
- [ ] Search.
- [ ] Semantic-ish sort.
- [ ] Stable selection.
- [ ] Global target.
- [ ] Per-app override.
- [ ] Target validation.
- [ ] Mandatory preview.
- [ ] Exact diff.
- [ ] No-op skip.
- [ ] Unsupported skip.
- [ ] Exact confirmation count.
- [ ] Sequential mutation.
- [ ] Auth/CSRF stops queue.
- [ ] GraphQL response validation.
- [ ] Post-update verification.
- [ ] HTML5 explicit confirmation.
- [ ] Dynamic HTML5 environment payload.
- [ ] No sensitive logs.
- [ ] Synthetic fixtures only.
- [ ] GitHub link correct.
- [ ] Buy Me a Coffee link correct.
- [ ] `Made with ❤️ by Leo`.
- [ ] SAP disclaimer.
- [ ] Privacy policy.
- [ ] Store listing.
- [ ] Tests/build pass.
- [ ] ZIP valid.

---

# 50. Manual QA

Connection:

- [ ] logged out;
- [ ] wrong site;
- [ ] valid Work Zone;
- [ ] wrong hash;
- [ ] SPA route change;
- [ ] malformed metadata.

Scan:

- [ ] 0 apps;
- [ ] 1 app;
- [ ] >50;
- [ ] >100;
- [ ] one detail failure;
- [ ] auth expiry;
- [ ] cancel;
- [ ] re-scan.

Inspection:

- [ ] path A;
- [ ] path B;
- [ ] both same;
- [ ] Mixed;
- [ ] N/A;
- [ ] malformed.

Update:

- [ ] one app;
- [ ] many;
- [ ] per-app targets;
- [ ] no-op;
- [ ] unsupported;
- [ ] mixed normalization;
- [ ] invalid target;
- [ ] cancel confirm;
- [ ] GraphQL error;
- [ ] CSRF/auth error;
- [ ] verification success;
- [ ] verification mismatch.

HTML5:

- [ ] context;
- [ ] no context;
- [ ] cancel;
- [ ] success;
- [ ] 403;
- [ ] CSRF failure;
- [ ] server failure.

Privacy:

- [ ] no cookies permission;
- [ ] no unlimitedStorage;
- [ ] no remote code;
- [ ] no telemetry;
- [ ] no CSRF logs;
- [ ] no raw CDM persisted;
- [ ] donation only on click.

---

# 51. Current Internal Endpoint Constants

Keep only in:

```text
src/integrations/sap-workzone/constants.ts
```

```ts
export const GRAPHQL_ENDPOINT = "/semantic/graphql";
export const HTML5_ENDPOINT = "/semantic/entity/provider/html5";
export const CONTEXT_ID = "SUB_ACCOUNT";
export const APP_DETAIL_CONCURRENCY = 5;
export const MUTATION_DELAY_MS = 300;
export const HTML5_PROVIDER_ID = "saas_approuter";
export const HTML5_CONTENT_ADDITION_MODE = "manual";
```

Do not make endpoint/query values user-editable.

---

# 52. Current GraphQL Reference

List apps:

```graphql
query getEntities(
  $contextId: String!,
  $contextType: Context!,
  $queryData: QueryData,
  $queryOptions: QueryOptions,
  $tenantId: String
) {
  entities(
    contextId: $contextId,
    contextType: $contextType,
    queryData: $queryData,
    queryOptions: $queryOptions,
    tenantId: $tenantId
  ) {
    items {
      id
      title
      baseId
      entityType
    }
    continuationToken
  }
}
```

App detail:

```graphql
query getEntity($baseCdmEntity: BaseCdmEntityInput!) {
  entity(baseCdmEntity: $baseCdmEntity) {
    cdm
  }
}
```

Update:

```graphql
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
```

These are compatibility references from the working Tampermonkey flow, not promises of a stable public SAP API.

---

# 53. Key Improvements Over the Tampermonkey Script

Old:

```text
Large dashboard injected directly into SAP DOM
```

New:

```text
React Side Panel
```

Old:

```text
SAP values interpolated into innerHTML
```

New:

```text
React escaped text
```

Old:

```text
Update begins immediately
```

New:

```text
Preview → Confirm → Update
```

Old:

```text
Mutation success = Done
```

New:

```text
Mutation → Re-fetch → Verify
```

Old:

```text
First UI5 version found
```

New:

```text
All supported targets + Mixed detection
```

Old:

```text
DOM checkbox index state
```

New:

```text
Stable selection by app ID
```

Old:

```text
Basic fetch errors
```

New:

```text
HTTP + GraphQL + auth + CSRF + invalid-response classification
```

Old:

```text
UI and SAP internals mixed in one userscript
```

New:

```text
Versioned SAP Work Zone adapter
```

---

# 54. Product Metadata

Use consistently:

```text
Product: SAP BTP Workzone Kit
Short name: Workzone Kit
Repository: https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit
Primary: #00c8e8
Secondary: #0B1F33
Accent: #7659FF
Author: Leo Trinh
Footer: Made with ❤️ by Leo
Leo URL: https://buymeacoffee.com/leotrinh
GitHub: https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit
```

---

# 55. First Codex Execution Request

Start implementation in the repository:

```text
https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit
```

If already cloned, inspect before editing.

Do not assume the repo is empty.

## Step A — Inspect

1. Inspect repository.
2. Inspect git status.
3. Inspect package/tooling.
4. Preserve unrelated work.
5. Report current state.

## Step B — Foundation

Implement:

- React;
- TypeScript strict;
- Vite;
- Manifest V3;
- service worker;
- side panel;
- primary `#00c8e8`;
- secondary `#0B1F33`;
- accent `#7659FF`;
- footer;
- About;
- GitHub link;
- `Made with ❤️ by Leo`;
- lint/typecheck/tests/build.

## Step C — Environment runtime

Implement:

- secure hostname validation;
- supported route validation;
- MAIN-world runtime;
- idempotent bootstrap;
- command protocol;
- environment extraction;
- safe compatibility status.

## Step D — Tests

Add tests for:

- valid/malicious hosts;
- routes;
- both SAP metadata variants;
- malformed metadata;
- missing context;
- runtime protocol.

## Step E — Verification

Run:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm verify:manifest
pnpm verify:no-remote-code
```

Produce Phase 0/1 report.

Do not proceed to GraphQL mutation until the foundation passes.

---

# 56. Next Codex Phases

After Phase 0/1:

## Scan phase

Implement CSRF, fixed GraphQL client, pagination, local filtering, detail query, concurrency 5, progressive loading, cache, cancel/re-scan.

## Inspection/table phase

Implement all UI5 target detection, Mixed/N/A, search, semantic version sort, stable selection, global/per-row target versions.

## Planner phase

Implement immutable update planning, exact diff, no-op/unsupported detection, mandatory preview and confirmation.

Prove unrelated CDM remains byte-for-byte structurally equivalent except approved paths.

## Mutation phase

Implement fixed `batchProcess`, sequential 300ms queue, no automatic ambiguous retry, auth/CSRF stop.

## Verification phase

Re-fetch and verify.

## HTML5 phase

Implement dedicated confirmed refresh flow using the current source payload.

## Release phase

Complete privacy, security, Store docs, sanitized screenshots, package, and release report.

---

# 57. Required Codex Report Format

At the end of every implementation phase:

```text
Summary
Files Added
Files Modified
Architecture Decisions
Security/Permission Changes
Tests Added
Commands Run
Results
Manual Verification Needed
Known Risks
Next Phase
```

Do not answer merely:

```text
Done
```

---

# 58. Final Principle

This extension is an administrative tool.

Optimize for:

```text
correctness > speed
preview > surprise
least privilege > convenience
verification > optimistic success
compatibility isolation > page hacks
explicit user action > background automation
```

When Work Zone behavior is uncertain:

```text
fail safely
```

Never guess a mutation schema.

Never broaden Chrome permissions as a shortcut.

Never silently change more CDM than the preview showed.

The user must always understand:

```text
what will change
which apps will change
how many apps will change
whether SAP accepted the mutation
whether the final configuration was verified
```
