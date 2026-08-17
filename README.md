# SAP BTP Workzone Kit

A browser toolkit for reducing repetitive SAP BTP Work Zone administration work — especially when maintaining `sap-ui-version` across many applications and environments.

**Chrome Web Store:**  
https://chromewebstore.google.com/detail/sap-btp-workzone-kit/kbdalgkmidoabbpcfceppheinkpljobi

**GitHub:**  
https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit

Made with ❤️ by [Leo](https://buymeacoffee.com/leotrinh)

> **Disclaimer**
>
> SAP BTP Workzone Kit is an independent browser extension. It is not affiliated with, endorsed by, sponsored by, or produced by SAP SE. SAP, SAP BTP, SAPUI5, and SAP Build Work Zone are trademarks or registered trademarks of SAP SE or its affiliates.

---

## Why this exists

In real SAP Build Work Zone projects, always running an application against the latest SAPUI5 version is not necessarily what you want.

An application may need to stay on a known stable UI5 version because of compatibility issues or regressions. In Work Zone, this can be controlled through the custom parameter:

```text
sap-ui-version
```

Changing that parameter for one application is easy.

Doing it across many applications and customer environments is not.

For example:

```text
20 applications
× 10 customer environments
= 200 application configurations
```

The manual workflow can quickly become:

```text
Content Manager
→ search for the application
→ open the application
→ open its configuration
→ locate custom parameters
→ add/update sap-ui-version
→ save
→ repeat
```

The configuration change itself is small.

**Navigation is the expensive part.**

SAP BTP Workzone Kit turns that nested workflow into a flat administration view:

```text
Application              Current UI5      Target UI5      Status
-----------------------------------------------------------------
Sales Overview           1.120.7          1.136.17        Ready
Order Management         1.120.7          1.136.17        Ready
Warehouse Monitor        N/A              -               Unsupported
Customer Portal          Mixed            1.136.17        Review
```

The goal is simple:

```text
Inspect → Select → Preview → Update → Verify
```

---

## From Tampermonkey script to browser extension

This project started as a Tampermonkey helper created to solve the repetitive Work Zone configuration workflow above.

The first version proved that the workflow could be flattened into one list and maintained much faster.

Once the script became useful beyond a single task, it was turned into a proper Chromium extension so it could provide:

- a maintainable codebase;
- safer write operations;
- a clearer permission model;
- reusable UI;
- automated tests;
- easier installation;
- open-source contributions.

The original idea remains the same:

> Don't open the same nested configuration screen hundreds of times for a change that can be represented safely in one table.

---

## Features

### Application scanning

- Scan local SAP BTP Work Zone business applications.
- Handle paginated Work Zone application lists.
- Load application details with controlled concurrency.
- Show app title, ID, current UI5 configuration, target version, and status.

### UI5 version inspection

Detect supported `sap-ui-version` configuration from:

- target application configuration;
- visualization target parameters.

The extension does not silently collapse different values.

It distinguishes between:

```text
Configured version
N/A
Mixed
Error
```

A mixed state can be inspected before making any changes.

### Search and sort

- Search by application name.
- Search by application ID.
- Search by current UI5 version.
- Semantic version-aware sorting.
- Stable selection while filtering or sorting.

### Target UI5 version

- Set a global target version.
- Override target version per application.
- Apply a version to selected applications.
- Use the quick version selector.
- Open the full searchable SAPUI5 Version Overview.
- Review SAP-published version information, including available lifecycle/provisioning information where exposed by the current version dataset.

### Safe bulk update

Bulk changes follow:

```text
Select
→ build update plan
→ preview exact changes
→ explicit confirmation
→ sequential update
→ verification
```

The extension:

- skips no-op changes;
- does not guess unsupported CDM structures;
- updates selected apps sequentially;
- adds a delay between writes;
- stops the queue on authentication/CSRF failures;
- distinguishes mutation success from verification success.

### Post-update verification

A successful mutation is not automatically treated as a verified configuration.

After updating an application, the extension can re-read its configuration and report:

```text
Updated + Verified
Updated, verification mismatch
Updated, verification unavailable
Failed
```

### HTML5 content refresh

A separate utility can trigger a manual HTML5 content refresh for the current Work Zone subaccount.

This action:

- uses the detected current environment;
- requires explicit confirmation;
- is never automatically triggered after a UI5 version update.

### Two UI entry points

The extension can be opened through:

1. the Chrome/Edge extension toolbar → Side Panel;
2. the floating ⚡ button on eligible Work Zone administration pages → a full-screen
   overlay on the same page.

Both entry points use the same underlying functionality.

---

## How it works

For this particular Work Zone application-configuration workflow, the extension does not depend on a public API contract that exposes the required operation.

Instead, it operates from the already authenticated Work Zone browser session and reproduces the relevant same-origin operations used by the Work Zone UI.

Conceptually:

```text
Authenticated SAP BTP Work Zone
              │
              ▼
      SAP BTP Workzone Kit
              │
              ▼
    Existing browser session
              │
              ▼
 Work Zone same-origin UI operations
```

There is:

```text
no separate SAP login
no shared technical account
no backend proxy
no extension-managed cookie store
```

SAP authorization still applies.

If the currently signed-in user is not allowed to perform an operation, the extension does not provide a way around that authorization.

---

## Security model

Security and least privilege are part of the product design.

### Authentication

The extension does not implement SAP authentication.

You sign in to SAP BTP Work Zone normally.

### Credentials and browser session

The extension does not:

- collect SAP usernames or passwords;
- use Chrome's `cookies` permission;
- persist browser cookies;
- persist CSRF tokens;
- send SAP session data to a developer-controlled backend.

CSRF tokens required by Work Zone are obtained temporarily for the current operation and are not persisted as extension state.

### Chrome permissions

The current manifest requests only:

```text
storage
sidePanel
```

There is no:

```text
activeTab
scripting
cookies
<all_urls>
unlimitedStorage
```

The extension does declare content scripts scoped to:

```text
*://*.hana.ondemand.com/*
```

This is the site-access boundary required for the in-page floating button and Work Zone communication.

Feature eligibility is further restricted to supported SAP Build Work Zone administration hosts/routes.

### Explicit writes

Every write operation requires explicit user action.

UI5 bulk updates require:

```text
Preview → Confirm → Update
```

HTML5 refresh requires its own separate confirmation.

---

## Current browser architecture

The current implementation intentionally differs from the first extension blueprint.

It uses two declaratively loaded page-side layers:

```text
React Side Panel / In-Page Overlay
              │
              ▼
       MV3 Service Worker
              │
              ▼
   Isolated-world Content Script
              │
              ▼
      MAIN-world Fetch Bridge
              │
              ▼
 Current SAP Work Zone session
```

### Isolated-world content script

Responsible for:

- Work Zone eligibility checks;
- floating-button UX;
- environment communication;
- fixed extension command handling;
- relaying supported operations.

### MAIN-world fetch bridge

Some Work Zone same-origin requests — especially the CSRF/GraphQL flow reproduced from the original Tampermonkey script — needed to execute from the page's own JavaScript world.

The packaged MAIN-world bridge therefore performs the final browser `fetch()` operation in the same page execution context used by the proven userscript flow.

This bridge contains packaged extension code only.

No remote JavaScript is loaded.

### Why not `activeTab` + runtime injection?

An earlier design used:

```text
activeTab
+
chrome.scripting.executeScript()
```

That worked when opening the extension through a toolbar user gesture.

It did not fit the floating-button UX because clicking a button already injected into the page does not grant the same `activeTab` permission.

The current declarative content-script architecture allows both:

```text
toolbar → side panel
```

and:

```text
floating button → in-page overlay
```

without requiring `activeTab` or `scripting` permissions.

---

## Supported Work Zone routes

The extension is intended for SAP Build Work Zone administration pages under the current supported Work Zone host pattern.

Feature activation is restricted to routes whose URL hash contains one of:

```text
Content-Manage
Site-Directory
Provider-Manage
SubAccount-Settings
Transport-Manager
```

The floating button is hidden outside eligible administration pages.

---

## Compatibility note

The project relies on authenticated SAP BTP Work Zone UI behavior and same-origin internal endpoints used by the Work Zone browser experience.

These are **not treated as a stable public extension API contract** and may change over time.

For that reason:

- Work Zone-specific logic is isolated from the React UI;
- response shapes are validated;
- unsupported structures fail safely;
- mutation and verification are separate outcomes;
- compatibility assumptions are documented.

Before using write operations against an important production tenant, validate the current release in an appropriate DEV/QAS environment first.

See:

```text
docs/compatibility.md
```

for the current compatibility and manual-verification status.

---

## Installation

### Chrome Web Store

Install the published extension:

https://chromewebstore.google.com/detail/sap-btp-workzone-kit/kbdalgkmidoabbpcfceppheinkpljobi

Then:

1. Sign in to SAP BTP Work Zone normally.
2. Open a supported administration page.
3. Use the floating ⚡ button or the extension toolbar icon.
4. Scan applications.
5. Review current UI5 configuration.
6. Select and preview changes before updating.

### Load unpacked for development

Requirements:

- Node.js
- pnpm

```bash
pnpm install
pnpm build
```

Then:

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select the generated `dist/` folder.
5. Open an eligible Work Zone administration page.

---

## Development

```bash
pnpm install

pnpm dev
pnpm test
pnpm typecheck
pnpm lint

pnpm build
pnpm verify:manifest
pnpm verify:no-remote-code

pnpm ci
```

`pnpm dev` starts the UI development server. Chrome extension APIs are only fully available when running as an installed/unpacked extension.

---

## Testing

The project includes automated coverage for the core testable logic, including areas such as:

- host and route eligibility;
- environment metadata parsing;
- CSRF/request behavior;
- GraphQL response classification;
- pagination;
- concurrency limits;
- UI5 target detection;
- mixed-version detection;
- semantic version sorting;
- update-plan generation;
- immutable CDM mutation;
- no-op handling;
- verification status;
- HTML5 refresh behavior;
- React interaction flows.

Real SAP tenant behavior cannot be completely represented by synthetic fixtures, so manual compatibility testing remains important for operations that write to SAP.

---

## Design principles

The project follows a few simple rules:

```text
correctness > speed
preview > surprise
least privilege > convenience
verification > optimistic success
explicit user action > background automation
```

When a Work Zone structure is unknown:

```text
fail safely
```

The extension should never guess a mutation shape.

---

## Contributing

Contributions, bug reports, compatibility findings, and ideas are welcome.

See:

[CONTRIBUTING.md](CONTRIBUTING.md)

Useful contribution areas include:

- additional Work Zone/CDM variants;
- compatibility improvements;
- diagnostics;
- UI/UX improvements;
- tests;
- documentation;
- other small Work Zone administration pain points that fit the project's safety model.

For new write capabilities, please preserve:

```text
Inspect → Preview → Confirm → Execute → Verify
```

---

## Reporting issues

When reporting compatibility problems, please avoid posting:

- SAP credentials;
- cookies;
- CSRF tokens;
- production CDM payloads;
- customer names;
- private application data;
- tenant-sensitive screenshots.

Prefer sanitized examples and reproduction steps.

See:

[SECURITY.md](SECURITY.md)

---

## Development tooling

Parts of this open-source project were developed with AI-assisted development tooling.

If you are interested in the tool used during development:

[Agent Kit aka Claude Kit](https://agentkit.best/?ref=VAK416FU) *(referral link)*

This link is intentionally kept here as a small development reference rather than a product banner.

---

## License

[MIT](LICENSE)

---

## Disclaimer

SAP BTP Workzone Kit is an independent open-source browser extension.

It is not affiliated with, endorsed by, sponsored by, or produced by SAP SE.

SAP, SAP BTP, SAPUI5, and SAP Build Work Zone are trademarks or registered trademarks of SAP SE or its affiliates.
