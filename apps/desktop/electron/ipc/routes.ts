export type VaultRoute =
  | "health.get"
  | "stats.get"
  | "events.list"
  | "capsules.list"
  | "capsules.create"
  | "capsules.get"
  | "capsules.update"
  | "capsules.archive"
  | "capsules.items"
  | "capsules.addItems"
  | "capsules.removeItem"
  | "capsules.health.run"
  | "capsules.overviewNote"
  | "capsules.snapshot"
  | "capsules.versions"
  | "capsules.exportPreview"
  | "capsules.export"
  | "capsules.imports"
  | "capsules.import"
  | "capsules.import.get"
  | "capsules.import.reviewItems"
  | "notes.list"
  | "notes.create"
  | "notes.get"
  | "notes.update"
  | "notes.extract"
  | "notes.generate"
  | "notes.promoteGenerated"
  | "notes.prepareGeneratedReview"
  | "notes.rejectGenerated"
  | "notes.versions"
  | "notes.restoreVersion"
  | "sources.list"
  | "sources.importText"
  | "sources.importFiles"
  | "sources.get"
  | "sources.pipeline"
  | "sources.blocks"
  | "sources.extract"
  | "sources.rechunk"
  | "search.query"
  | "extraction.run"
  | "review.list"
  | "review.approve"
  | "review.reject"
  | "review.edit"
  | "review.bulk"
  | "graph.node"
  | "graph.neighborhood"
  | "graph.relationPropose"
  | "claims.list"
  | "claims.get"
  | "claims.evidence"
  | "assistant.ask"
  | "jobs.list"
  | "jobs.get"
  | "jobs.cancel"
  | "nightLab.run"
  | "nightLab.latestBrief"
  | "tools.list"
  | "tools.propose"
  | "tools.runTests"
  | "tools.run"
  | "tools.runs"
  | "learning.generateDeck"
  | "learning.items"
  | "learning.session.start"
  | "learning.session.answer"
  | "ai.providers"
  | "ai.hardware"
  | "ai.models.registry"
  | "ai.modelPacks"
  | "ai.setup.status"
  | "ai.readiness.report"
  | "ai.readiness.report.export"
  | "ai.readiness.approvalTemplate.export"
  | "ai.readiness.approvalTemplate.evaluate"
  | "ai.registry.validation"
  | "ai.registry.releasePlan"
  | "ai.registry.releasePlan.export"
  | "ai.registry.releasePlan.evaluate"
  | "ai.registry.metadata.hydrate"
  | "ai.registry.artifactProbe.evaluate"
  | "ai.registry.artifactVerify.evaluate"
  | "ai.registry.evidence.apply"
  | "ai.registry.releasePacket.prepare"
  | "ai.registry.releaseWorkspace"
  | "ai.registry.releaseWorkspace.save"
  | "ai.registry.releaseWorkspace.clear"
  | "ai.setup.run"
  | "ai.modelPacks.download"
  | "ai.models.installed"
  | "ai.models.downloads"
  | "ai.models.download"
  | "ai.models.importLocal"
  | "ai.models.download.pause"
  | "ai.models.download.resume"
  | "ai.models.download.cancel"
  | "ai.runtime.health"
  | "ai.runtimes.registry"
  | "ai.runtimes.install"
  | "ai.runtimes.verify"
  | "ai.runtimes.delete"
  | "ai.runtime.llamaCppTest"
  | "ai.runtime.llamaServer.start"
  | "ai.runtime.llamaServer.stop"
  | "ai.models.test"
  | "ai.models.verify"
  | "ai.models.select"
  | "ai.models.unload"
  | "ai.models.delete"
  | "ai.capabilities"
  | "ai.capability.update"
  | "ai.generate.text"
  | "ai.generate.json"
  | "ai.embed"
  | "ai.embeddings.reindex"
  | "ai.rerank"
  | "ai.runs"
  | "voice.voices"
  | "voice.audioAssets"
  | "voice.speechAssets"
  | "voice.speechAssetAudio"
  | "voice.transcribe"
  | "voice.synthesize"
  | "voice.models.download"
  | "export.workspace"
  | "settings.get";

export type RouteSpec = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: (payload?: any) => string;
  body?: (payload?: any) => unknown;
};

