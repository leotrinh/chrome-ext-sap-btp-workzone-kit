# Privacy Policy — SAP BTP Workzone Kit

Effective date: [INSERT RELEASE DATE]

SAP BTP Workzone Kit is an independent browser extension developed by Leo Trinh.

Repository: https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit

## 1. Purpose

The extension assists authenticated SAP BTP Work Zone administrators with inspecting
application UI5 version configuration, updating supported UI5 version parameters after
explicit confirmation, and triggering the current subaccount's manual HTML5 content
refresh.

## 2. SAP authentication

The extension does not provide SAP login. Users sign in directly to SAP BTP Work Zone.
The extension does not collect or store SAP usernames, passwords, browser session
cookies, or CSRF tokens.

## 3. Local operation

Supported operations are executed from the user's browser against the current SAP BTP
Work Zone tenant using the permissions of the currently signed-in SAP account.

A small script runs on `*.hana.ondemand.com` pages to show a floating button on
supported Work Zone admin routes. It only reads the page's URL (to decide whether to
show itself) and never reads page content, form data, or SAP application data.

## 4. Developer data collection

This extension does not transmit SAP tenant data, application configuration,
application names, app IDs, CSRF tokens, or Work Zone responses to the developer.

## 5. Local preferences

The extension may store lightweight interface preferences (such as a default target UI5
version or sort order, once those features ship) in Chrome extension local storage
(`chrome.storage.local`). No SAP tokens, cookies, CDM, tenant data, or GraphQL responses
are ever stored there.

## 6. Third-party network request: ui5.sap.com

The side panel's UI5 version picker (quick-filter combobox and "Version Overview"
modal) fetches SAP's public, unauthenticated version list from
`https://ui5.sap.com/versionoverview.json` — the same public data SAP publishes at
https://ui5.sap.com/versionoverview.html. This request carries no cookies, SAP session
data, or credentials (`credentials: "omit"`), and no data from your SAP tenant is sent
to ui5.sap.com. It is used only to populate the version list shown to you.

## 7. No sale of user data

The developer does not sell user data.

## 8. External links

- GitHub: https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit
- Support: https://buymeacoffee.com/leotrinh

These open only after explicit user interaction.

## 9. SAP

SAP BTP Work Zone is a third-party service. Data processed by SAP is governed by the
agreements and policies applicable to the user's SAP environment.

## 10. Disclaimer

SAP BTP Workzone Kit is an independent browser extension. It is not affiliated with,
endorsed by, sponsored by, or produced by SAP SE.
