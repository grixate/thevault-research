import type { SelectedRegistryFile, VaultApi } from "./types";

const browserBaseUrl = import.meta.env.VITE_CORE_URL;

export async function vaultRequest<T>(route: string, payload?: unknown): Promise<T> {
  if (window.vault) {
    return window.vault.request<T>(route, payload);
  }
  if (!browserBaseUrl) {
    throw new Error("Vault IPC bridge is unavailable and VITE_CORE_URL is not set.");
  }
  const mapped = mapRoute(route, payload as any);
  const response = await fetch(`${browserBaseUrl}${mapped.path}`, {
    method: mapped.method,
    headers: { "Content-Type": "application/json" },
    body: mapped.method === "GET" ? undefined : JSON.stringify(mapped.body ?? {})
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function selectFiles(): Promise<string[]> {
  return window.vault?.selectFiles() ?? [];
}

export async function selectAudioFiles(): Promise<string[]> {
  if (window.vault?.selectAudioFiles) return window.vault.selectAudioFiles();
  return selectFilesFromBrowser(".mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.webm,.mp4,.mov,audio/*,video/*");
}

export async function selectModelFiles(): Promise<string[]> {
  return window.vault?.selectModelFiles?.() ?? [];
}

export async function selectRegistryFiles(): Promise<SelectedRegistryFile[]> {
  if (window.vault?.selectRegistryFiles) {
    return window.vault.selectRegistryFiles();
  }
  return selectRegistryFilesFromBrowser();
}

export async function saveAudioRecording(data: ArrayBuffer, mimeType?: string): Promise<{ filePath: string; mimeType: string; sizeBytes: number }> {
  if (!window.vault?.saveAudioRecording) {
    throw new Error("Recording capture requires the Electron desktop bridge.");
  }
  return window.vault.saveAudioRecording({ data, mimeType });
}

export async function saveTextFile(filename: string, contents: string, mimeType = "text/markdown"): Promise<{ saved: boolean; filePath?: string | null; mimeType?: string; sizeBytes?: number }> {
  if (window.vault?.saveTextFile) {
    return window.vault.saveTextFile({ filename, contents, mimeType });
  }
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return { saved: true, filePath: filename, mimeType, sizeBytes: blob.size };
}

function selectRegistryFilesFromBrowser(): Promise<SelectedRegistryFile[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.multiple = true;
    input.style.display = "none";
    input.addEventListener("change", async () => {
      try {
        const files = Array.from(input.files ?? []);
        resolve(
          await Promise.all(
            files.map(async (file) => ({
              filePath: file.name,
              filename: file.name,
              contents: await file.text()
            }))
          )
        );
      } catch (error) {
        reject(error);
      } finally {
        input.remove();
      }
    });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve([]);
    });
    document.body.append(input);
    input.click();
  });
}

function selectFilesFromBrowser(accept: string): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = true;
    input.style.display = "none";
    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []).map((file) => file.name);
      input.remove();
      resolve(files);
    });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve([]);
    });
    document.body.append(input);
    input.click();
  });
}

