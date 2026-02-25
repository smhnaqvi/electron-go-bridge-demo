import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2] ?? "host";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const outputDir = join(rootDir, "backend", "bin");

mkdirSync(outputDir, { recursive: true });

const targets =
  mode === "all"
    ? [
        { goarch: "arm64", suffix: "arm64" },
        { goarch: "amd64", suffix: "x64" },
      ]
    : [hostTarget()];

for (const target of targets) {
  const outputPath = join(outputDir, `sidecar-darwin-${target.suffix}`);
  const command = `GOTOOLCHAIN=local GOOS=darwin GOARCH=${target.goarch} go build -o "${outputPath}" ./backend`;
  console.log(`[build-sidecar] ${command}`);
  execSync(command, { cwd: rootDir, stdio: "inherit" });
}

function hostTarget() {
  if (process.arch === "arm64") return { goarch: "arm64", suffix: "arm64" };
  return { goarch: "amd64", suffix: "x64" };
}
