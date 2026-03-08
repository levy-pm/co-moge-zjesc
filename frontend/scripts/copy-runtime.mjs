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

function copyDirectoryRecursive(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
      continue;
    }
    fs.copyFileSync(sourcePath, targetPath);
  }
}

copyFile("index.js");
copyFile("package.json");
copyFile("chat-prompts.js");
copyDirectoryRecursive(path.join(runtimeDir, "modules"), path.join(distDir, "modules"));

const tmpDir = path.join(distDir, "tmp");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

console.log("Runtime files copied to dist.");
