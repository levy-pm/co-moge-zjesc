import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "frontend/dist/index.html",
  "frontend/dist/index.js",
  "frontend/dist/package.json",
  "frontend/dist/chat-prompts.js",
  "frontend/dist/modules/logger.js",
  "frontend/dist/modules/session-manager.js",
  "frontend/dist/modules/session-store.js",
  "frontend/dist/modules/ai-policy.js",
  "frontend/dist/modules/validators.js",
  "frontend/dist/modules/upload-guards.js",
  "docs/security-deployment-hardening.md",
  "docs/deployment-checklist.md",
  "docs/threat-model-notes.md",
  "docs/observability-alerting.md",
  "docs/edge-proxy-tls-hardening.md",
  "docs/self-hosted-security-checklist.md",
  "ops/cron-deploy.sh",
  "ops/post-deploy-verify.sh",
  "ops/rollback.sh",
  "ops/nginx/co-moge-zjesc.conf.example",
  "ops/systemd/co-moge-zjesc.service.example",
];

const requiredRunbooks = [
  "docs/runbooks/deployment-runbook.md",
  "docs/runbooks/rollback-runbook.md",
  "docs/runbooks/incident-response.md",
  "docs/runbooks/cron-deploy-checklist.md",
  "docs/runbooks/db-storage-and-schema-verification.md",
];

let missingCount = 0;

for (const relativePath of [...requiredFiles, ...requiredRunbooks]) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    missingCount += 1;
    console.error(`[verify:deploy-ready] Missing required file: ${relativePath}`);
  }
}

if (missingCount > 0) {
  process.exitCode = 1;
  console.error(`[verify:deploy-ready] Failed. Missing items: ${missingCount}`);
} else {
  console.log("[verify:deploy-ready] OK");
}
