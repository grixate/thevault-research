import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allowedRoutes, isVaultRoute, type VaultRoute } from "../electron/ipc/routes";

type RouteCase = {
  route: VaultRoute;
  payload?: Record<string, unknown>;
  method: string;
  path: string;
  body?: unknown;
};

describe("Electron IPC route allowlist", () => {
  it("covers every renderer browser-fallback route", () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const appDir = resolve(testDir, "..");
    const browserRoutes = routeKeysFromFile(resolve(appDir, "src/lib/apiClient.ts"));
    const electronRoutes = new Set(routeKeysFromFile(resolve(appDir, "electron/ipc/routes.ts")));
    const browserOnlyRoutes = browserRoutes.filter((route) => !electronRoutes.has(route));

    expect(browserOnlyRoutes).toEqual([]);
  });

  it("allows production AI release and generated-note review routes used by the renderer", () => {
    const cases: RouteCase[] = [
      {
        route: "notes.prepareGeneratedReview",
        payload: { noteId: "note_generated", data: { force: false, extract: ["claims"] } },
        method: "POST",
        path: "/notes/note_generated/prepare-generated-review",
        body: { force: false, extract: ["claims"] }
      },
      {
        route: "notes.rejectGenerated",
        payload: { noteId: "note_generated" },
        method: "POST",
        path: "/notes/note_generated/reject-generated"
      },
      {
        route: "sources.pipeline",
        payload: { sourceId: "src_pipeline" },
        method: "GET",
        path: "/sources/src_pipeline/pipeline"
      },
      {
        route: "ai.setup.run",
        payload: { mode: "recommended", pack_id: "standard-local-pack" },
        method: "POST",
        path: "/ai/setup/run",
        body: { mode: "recommended", pack_id: "standard-local-pack" }
      },
      {
        route: "ai.registry.metadata.hydrate",
        payload: { model_registry_label: "candidate-models.json" },
        method: "POST",
        path: "/ai/registry/metadata/hydrate",
        body: { model_registry_label: "candidate-models.json" }
      },
      {
        route: "ai.registry.artifactProbe.evaluate",
        payload: { model_registry_label: "candidate-models.json" },
        method: "POST",
        path: "/ai/registry/artifact-probe/evaluate",
        body: { model_registry_label: "candidate-models.json" }
      },
      {
        route: "ai.registry.artifactVerify.evaluate",
        payload: { model_registry_label: "candidate-models.json" },
        method: "POST",
        path: "/ai/registry/artifact-verify/evaluate",
        body: { model_registry_label: "candidate-models.json" }
      },
      {
        route: "ai.registry.releasePacket.prepare",
        payload: { packet_name: "candidate-packet" },
        method: "POST",
        path: "/ai/registry/release-packet/prepare",
        body: { packet_name: "candidate-packet" }
      },
      {
        route: "ai.registry.releaseWorkspace",
        method: "GET",
        path: "/ai/registry/release-workspace"
      },
      {
        route: "ai.registry.releaseWorkspace.save",
        payload: { candidate_status: "ready" },
        method: "PUT",
        path: "/ai/registry/release-workspace",
        body: { candidate_status: "ready" }
      },
      {
        route: "ai.registry.releaseWorkspace.clear",
        method: "DELETE",
        path: "/ai/registry/release-workspace"
      },
      {
        route: "ai.runtime.llamaServer.start",
        payload: { model_id: "tiny-production-llm" },
        method: "POST",
        path: "/ai/runtime/llama-cpp/server/start",
        body: { model_id: "tiny-production-llm" }
      },
      {
        route: "ai.runtime.llamaServer.stop",
        method: "POST",
        path: "/ai/runtime/llama-cpp/server/stop"
      }
    ];

    for (const routeCase of cases) {
      expect(isVaultRoute(routeCase.route)).toBe(true);
      const spec = allowedRoutes[routeCase.route];
      expect(spec.method).toBe(routeCase.method);
      expect(spec.path(routeCase.payload)).toBe(routeCase.path);
      if ("body" in routeCase) {
        expect(spec.body?.(routeCase.payload)).toEqual(routeCase.body);
      }
    }
  });
});

function routeKeysFromFile(path: string): string[] {
  const source = readFileSync(path, "utf8");
  return [...new Set([...source.matchAll(/"([a-zA-Z0-9.]+)"\s*:/g)].map((match) => match[1]))].sort();
}
