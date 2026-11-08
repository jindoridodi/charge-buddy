import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runUnitTests } from "../scripts/run-unit-tests.mjs";

test("rejects a child that exits zero without a final test summary", () => {
  const fixture = fileURLToPath(new URL("./fixtures/unit-test-runner/incomplete-child.mjs", import.meta.url));
  const failures = runUnitTests(["incomplete.test.ts"], () => spawnSync(process.execPath, [fixture], { encoding: "utf8" }));

  assert.deepEqual(failures, ["incomplete.test.ts"]);
});

test("runs remaining files after an incomplete child", () => {
  const incomplete = fileURLToPath(new URL("./fixtures/unit-test-runner/incomplete-child.mjs", import.meta.url));
  const complete = fileURLToPath(new URL("./fixtures/unit-test-runner/complete-child.mjs", import.meta.url));
  let completeRan = false;
  const failures = runUnitTests(["incomplete.test.ts", "complete.test.ts"], (file) => {
    if (file === "complete.test.ts") completeRan = true;
    return spawnSync(process.execPath, [file === "complete.test.ts" ? complete : incomplete], { encoding: "utf8" });
  });

  assert.equal(completeRan, true);
  assert.deepEqual(failures, ["incomplete.test.ts"]);
});
