import { createRequire } from "node:module";
import { mkdir, mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

// A dedicated, logged-out audit browser avoids Windows' temporary-profile
// deletion race. LHCI still owns the audits, three runs and unchanged budgets.
const require = createRequire(import.meta.url);
const cliPath = require.resolve("@lhci/cli/src/cli.js");
const requireCli = createRequire(cliPath);
const { launch } = requireCli("chrome-launcher");
await mkdir(".local", { recursive: true });
const profile = await mkdtemp(path.resolve(".local/lighthouse-profile-"));
const chrome = await launch({
  chromeFlags: ["--headless", "--disable-gpu"],
  userDataDir: profile,
  logLevel: "error",
});
try {
  const child = spawn(
    process.execPath,
    [cliPath, "autorun", `--collect.settings.port=${chrome.port}`],
    { stdio: "inherit", windowsHide: true },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await chrome.kill();
  // Intentionally retain this disposable profile until its file handles close.
  // Never touch the user's Chrome profiles, sessions, or processes.
  process.stdout.write(`Audit-only profile retained at ${profile}\n`);
}
