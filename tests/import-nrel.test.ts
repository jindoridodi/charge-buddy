import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

test("the real importer loads .env.local and normalizes imported records without network access", () => {
  const directory = mkdtempSync(join(tmpdir(), "charge-buddy-import-"));
  try {
    writeFileSync(join(directory, ".env.local"), "NREL_API_KEY=test-nrel-key\nNEXT_PUBLIC_SUPABASE_URL=https://import-test.invalid\nSUPABASE_SERVICE_ROLE_KEY=test-service-key\n");
    const env = { ...process.env };
    for (const key of ["NREL_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) delete env[key];
    const result = spawnSync(process.execPath, ["--import", new URL("./fixtures/nrel-import.mjs", import.meta.url).href, fileURLToPath(new URL("../scripts/import-nrel.mjs", import.meta.url))], { cwd: directory, env, encoding: "utf8", timeout: 10_000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Imported or updated 1 chargers/);
  } finally {
    assert.ok(directory.startsWith(join(tmpdir(), "charge-buddy-import-")));
    rmSync(directory, { recursive: true });
  }
});
