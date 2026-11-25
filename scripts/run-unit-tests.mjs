import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const summary = /ℹ tests \d+[\s\S]*ℹ suites \d+[\s\S]*ℹ pass \d+[\s\S]*ℹ fail \d+[\s\S]*ℹ cancelled \d+[\s\S]*ℹ skipped \d+[\s\S]*ℹ todo \d+[\s\S]*ℹ duration_ms [\d.]+\s*$/;
// shortcut: 60-second per-file bound, increase only when a legitimate unit test needs more time.
const testTimeout = 60_000;

function runTestFile(file) {
  return spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--import", "./scripts/test-setup.mjs", "--test", file], { encoding: "utf8", timeout: testTimeout });
}

export function runUnitTests(files, run = runTestFile) {
  return files.filter((file) => {
    console.log(`Running ${file}`);
    const result = run(file);
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    return result.status !== 0 || !(summary.test(result.stdout ?? "") || summary.test(result.stderr ?? ""));
  });
}

function main() {
  const files = readdirSync("tests").filter((file) => file.endsWith(".test.ts")).sort().map((file) => resolve("tests", file));
  const failures = runUnitTests(files);
  if (failures.length) {
    console.error(`Unit tests did not complete: ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
