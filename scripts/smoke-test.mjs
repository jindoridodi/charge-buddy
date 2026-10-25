import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

// Run after npm run build. Use a free port and always stop the owned server.
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "0"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});
let output = "";
let checks = 0;
try {
  const origin = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 30000);
    const inspect = (chunk) => {
      output += chunk.toString();
      const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (url && output.includes("Ready")) { clearTimeout(timeout); resolve(url); }
    };
    server.stdout.on("data", inspect);
    server.stderr.on("data", inspect);
    server.once("error", (error) => { clearTimeout(timeout); reject(error); });
    server.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Server exited (${code}): ${output}`)); });
  });

  async function check(path, text, status = 200) {
    const response = await fetch(`${origin}${path}`);
    const html = await response.text();
    assert.equal(response.status, status, path);
    assert.ok(html.includes(text), `${path} should contain ${text}`);
    assert.ok(!html.includes("This page didn&#x27;t load"), `${path} should not render the error boundary`);
    assert.ok(html.includes("<header") && html.includes("<footer"), `${path} should include the shared layout`);
    console.log(`PASS ${path} (${status})`);
    checks++;
    return html;
  }

  const home = await check("/", "Your Next Charge Is");
  await check("/about", "About Charge Buddy");
  await check("/auth", "Supabase email/password");
  await check("/chargers", "Recommended / Best Value");
  await check("/chargers?q=Willow", "Recommended / Best Value");
  await check("/chargers/c1", "Willow Glen Garage Charger");
  await check("/compare", "Compare Chargers");
  await check("/dashboard", "Welcome back");
  await check("/list-charger", "Turn your home charger into extra income");
  await check("/route-planner", "Route Planner");
  await check("/settings", "Your profile, vehicles and preferences");
  await check("/does-not-exist", "Page not found", 404);
  const css = home.match(/href="([^\"]+\.css[^\"]*)"/)?.[1];
  assert.ok(css, "Homepage should include built CSS");
  assert.equal((await fetch(`${origin}${css.replaceAll("&amp;", "&")}`)).status, 200);
  const photo = home.match(/src="([^\"]+\/hero\.[^\"]+\.jpg)"/)?.[1];
  assert.ok(photo, "Homepage should include the hero image");
  assert.equal((await fetch(`${origin}${photo}`)).status, 200);
  console.log(`Passed ${checks} route checks plus stylesheet and image checks.`);
} finally {
  if (server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    await exited;
  }
}