export const allowedRoutes: Record<VaultRoute, RouteSpec> = {
  "health.get": { method: "GET", path: () => "/health" },
  "stats.get": { method: "GET", path: () => "/stats" },
  "events.list": { method: "GET", path: (p) => `/events?limit=${p?.limit ?? 50}` },
  "capsules.list": {
    method: "GET",
    path: (p) =>
      `/capsules?query=${encodeURIComponent(p?.query ?? "")}&status=${encodeURIComponent(p?.status ?? "")}&domain=${encodeURIComponent(p?.domain ?? "")}&tag=${encodeURIComponent(p?.tag ?? "")}&limit=${p?.limit ?? 50}&offset=${p?.offset ?? 0}`
  },
  "capsules.create": { method: "POST", path: () => "/capsules", body: (p) => p ?? {} },
  "capsules.get": { method: "GET", path: (p) => `/capsules/${p.capsuleId}` },
  "capsules.update": { method: "PUT", path: (p) => `/capsules/${p.capsuleId}`, body: (p) => p.data ?? {} },
  "capsules.archive": { method: "POST", path: (p) => `/capsules/${p.capsuleId}/archive` },
  "capsules.items": {
    method: "GET",
    path: (p) =>
      `/capsules/${p.capsuleId}/items?target_type=${encodeURIComponent(p?.targetType ?? "")}&role=${encodeURIComponent(p?.role ?? "")}&status=${encodeURIComponent(p?.status ?? "")}&limit=${p?.limit ?? 100}&offset=${p?.offset ?? 0}`
  },
  "capsules.addItems": { method: "POST", path: (p) => `/capsules/${p.capsuleId}/items`, body: (p) => ({ items: p.items ?? [] }) },
  "capsules.removeItem": { method: "DELETE", path: (p) => `/capsules/${p.capsuleId}/items/${p.itemId}` },
  "capsules.health.run": { method: "POST", path: (p) => `/capsules/${p.capsuleId}/health/run` },
  "capsules.overviewNote": { method: "POST", path: (p) => `/capsules/${p.capsuleId}/overview-note` },
  "capsules.snapshot": { method: "POST", path: (p) => `/capsules/${p.capsuleId}/versions`, body: (p) => p.data ?? {} },
  "capsules.versions": { method: "GET", path: (p) => `/capsules/${p.capsuleId}/versions` },
  "capsules.exportPreview": { method: "POST", path: (p) => `/capsules/${p.capsuleId}/export/preview`, body: (p) => p.data ?? {} },
  "capsules.export": { method: "POST", path: (p) => `/capsules/${p.capsuleId}/export`, body: (p) => p.data ?? {} },
  "capsules.imports": { method: "GET", path: (p) => `/capsules/imports?limit=${p?.limit ?? 50}&offset=${p?.offset ?? 0}` },
  "capsules.import": { method: "POST", path: () => "/capsules/imports", body: (p) => p ?? {} },
  "capsules.import.get": { method: "GET", path: (p) => `/capsules/imports/${p.importId}` },
  "capsules.import.reviewItems": { method: "POST", path: (p) => `/capsules/imports/${p.importId}/review-items` },
  "notes.list": { method: "GET", path: () => "/notes" },
  "notes.create": { method: "POST", path: () => "/notes", body: (p) => p },
  "notes.get": { method: "GET", path: (p) => `/notes/${p.noteId}` },
  "notes.update": { method: "PUT", path: (p) => `/notes/${p.noteId}`, body: (p) => p.data },
  "notes.extract": { method: "POST", path: (p) => `/notes/${p.noteId}/extract` },
  "notes.generate": { method: "POST", path: () => "/notes/generate", body: (p) => p },
  "notes.promoteGenerated": { method: "POST", path: (p) => `/notes/${p.noteId}/promote-generated` },
  "notes.prepareGeneratedReview": { method: "POST", path: (p) => `/notes/${p.noteId}/prepare-generated-review`, body: (p) => p.data ?? {} },
  "notes.rejectGenerated": { method: "POST", path: (p) => `/notes/${p.noteId}/reject-generated` },
  "notes.versions": { method: "GET", path: (p) => `/notes/${p.noteId}/versions` },
  "notes.restoreVersion": { method: "POST", path: (p) => `/notes/${p.noteId}/versions/${p.version}/restore` },
  "sources.list": { method: "GET", path: () => "/sources" },
  "sources.importText": { method: "POST", path: () => "/sources/import-text", body: (p) => p },
  "sources.importFiles": { method: "POST", path: () => "/sources/import-file", body: (p) => p },
  "sources.get": { method: "GET", path: (p) => `/sources/${p.sourceId}` },
  "sources.pipeline": { method: "GET", path: (p) => `/sources/${p.sourceId}/pipeline` },
  "sources.blocks": { method: "GET", path: (p) => `/sources/${p.sourceId}/blocks` },
  "sources.extract": { method: "POST", path: (p) => `/sources/${p.sourceId}/extract` },
  "sources.rechunk": { method: "POST", path: (p) => `/sources/${p.sourceId}/rechunk` },
  "search.query": { method: "POST", path: () => "/search", body: (p) => p },
  "extraction.run": { method: "POST", path: () => "/extraction/run", body: (p) => p },
  "review.list": { method: "GET", path: (p) => `/review/items?status=${p?.status ?? "pending"}` },
  "review.approve": { method: "POST", path: (p) => `/review/items/${p.itemId}/approve`, body: (p) => p.data ?? {} },
  "review.reject": { method: "POST", path: (p) => `/review/items/${p.itemId}/reject`, body: (p) => p.data ?? {} },
  "review.edit": { method: "POST", path: (p) => `/review/items/${p.itemId}/edit`, body: (p) => p.data ?? {} },
  "review.bulk": { method: "POST", path: () => "/review/bulk", body: (p) => p },
  "graph.node": { method: "GET", path: (p) => `/graph/node/${p.nodeId}` },
  "graph.neighborhood": { method: "GET", path: (p) => `/graph/neighborhood/${p.nodeId}?depth=${p.depth ?? 2}` },
  "graph.relationPropose": { method: "POST", path: () => "/graph/relations/propose", body: (p) => p },
  "claims.list": { method: "GET", path: () => "/claims" },
  "claims.get": { method: "GET", path: (p) => `/claims/${p.claimId}` },
  "claims.evidence": { method: "GET", path: (p) => `/claims/${p.claimId}/evidence` },
  "assistant.ask": { method: "POST", path: () => "/assistant/ask", body: (p) => p },
  "jobs.list": { method: "GET", path: () => "/jobs" },
  "jobs.get": { method: "GET", path: (p) => `/jobs/${p.jobId}` },
  "jobs.cancel": { method: "POST", path: (p) => `/jobs/cancel/${p.jobId}` },
  "nightLab.run": { method: "POST", path: () => "/night-lab/run", body: (p) => p ?? {} },
  "nightLab.latestBrief": { method: "GET", path: () => "/night-lab/latest-brief" },
  "tools.list": { method: "GET", path: () => "/tools" },
  "tools.propose": { method: "POST", path: () => "/tools/propose", body: (p) => p },
  "tools.runTests": { method: "POST", path: (p) => `/tools/${p.toolId}/run-tests` },
  "tools.run": { method: "POST", path: (p) => `/tools/${p.toolId}/run`, body: (p) => p.data ?? {} },
  "tools.runs": { method: "GET", path: (p) => `/tools/${p.toolId}/runs` },
  "learning.generateDeck": { method: "POST", path: () => "/learning/generate-deck", body: (p) => p },
  "learning.items": { method: "GET", path: () => "/learning/items" },
  "learning.session.start": { method: "POST", path: () => "/learning/session/start", body: (p) => p ?? {} },
  "learning.session.answer": { method: "POST", path: (p) => `/learning/session/${p.sessionId}/answer`, body: (p) => p.data ?? {} },
  "ai.providers": { method: "GET", path: () => "/ai/providers" },
  "ai.hardware": { method: "GET", path: () => "/ai/hardware" },
  "ai.models.registry": { method: "GET", path: () => "/ai/models/registry" },
  "ai.modelPacks": { method: "GET", path: () => "/ai/model-packs" },
  "ai.setup.status": { method: "GET", path: () => "/ai/setup/status" },
  "ai.readiness.report": { method: "GET", path: () => "/ai/readiness/report" },
  "ai.readiness.report.export": { method: "GET", path: () => "/ai/readiness/report/export" },
  "ai.readiness.approvalTemplate.export": { method: "GET", path: () => "/ai/readiness/approval-template/export" },
  "ai.readiness.approvalTemplate.evaluate": { method: "POST", path: () => "/ai/readiness/approval-template/evaluate", body: (p) => p ?? {} },
  "ai.registry.validation": { method: "GET", path: () => "/ai/registry/validation" },
  "ai.registry.releasePlan": { method: "GET", path: () => "/ai/registry/release-plan" },
  "ai.registry.releasePlan.export": { method: "GET", path: () => "/ai/registry/release-plan/export" },
  "ai.registry.releasePlan.evaluate": { method: "POST", path: () => "/ai/registry/release-plan/evaluate", body: (p) => p ?? {} },
  "ai.registry.metadata.hydrate": { method: "POST", path: () => "/ai/registry/metadata/hydrate", body: (p) => p ?? {} },
  "ai.registry.artifactProbe.evaluate": { method: "POST", path: () => "/ai/registry/artifact-probe/evaluate", body: (p) => p ?? {} },
  "ai.registry.artifactVerify.evaluate": { method: "POST", path: () => "/ai/registry/artifact-verify/evaluate", body: (p) => p ?? {} },
  "ai.registry.evidence.apply": { method: "POST", path: () => "/ai/registry/evidence/apply", body: (p) => p ?? {} },
  "ai.registry.releasePacket.prepare": { method: "POST", path: () => "/ai/registry/release-packet/prepare", body: (p) => p ?? {} },
  "ai.registry.releaseWorkspace": { method: "GET", path: () => "/ai/registry/release-workspace" },
  "ai.registry.releaseWorkspace.save": { method: "PUT", path: () => "/ai/registry/release-workspace", body: (p) => p ?? {} },
  "ai.registry.releaseWorkspace.clear": { method: "DELETE", path: () => "/ai/registry/release-workspace" },
  "ai.setup.run": { method: "POST", path: () => "/ai/setup/run", body: (p) => p ?? {} },
  "ai.modelPacks.download": { method: "POST", path: (p) => `/ai/model-packs/${p.packId}/download` },
  "ai.models.installed": { method: "GET", path: () => "/ai/models/installed" },
  "ai.models.downloads": { method: "GET", path: () => "/ai/models/downloads" },
  "ai.models.download": { method: "POST", path: () => "/ai/models/download", body: (p) => p ?? {} },
  "ai.models.importLocal": { method: "POST", path: () => "/ai/models/import-local", body: (p) => p ?? {} },
  "ai.models.download.pause": { method: "POST", path: (p) => `/ai/models/download/${p.downloadId}/pause` },
  "ai.models.download.resume": { method: "POST", path: (p) => `/ai/models/download/${p.downloadId}/resume` },
  "ai.models.download.cancel": { method: "POST", path: (p) => `/ai/models/download/${p.downloadId}/cancel` },
  "ai.runtime.health": { method: "GET", path: () => "/ai/runtime/health" },
  "ai.runtimes.registry": { method: "GET", path: () => "/ai/runtimes/registry" },
  "ai.runtimes.install": { method: "POST", path: (p) => `/ai/runtimes/${p.runtimeId}/install` },
  "ai.runtimes.verify": { method: "POST", path: (p) => `/ai/runtimes/${p.runtimeId}/verify` },
  "ai.runtimes.delete": { method: "DELETE", path: (p) => `/ai/runtimes/${p.runtimeId}` },
  "ai.runtime.llamaCppTest": { method: "POST", path: () => "/ai/runtime/llama-cpp/test", body: (p) => p ?? {} },
  "ai.runtime.llamaServer.start": { method: "POST", path: () => "/ai/runtime/llama-cpp/server/start", body: (p) => p ?? {} },
  "ai.runtime.llamaServer.stop": { method: "POST", path: () => "/ai/runtime/llama-cpp/server/stop" },
  "ai.models.test": { method: "POST", path: (p) => `/ai/models/${p.modelId}/test` },
  "ai.models.verify": { method: "POST", path: (p) => `/ai/models/${p.modelId}/verify` },
  "ai.models.select": { method: "POST", path: (p) => `/ai/models/${p.modelId}/select` },
  "ai.models.unload": { method: "POST", path: (p) => `/ai/models/${p.modelId}/unload` },
  "ai.models.delete": { method: "DELETE", path: (p) => `/ai/models/${p.modelId}` },
  "ai.capabilities": { method: "GET", path: () => "/ai/capabilities" },
  "ai.capability.update": { method: "PATCH", path: (p) => `/ai/capabilities/${p.capability}`, body: (p) => p.data ?? {} },
  "ai.generate.text": { method: "POST", path: () => "/ai/generate/text", body: (p) => p },
  "ai.generate.json": { method: "POST", path: () => "/ai/generate/json", body: (p) => p },
  "ai.embed": { method: "POST", path: () => "/ai/embed", body: (p) => p },
  "ai.embeddings.reindex": { method: "POST", path: () => "/ai/embeddings/reindex", body: (p) => p ?? {} },
  "ai.rerank": { method: "POST", path: () => "/ai/rerank", body: (p) => p },
  "ai.runs": { method: "GET", path: (p) => `/ai/runs?limit=${p?.limit ?? 50}` },
  "voice.voices": { method: "GET", path: () => "/voice/voices" },
  "voice.audioAssets": { method: "GET", path: () => "/voice/audio-assets" },
  "voice.speechAssets": { method: "GET", path: () => "/voice/speech-assets" },
  "voice.speechAssetAudio": { method: "GET", path: (p) => `/voice/speech-assets/${p.speechAssetId}/audio` },
  "voice.transcribe": { method: "POST", path: () => "/voice/transcribe", body: (p) => p },
  "voice.synthesize": { method: "POST", path: () => "/voice/synthesize", body: (p) => p },
  "voice.models.download": { method: "POST", path: () => "/voice/models/download", body: (p) => p ?? {} },
  "export.workspace": { method: "POST", path: () => "/export/workspace", body: () => ({}) },
  "settings.get": { method: "GET", path: () => "/settings" }
};

export function isVaultRoute(route: string): route is VaultRoute {
  return Object.hasOwn(allowedRoutes, route);
}
