import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type CoreHandle = {
  baseUrl: string;
  token: string;
  stop: () => void;
};

let child: ChildProcessWithoutNullStreams | null = null;

export async function startCoreService(): Promise<CoreHandle> {
  const token = crypto.randomBytes(24).toString("base64url");
  const port = await choosePort(8765);
  const root = path.resolve(__dirname, "../../../..");
  const serviceDir = path.join(root, "services/core");
  const dataDir = process.env.VAULT_DATA_DIR ?? path.join(root, ".vault-dev");
  const python = process.env.VAULT_PYTHON ?? "uv";
  const args =
    python === "uv"
      ? ["run", "python", "-m", "vault_core.main", "--port", String(port)]
      : ["-m", "vault_core.main", "--port", String(port)];

  child = spawn(python, args, {
    cwd: serviceDir,
    env: {
      ...process.env,
      VAULT_DESKTOP_TOKEN: token,
      VAULT_DATA_DIR: dataDir,
      VAULT_CORE_PORT: String(port)
    },
    stdio: "pipe"
  });

  child.stdout.on("data", (data) => console.log(`[vault-core] ${String(data).trim()}`));
  child.stderr.on("data", (data) => console.error(`[vault-core] ${String(data).trim()}`));
  child.on("exit", (code) => {
    console.error(`[vault-core] exited with ${code}`);
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl, token);
  return {
    baseUrl,
    token,
    stop: () => {
      child?.kill();
      child = null;
    }
  };
}

async function choosePort(preferred: number): Promise<number> {
  for (let port = preferred; port < preferred + 50; port += 1) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 150);
      await fetch(`http://127.0.0.1:${port}/health`, { signal: controller.signal });
    } catch {
      return port;
    }
  }
  return preferred + Math.floor(Math.random() * 1000);
}

async function waitForHealth(baseUrl: string, token: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Vault Core did not become healthy in time.");
}
