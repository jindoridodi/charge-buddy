import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

function runImporter(scenario = "single") {
  const directory = mkdtempSync(join(tmpdir(), "charge-buddy-import-"));
  try {
    writeFileSync(join(directory, ".env.local"), "NREL_API_KEY=test-nrel-key\nNEXT_PUBLIC_SUPABASE_URL=https://import-test.invalid\nSUPABASE_SERVICE_ROLE_KEY=test-service-key\n");
    const env = { ...process.env, IMPORT_SCENARIO: scenario };
    for (const key of ["NREL_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) delete env[key];
    const result = spawnSync(process.execPath, ["--import", new URL("./fixtures/nrel-import.mjs", import.meta.url).href, fileURLToPath(new URL("../scripts/import-nrel.mjs", import.meta.url))], { cwd: directory, env, encoding: "utf8", timeout: 10_000 });
    return result;
  } finally {
    assert.ok(directory.startsWith(join(tmpdir(), "charge-buddy-import-")));
    rmSync(directory, { recursive: true });
  }
}

test("the real importer loads .env.local and normalizes imported records without network access", () => {
  const result = runImporter();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Imported or updated 1 chargers/);
});

test("a malformed later import page aborts without deactivating existing chargers", () => {
  const result = runImporter("missing-array");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NREL import incomplete/);
  assert.doesNotMatch(result.stderr, /AssertionError/);
});

test("complete multi-page imports reconcile missing records only after the last station", () => {
  const result = runImporter("complete");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Imported or updated 201 chargers; marked 1001 missing/);
});

test("inconsistent pagination and invalid or duplicate stations prevent deactivation", () => {
  for (const scenario of ["missing-total", "wrong-offset", "changed-total", "short-page", "duplicate", "invalid-row"]) {
    const result = runImporter(scenario);
    assert.notEqual(result.status, 0, scenario);
    assert.match(result.stderr, /NREL import incomplete/, scenario);
    assert.doesNotMatch(result.stderr, /AssertionError/, scenario);
  }
});

test("the scheduled refresh runs the guarded NREL importer with repository secrets", () => {
  const workflow = readFileSync(fileURLToPath(new URL("../.github/workflows/nrel-refresh.yml", import.meta.url)), "utf8");
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /npm run import:nrel/);
  for (const secret of ["NREL_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    assert.ok(workflow.includes(secret + ": ${{ secrets." + secret + " }}"));
  }
});
