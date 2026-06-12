import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCESS_VALUES,
  REQUIRED_DIRS,
  expectedPageTypeForPath,
  isFolderNotePath,
  routeRows,
} from "../scripts/lib/convention.mjs";

test("access model remains the strict two-value model", () => {
  assert.deepEqual(ACCESS_VALUES, ["authoritative", "read-only"]);
});

test("required PM lanes are centralized", () => {
  assert.deepEqual(REQUIRED_DIRS, ["roadmap", "system", "history", "archive", "docs", "features"]);
});

test("folder-note detection handles root and nested indexes", () => {
  assert.equal(isFolderNotePath("Project Management.md", "Project Management"), true);
  assert.equal(isFolderNotePath("docs/Developer Guide/Developer Guide.md", "Project Management"), true);
  assert.equal(isFolderNotePath("docs/Developer Guide/known-bugs.md", "Project Management"), false);
});

test("page type inference follows canonical lanes", () => {
  assert.equal(expectedPageTypeForPath("roadmap/plans/2026-06-12_redesign.md", "Project Management"), "planning");
  assert.equal(expectedPageTypeForPath("decisions/D-011_ADR_model.md", "Project Management"), "decision");
  assert.equal(expectedPageTypeForPath("features/validation-and-repair.md", "Project Management"), "feature");
  assert.equal(expectedPageTypeForPath("docs/User Guide/getting-started.md", "Project Management"), "note");
  assert.equal(expectedPageTypeForPath("roadmap/roadmap.md", "Project Management"), "index");
});

test("route table exposes expected lanes for README generation/checking", () => {
  const lanes = routeRows().map(([lane]) => lane);
  assert.ok(lanes.includes("system/"));
  assert.ok(lanes.includes("roadmap/plans/"));
  assert.ok(lanes.includes("decisions/"));
});