function mapRoute(route: string, payload?: any): { method: string; path: string; body?: unknown } {
  const routes: Record<string, { method: string; path: string; body?: unknown }> = {
    "health.get": { method: "GET", path: "/health" },
    "stats.get": { method: "GET", path: "/stats" },
    "events.list": { method: "GET", path: `/events?limit=${payload?.limit ?? 50}` },
    "capsules.list": { method: "GET", path: `/capsules?query=${encodeURIComponent(payload?.query ?? "")}&status=${encodeURIComponent(payload?.status ?? "")}&domain=${encodeURIComponent(payload?.domain ?? "")}&tag=${encodeURIComponent(payload?.tag ?? "")}&limit=${payload?.limit ?? 50}&offset=${payload?.offset ?? 0}` },
    "capsules.create": { method: "POST", path: "/capsules", body: payload ?? {} },
    "capsules.get": { method: "GET", path: `/capsules/${payload?.capsuleId}` },
    "capsules.update": { method: "PUT", path: `/capsules/${payload?.capsuleId}`, body: payload?.data ?? {} },
    "capsules.archive": { method: "POST", path: `/capsules/${payload?.capsuleId}/archive` },
    "capsules.items": { method: "GET", path: `/capsules/${payload?.capsuleId}/items?target_type=${encodeURIComponent(payload?.targetType ?? "")}&role=${encodeURIComponent(payload?.role ?? "")}&status=${encodeURIComponent(payload?.status ?? "")}&limit=${payload?.limit ?? 100}&offset=${payload?.offset ?? 0}` },
    "capsules.addItems": { method: "POST", path: `/capsules/${payload?.capsuleId}/items`, body: { items: payload?.items ?? [] } },
    "capsules.removeItem": { method: "DELETE", path: `/capsules/${payload?.capsuleId}/items/${payload?.itemId}` },
    "capsules.health.run": { method: "POST", path: `/capsules/${payload?.capsuleId}/health/run` },
    "capsules.snapshot": { method: "POST", path: `/capsules/${payload?.capsuleId}/versions`, body: payload?.data ?? {} },
    "capsules.versions": { method: "GET", path: `/capsules/${payload?.capsuleId}/versions` },
    "capsules.exportPreview": { method: "POST", path: `/capsules/${payload?.capsuleId}/export/preview`, body: payload?.data ?? {} },
    "capsules.export": { method: "POST", path: `/capsules/${payload?.capsuleId}/export`, body: payload?.data ?? {} },
    "capsules.imports": { method: "GET", path: `/capsules/imports?limit=${payload?.limit ?? 50}&offset=${payload?.offset ?? 0}` },
    "capsules.import": { method: "POST", path: "/capsules/imports", body: payload ?? {} },
    "capsules.import.get": { method: "GET", path: `/capsules/imports/${payload?.importId}` },
    "capsules.import.reviewItems": { method: "POST", path: `/capsules/imports/${payload?.importId}/review-items`, body: {} },
    "notes.list": { method: "GET", path: "/notes" },
    "notes.create": { method: "POST", path: "/notes", body: payload },
    "notes.get": { method: "GET", path: `/notes/${payload?.noteId}` },
    "notes.update": { method: "PUT", path: `/notes/${payload?.noteId}`, body: payload?.data },
    "notes.extract": { method: "POST", path: `/notes/${payload?.noteId}/extract` },
    "notes.generate": { method: "POST", path: "/notes/generate", body: payload },
    "notes.promoteGenerated": { method: "POST", path: `/notes/${payload?.noteId}/promote-generated` },
    "notes.prepareGeneratedReview": { method: "POST", path: `/notes/${payload?.noteId}/prepare-generated-review`, body: payload?.data ?? {} },
    "notes.rejectGenerated": { method: "POST", path: `/notes/${payload?.noteId}/reject-generated` },
    "notes.versions": { method: "GET", path: `/notes/${payload?.noteId}/versions` },
    "notes.restoreVersion": { method: "POST", path: `/notes/${payload?.noteId}/versions/${payload?.version}/restore` },
    "sources.list": { method: "GET", path: "/sources" },
    "sources.importText": { method: "POST", path: "/sources/import-text", body: payload },
    "sources.importFiles": { method: "POST", path: "/sources/import-file", body: payload },
    "sources.pipeline": { method: "GET", path: `/sources/${payload?.sourceId}/pipeline` },
    "sources.blocks": { method: "GET", path: `/sources/${payload?.sourceId}/blocks` },
    "sources.extract": { method: "POST", path: `/sources/${payload?.sourceId}/extract` },
    "search.query": { method: "POST", path: "/search", body: payload },
    "review.list": { method: "GET", path: `/review/items?status=${payload?.status ?? "pending"}` },
    "review.approve": { method: "POST", path: `/review/items/${payload?.itemId}/approve`, body: payload?.data ?? {} },
    "review.reject": { method: "POST", path: `/review/items/${payload?.itemId}/reject`, body: payload?.data ?? {} },
    "review.edit": { method: "POST", path: `/review/items/${payload?.itemId}/edit`, body: payload?.data ?? {} },
    "review.bulk": { method: "POST", path: "/review/bulk", body: payload ?? {} },
    "claims.list": { method: "GET", path: "/claims" },
    "claims.get": { method: "GET", path: `/claims/${payload?.claimId}` },
    "claims.evidence": { method: "GET", path: `/claims/${payload?.claimId}/evidence` },
    "assistant.ask": { method: "POST", path: "/assistant/ask", body: payload },
    "jobs.list": { method: "GET", path: "/jobs" },
    "jobs.get": { method: "GET", path: `/jobs/${payload?.jobId}` },
    "jobs.cancel": { method: "POST", path: `/jobs/cancel/${payload?.jobId}` },
    "nightLab.run": { method: "POST", path: "/night-lab/run", body: payload ?? {} },
    "nightLab.latestBrief": { method: "GET", path: "/night-lab/latest-brief" },
    "tools.list": { method: "GET", path: "/tools" },
    "tools.runTests": { method: "POST", path: `/tools/${payload?.toolId}/run-tests` },
    "tools.run": { method: "POST", path: `/tools/${payload?.toolId}/run`, body: payload?.data ?? {} },
    "tools.runs": { method: "GET", path: `/tools/${payload?.toolId}/runs` },
    "learning.generateDeck": { method: "POST", path: "/learning/generate-deck", body: payload },
    "learning.items": { method: "GET", path: "/learning/items" },
    "learning.session.start": { method: "POST", path: "/learning/session/start", body: payload ?? {} },
    "learning.session.answer": { method: "POST", path: `/learning/session/${payload?.sessionId}/answer`, body: payload?.data ?? {} },
    "ai.providers": { method: "GET", path: "/ai/providers" },
    "ai.hardware": { method: "GET", path: "/ai/hardware" },
    "ai.models.registry": { method: "GET", path: "/ai/models/registry" },
    "ai.modelPacks": { method: "GET", path: "/ai/model-packs" },
    "ai.setup.status": { method: "GET", path: "/ai/setup/status" },
    "ai.readiness.report": { method: "GET", path: "/ai/readiness/report" },
    "ai.readiness.report.export": { method: "GET", path: "/ai/readiness/report/export" },
    "ai.readiness.approvalTemplate.export": { method: "GET", path: "/ai/readiness/approval-template/export" },
    "ai.readiness.approvalTemplate.evaluate": { method: "POST", path: "/ai/readiness/approval-template/evaluate", body: payload ?? {} },
    "ai.registry.validation": { method: "GET", path: "/ai/registry/validation" },
    "ai.registry.releasePlan": { method: "GET", path: "/ai/registry/release-plan" },
    "ai.registry.releasePlan.export": { method: "GET", path: "/ai/registry/release-plan/export" },
    "ai.registry.releasePlan.evaluate": { method: "POST", path: "/ai/registry/release-plan/evaluate", body: payload ?? {} },
    "ai.registry.metadata.hydrate": { method: "POST", path: "/ai/registry/metadata/hydrate", body: payload ?? {} },
    "ai.registry.artifactProbe.evaluate": { method: "POST", path: "/ai/registry/artifact-probe/evaluate", body: payload ?? {} },
    "ai.registry.artifactVerify.evaluate": { method: "POST", path: "/ai/registry/artifact-verify/evaluate", body: payload ?? {} },
    "ai.registry.evidence.apply": { method: "POST", path: "/ai/registry/evidence/apply", body: payload ?? {} },
    "ai.registry.releasePacket.prepare": { method: "POST", path: "/ai/registry/release-packet/prepare", body: payload ?? {} },
    "ai.registry.releaseWorkspace": { method: "GET", path: "/ai/registry/release-workspace" },
    "ai.registry.releaseWorkspace.save": { method: "PUT", path: "/ai/registry/release-workspace", body: payload ?? {} },
    "ai.registry.releaseWorkspace.clear": { method: "DELETE", path: "/ai/registry/release-workspace" },
    "ai.setup.run": { method: "POST", path: "/ai/setup/run", body: payload ?? {} },
    "ai.modelPacks.download": { method: "POST", path: `/ai/model-packs/${payload?.packId}/download` },
    "ai.models.installed": { method: "GET", path: "/ai/models/installed" },
    "ai.models.downloads": { method: "GET", path: "/ai/models/downloads" },
    "ai.models.download": { method: "POST", path: "/ai/models/download", body: payload ?? {} },
    "ai.models.importLocal": { method: "POST", path: "/ai/models/import-local", body: payload ?? {} },
    "ai.models.download.pause": { method: "POST", path: `/ai/models/download/${payload?.downloadId}/pause` },
    "ai.models.download.resume": { method: "POST", path: `/ai/models/download/${payload?.downloadId}/resume` },
    "ai.models.download.cancel": { method: "POST", path: `/ai/models/download/${payload?.downloadId}/cancel` },
    "ai.runtime.health": { method: "GET", path: "/ai/runtime/health" },
    "ai.runtimes.registry": { method: "GET", path: "/ai/runtimes/registry" },
    "ai.runtimes.install": { method: "POST", path: `/ai/runtimes/${payload?.runtimeId}/install`, body: payload ?? {} },
    "ai.runtimes.verify": { method: "POST", path: `/ai/runtimes/${payload?.runtimeId}/verify`, body: payload ?? {} },
    "ai.runtimes.delete": { method: "DELETE", path: `/ai/runtimes/${payload?.runtimeId}`, body: payload ?? {} },
    "ai.runtime.llamaCppTest": { method: "POST", path: "/ai/runtime/llama-cpp/test", body: payload ?? {} },
    "ai.runtime.llamaServer.start": { method: "POST", path: "/ai/runtime/llama-cpp/server/start", body: payload ?? {} },
    "ai.runtime.llamaServer.stop": { method: "POST", path: "/ai/runtime/llama-cpp/server/stop" },
    "ai.models.test": { method: "POST", path: `/ai/models/${payload?.modelId}/test` },
    "ai.models.verify": { method: "POST", path: `/ai/models/${payload?.modelId}/verify` },
    "ai.models.select": { method: "POST", path: `/ai/models/${payload?.modelId}/select` },
    "ai.models.unload": { method: "POST", path: `/ai/models/${payload?.modelId}/unload` },
    "ai.models.delete": { method: "DELETE", path: `/ai/models/${payload?.modelId}` },
    "ai.capabilities": { method: "GET", path: "/ai/capabilities" },
    "ai.capability.update": { method: "PATCH", path: `/ai/capabilities/${payload?.capability}`, body: payload?.data ?? {} },
    "ai.generate.text": { method: "POST", path: "/ai/generate/text", body: payload },
    "ai.generate.json": { method: "POST", path: "/ai/generate/json", body: payload },
    "ai.embed": { method: "POST", path: "/ai/embed", body: payload },
    "ai.embeddings.reindex": { method: "POST", path: "/ai/embeddings/reindex", body: payload ?? {} },
    "ai.rerank": { method: "POST", path: "/ai/rerank", body: payload },
    "ai.runs": { method: "GET", path: `/ai/runs?limit=${payload?.limit ?? 50}` },
    "voice.voices": { method: "GET", path: "/voice/voices" },
    "voice.audioAssets": { method: "GET", path: "/voice/audio-assets" },
    "voice.speechAssets": { method: "GET", path: "/voice/speech-assets" },
    "voice.speechAssetAudio": { method: "GET", path: `/voice/speech-assets/${payload?.speechAssetId}/audio` },
    "voice.transcribe": { method: "POST", path: "/voice/transcribe", body: payload },
    "voice.synthesize": { method: "POST", path: "/voice/synthesize", body: payload },
    "voice.models.download": { method: "POST", path: "/voice/models/download", body: payload ?? {} },
    "export.workspace": { method: "POST", path: "/export/workspace", body: {} },
    "settings.get": { method: "GET", path: "/settings" }
  };
  const mapped = routes[route];
  if (!mapped) throw new Error(`Unsupported browser route: ${route}`);
  return mapped;
}
