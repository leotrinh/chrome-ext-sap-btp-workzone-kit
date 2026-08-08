# Changelog

## [Unreleased]

### Added

- Project foundation: Manifest V3 side panel extension (React + TypeScript + Vite),
  service worker, branding, footer/About tab, build/lint/test/verify tooling.
- SAP BTP Work Zone host + admin-route eligibility validation
  (`src/integrations/sap-workzone/eligibility.ts`).
- Environment extraction from SAP page metadata with safe malformed-JSON handling
  (`src/integrations/sap-workzone/environment.ts`).
- Fixed, schema-validated command protocol between the side panel and the packaged
  MAIN-world page runtime (`PING`, `GET_ENVIRONMENT` implemented).
