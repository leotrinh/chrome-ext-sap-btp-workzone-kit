# Phase 4 — UI5 Version Inspection

Ref: blueprint §3.7, §13.

## Requirements

- Detect ALL supported UI5 version targets in a CDM payload (not just the first found,
  per blueprint's explicit "improve this" instruction):
  - Path A: `payload.targetAppConfig["sap.integration"].urlTemplateParams.query["sap-ui-version"]`
  - Path B: `payload.visualizations[key].vizConfig["sap.flp"].target.parameters["sap-ui-version"].value`
- `Ui5VersionDetection`: `displayVersion`, `targets: Ui5VersionTarget[]`,
  `consistency: "none"|"single"|"consistent"|"mixed"`.
- Malformed/missing CDM never throws — returns `targets: []`, `consistency: "none"`.

## Files to create

```
src/integrations/sap-workzone/ui5-version-reader.ts
src/domain/ui5-version.ts (types)
tests/unit/ui5-version-reader.test.ts
tests/fixtures/cdm/target-app-config.json, visualization.json, both-same.json, mixed.json, no-target.json, malformed.json
```

## TDD steps

1. Write fixtures matching blueprint §30 (Fixture A/B/C/D/E) exactly.
2. `ui5-version-reader.test.ts` — one test per fixture asserting exact `consistency`
   value and target list.
3. Implement `readUi5VersionTargets(cdm)`.

## Acceptance criteria

- [ ] Both path A and B detected independently and together.
- [ ] Multiple visualizations each produce a separate target.
- [ ] Mixed versions → `consistency: "mixed"`, never silently pick one.
- [ ] No supported path → `consistency: "none"`, not an error.
