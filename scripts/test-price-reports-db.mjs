import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const migrations = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
const tests = fileURLToPath(new URL("../tests/", import.meta.url));
const result = spawnSync("docker", [
  "run", "--rm", "--network", "none", "--user", "postgres",
  "--mount", `type=bind,source=${migrations},target=/migrations,readonly`,
  "--mount", `type=bind,source=${tests},target=/tests,readonly`,
  "--entrypoint", "bash", "public.ecr.aws/supabase/postgres:17.11.0.003", "-euc",
  `initdb -D /tmp/price-report-db --auth=trust --no-locale >/dev/null
pg_ctl -s -D /tmp/price-report-db -l /tmp/price-report-db.log -o "-k /tmp -c listen_addresses=" -w -t 20 start
trap 'pg_ctl -D /tmp/price-report-db -m immediate -w stop >/dev/null' EXIT
run_sql() { psql -X -q -h /tmp -U postgres -v ON_ERROR_STOP=1 -f "$1"; }
run_sql /tests/fixtures/supabase-auth.sql
for migration in /migrations/*.sql; do run_sql "$migration"; done
run_sql /tests/price-report-permissions.sql`,
], { stdio: "inherit" });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
