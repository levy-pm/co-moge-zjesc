import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const distDir = path.join(frontendRoot, "dist");
const runtimeDir = path.join(frontendRoot, "server");

function copyFile(name) {
  const source = path.join(runtimeDir, name);
  const target = path.join(distDir, name);
  fs.copyFileSync(source, target);
}

copyFile("index.js");
copyFile("package.json");

const tmpDir = path.join(distDir, "tmp");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

console.log("Runtime files copied to dist.");
