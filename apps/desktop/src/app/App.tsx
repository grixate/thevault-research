import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { MarkdownSerializer, defaultMarkdownSerializer } from "prosemirror-markdown";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowUp,
  Beaker,
  BookOpen,
  Brain,
  Bold,
  Check,
  Clock3,
  CircleDot,
  Code2,
  Copy,
  Cpu,
  Download,
  FileText,
  FilePlus2,
  FlaskConical,
  FolderOpen,
  GitBranch,
  HardDrive,
  Heading1,
  Heading2,
  Import,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquareText,
  Mic,
  Moon,
  MoreHorizontal,
  Network,
  NotebookPen,
  Pause,
  Pilcrow,
  Play,
  Plus,
  Quote,
  RefreshCw,
  Search,
  Save,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Strikethrough,
  TestTube2,
  TextCursorInput,
  Undo2,
  Redo2,
  Volume2,
  Wrench,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent as ReactFormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Panel, SectionHeader } from "../components/Panel";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Select as SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { saveAudioRecording, saveTextFile, selectAudioFiles, selectFiles, selectModelFiles, selectRegistryFiles, vaultRequest } from "../lib/apiClient";
import { Surface, useUIStore } from "../lib/store";
import type {
  AIApprovalTemplateExport,
  AIModelInfo,
  AIModelImportResult,
  AIModelDownload,
  AIModelPackInfo,
  AIProductionReadinessExport,
  AIProductionReadinessReport,
  AIRegistryArtifactProbeExport,
  AIRegistryArtifactVerificationExport,
  AIRegistryMetadataHydrationExport,
  AIRegistryMetadataHydrationInput,
  AIRegistryPromotionStage,
  AIRegistryReleasePacket,
  AIRegistryReleasePacketPrepareInput,
  AIRegistryReleasePlanEvaluateInput,
  AIRegistryReleasePlanExport,
  AIRegistryReleasePlanReport,
  AIRegistryReleaseWorkspace,
  AIRegistryReleaseWorkspaceSaveInput,
  AIRegistryEvidenceOverlayExport,
  AIRegistryEvidenceOverlayInput,
  AIRegistryValidationReport,
  AIReadinessReportSection,
  AIRuntimeInfo,
  AIModelRun,
  AIModelTestResult,
  AIReadinessCheck,
  AISetupRunInput,
  AISetupRunResult,
  AISetupRunStep,
  AISetupStatus,
  AISetupStepInfo,
  AIProviderInfo,
  CapabilityBinding,
  Capsule,
  CapsuleExportHistoryItem,
  CapsuleExportListResponse,
  CapsuleExportPreview,
  CapsuleExportResult,
  CapsuleImportListResponse,
  CapsuleImportReviewItemsResult,
  CapsuleImportResult,
  CapsuleLearningGenerateResult,
  CapsuleListResponse,
  CapsuleOverviewNoteResult,
  CapsuleItem,
  CapsuleVersionDiff,
  Claim,
  HardwareProfile,
  Health,
  KnowledgeNode,
  LabJob,
  LearningItem,
  Note,
  NoteVersion,
  ReviewItem,
  RuntimeHealth,
  SelectedRegistryFile,
  Source,
  SourceBlock,
  SourcePipeline,
  SourcePipelineStage,
  Stats,
  TodoContextLink,
  TodoItem,
  TodoList,
  TodoListResponse,
  Tool
} from "../lib/types";

const navSections: Array<{ label: string; items: Array<{ id: Surface; label: string; icon: typeof CircleDot }> }> = [
  {
    label: "Workspace",
    items: [
      { id: "dashboard", label: "Home", icon: Beaker },
      { id: "notes", label: "Notes", icon: BookOpen },
      { id: "sources", label: "Storage", icon: HardDrive },
      { id: "tasks", label: "Tasks", icon: List },
      { id: "review", label: "Review", icon: Check }
    ]
  },
  {
    label: "Knowledge",
    items: [
      { id: "assistant", label: "Assistant", icon: MessageSquareText },
      { id: "graph", label: "Graph", icon: Network },
      { id: "capsules", label: "Capsules", icon: Archive },
      { id: "learning", label: "Learning", icon: Brain }
    ]
  },
  {
    label: "Local",
    items: [
      { id: "tools", label: "Local tools", icon: Wrench },
      { id: "settings", label: "Models", icon: Settings }
    ]
  }
];

const surfaceCopy: Record<Surface, { title: string; description: string }> = {
  dashboard: {
    title: "Home",
    description: "A quiet overview of notes, storage, review work, and local automation."
  },
  notes: {
    title: "Notes",
    description: "Write your thinking. Cite Storage when evidence matters."
  },
  sources: {
    title: "Storage",
    description: "Immutable imported evidence: files, transcripts, pasted source text, and source blocks."
  },
  review: {
    title: "Review",
    description: "Approve or reject proposed claims before they become trusted knowledge."
  },
  tasks: {
    title: "Tasks",
    description: "Track next actions without turning the workspace into project management."
  },
  graph: {
    title: "Graph",
    description: "Inspect claims and the exact source blocks that support them."
  },
  capsules: {
    title: "Capsules",
    description: "Curated, portable projections of notes, sources, claims, and tools."
  },
  assistant: {
    title: "Assistant",
    description: "Ask grounded questions over approved knowledge and cited source material."
  },
  learning: {
    title: "Learning",
    description: "Generate and review study material from trusted workspace knowledge."
  },
  tools: {
    title: "Local tools",
    description: "Run sandboxed helpers. Anything they find waits in Review before it changes trusted knowledge."
  },
  settings: {
    title: "Models",
    description: "Choose private models for notes, search, voice, and reviewable suggestions."
  }
};

const nightLabTaskOptions = [
  {
    id: "extract_new_objects",
    label: "Extract proposals",
    caption: "Prepare claims and concepts from recent Storage."
  },
  {
    id: "find_unsupported_claims",
    label: "Weak evidence",
    caption: "Flag claims that have no attached source block."
  },
  {
    id: "detect_duplicate_concepts",
    label: "Duplicate concepts",
    caption: "Find active concepts that may need merging."
  },
  {
    id: "generate_learning_pack",
    label: "Learning pack",
    caption: "Draft cards from approved claims."
  },
  {
    id: "suggest_tools",
    label: "Helper ideas",
    caption: "Propose local helpers when maintenance finds patterns."
  }
] as const;

const defaultNightLabTasks = nightLabTaskOptions.map((task) => task.id);

type SearchResult = {
  target_type: string;
  target_id: string;
  title: string;
  snippet?: string;
  score?: number;
  modes?: string[];
  source_refs?: string[];
  locator?: string;
  status?: string;
  source_type?: string | null;
  source_title?: string | null;
  note_id?: string | null;
};

type ClaimEvidenceLink = {
  id: string;
  claim_id: string;
  source_id?: string;
  source_block_id: string;
  support_type: string;
  exact_quote: string;
  strength?: number;
  evaluator?: string;
  source_title?: string;
  source_block_text?: string;
  locator?: string;
};

type ToolRunRecord = {
  id: string;
  tool_id: string;
  status: string;
  input?: Record<string, unknown>;
  output?: Record<string, any> | null;
  stdout?: string | null;
  stderr?: string | null;
  error?: string | null;
  started_at?: string;
  finished_at?: string | null;
};

type WorkspaceExportResult = {
  export_id: string;
  filename: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  manifest: {
    counts?: Record<string, number>;
    formats?: Record<string, string>;
    database?: { schema_version?: number };
    blobs?: Array<{ path: string; size_bytes: number }>;
  };
};

type AssistantEvidenceMode = "approved_claims" | "claims_and_storage";

const assistantEvidencePolicies: Record<
  AssistantEvidenceMode,
  {
    label: string;
    caption: string;
    tone: "good" | "warn";
    icon: typeof Shield;
    scope: { claim_statuses: string[]; evidence_mode: string; include_source_blocks: boolean };
  }
> = {
  approved_claims: {
    label: "Approved claims",
    caption: "Answers use reviewed claim evidence only.",
    tone: "good",
    icon: Shield,
    scope: {
      claim_statuses: ["supported", "user_confirmed", "verified"],
      evidence_mode: "approved_claims",
      include_source_blocks: false
    }
  },
  claims_and_storage: {
    label: "Claims + Storage",
    caption: "Answers may cite reviewed claims and raw source blocks.",
    tone: "warn",
    icon: HardDrive,
    scope: {
      claim_statuses: ["supported", "user_confirmed", "verified"],
      evidence_mode: "claims_and_storage",
      include_source_blocks: true
    }
  }
};

const assistantPromptStarters: AssistantPromptStarter[] = [
  {
    id: "strongest-claims",
    title: "Strongest claims",
    description: "Use reviewed claims only.",
    question: "What are the strongest approved claims in this workspace, and what exact evidence supports each one?",
    mode: "approved_claims",
    icon: Shield
  },
  {
    id: "evidence-gaps",
    title: "Evidence gaps",
    description: "Find what still needs review.",
    question: "Which important questions are not answered by approved evidence yet, and what should I inspect next?",
    mode: "approved_claims",
    icon: GitBranch
  },
  {
    id: "storage-themes",
    title: "Storage themes",
    description: "Include raw source blocks.",
    question: "What patterns or contradictions should I review in raw Storage, with exact source block citations?",
    mode: "claims_and_storage",
    icon: HardDrive
  }
];

function assistantScopeFor(mode: AssistantEvidenceMode, contextId: string): Record<string, unknown> {
  const scope: Record<string, unknown> = { ...assistantEvidencePolicies[mode].scope };
  if (contextId && contextId !== "vault") scope.capsule_id = contextId;
  return scope;
}

export function App() {
  const surface = useUIStore((state) => state.surface);
  const setSurface = useUIStore((state) => state.setSurface);
  const health = useQuery({ queryKey: ["health"], queryFn: () => vaultRequest<Health>("health.get"), retry: 1 });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => vaultRequest<LabJob[]>("jobs.list"), refetchInterval: 4000 });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <FlaskConical size={22} />
          </div>
          <div>
            <strong>The Vault</strong>
            <span>Research Lab</span>
          </div>
        </div>
        <nav className="main-nav" aria-label="Main sections">
          {navSections.map((section) => (
            <div key={section.label} className="nav-section">
              <span className="nav-section-label">{section.label}</span>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} className={surface === item.id ? "active" : ""} aria-label={item.label} onClick={() => setSurface(item.id)}>
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="side-status">
          <Badge tone={health.data?.ok ? "good" : "warn"}>{health.data?.ok ? "Local core ready" : "Starting core"}</Badge>
          <span>Version {health.data?.version ?? "0.1.0"}</span>
          <span>{jobs.data?.filter((job) => job.status === "running").length ?? 0} background tasks</span>
        </div>
      </aside>
      <main className="workspace">
        <TopBar />
        {surface === "dashboard" && <Dashboard />}
        {surface === "notes" && <NotesView />}
        {surface === "sources" && <SourcesView />}
        {surface === "tasks" && <TasksView />}
        {surface === "review" && <ReviewView />}
        {surface === "graph" && <GraphView />}
        {surface === "capsules" && <CapsulesView />}
        {surface === "assistant" && <AssistantView />}
        {surface === "learning" && <LearningView />}
        {surface === "tools" && <ToolsView />}
        {surface === "settings" && <SettingsView />}
      </main>
    </div>
  );
}

type CommandAction = {
  id: string;
  title: string;
  description: string;
  shortcut?: string;
  icon: typeof Search;
  disabled?: boolean;
  action: () => void;
};

type QuickCaptureDestination = "notes" | "tasks" | "storage";

type AssistantAskInput = {
  question: string;
  mode: AssistantEvidenceMode;
  contextId: string;
};

type AssistantPromptStarter = {
  id: string;
  title: string;
  description: string;
  question: string;
  mode: AssistantEvidenceMode;
  icon: typeof Search;
};

function TopBar() {
  const queryClient = useQueryClient();
  const surface = useUIStore((state) => state.surface);
  const setSurface = useUIStore((state) => state.setSurface);
  const setSelectedNoteId = useUIStore((state) => state.setSelectedNoteId);
  const setSelectedSourceId = useUIStore((state) => state.setSelectedSourceId);
  const setSelectedSourceBlockId = useUIStore((state) => state.setSelectedSourceBlockId);
  const setSelectedClaimId = useUIStore((state) => state.setSelectedClaimId);
  const quickNoteRequestId = useUIStore((state) => state.quickNoteRequestId);
  const quickTaskRequestId = useUIStore((state) => state.quickTaskRequestId);
  const requestQuickNote = useUIStore((state) => state.requestQuickNote);
  const requestQuickTask = useUIStore((state) => state.requestQuickTask);
  const requestAddSource = useUIStore((state) => state.requestAddSource);
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"fts" | "hybrid">("hybrid");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState("");
  const [quickNoteDestination, setQuickNoteDestination] = useState<QuickCaptureDestination>("notes");
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const quickNoteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const quickCapture = useMutation({
    mutationFn: (text: string) =>
      vaultRequest<Note>("notes.create", {
        title: quickNoteTitle(text),
        content_markdown: quickNoteMarkdown(text),
        content_json: quickNoteContent(text),
        origin: "user_written"
      }),
    onSuccess: (note) => {
      setSelectedNoteId(note.id);
      setSurface("notes");
      setQuickNoteText("");
      setQuickNoteDestination("notes");
      setQuickNoteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  });
  const quickTaskCapture = useMutation({
    mutationFn: (text: string) => vaultRequest<TodoItem>("todos.create", { text }),
    onSuccess: () => {
      setSurface("tasks");
      setQuickNoteText("");
      setQuickNoteDestination("notes");
      setQuickNoteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const createNote = useMutation({
    mutationFn: () => vaultRequest<Note>("notes.create", blankResearchNoteInput()),
    onSuccess: (note) => {
      setSelectedNoteId(note.id);
      setSurface("notes");
      closeCommandSurface();
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const wantsQuickNote = (event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.code === "KeyN";
      const wantsQuickTask = (event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.code === "KeyT";
      const wantsAddSource = (event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.code === "KeyE";
      const wantsSearch = (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.code === "KeyK";
      if (wantsQuickNote) {
        event.preventDefault();
        requestQuickNote();
      }
      if (wantsQuickTask) {
        event.preventDefault();
        requestQuickTask();
      }
      if (wantsAddSource) {
        event.preventDefault();
        openSourceCapture();
      }
      if (wantsSearch) {
        event.preventDefault();
        focusSearch();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [query, requestQuickNote, requestQuickTask, requestAddSource, setSurface]);

  useEffect(() => {
    return window.vault?.onQuickNote?.(() => requestQuickNote());
  }, [requestQuickNote]);

  useEffect(() => {
    return window.vault?.onQuickTask?.(() => requestQuickTask());
  }, [requestQuickTask]);

  useEffect(() => {
    return window.vault?.onAddSource?.(() => openSourceCapture());
  }, [requestAddSource, setSurface]);

  useEffect(() => {
    return window.vault?.onFocusSearch?.(() => focusSearch());
  }, [query]);

  useEffect(() => {
    function closeSearchOnOutsideClick(event: MouseEvent) {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", closeSearchOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeSearchOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!quickNoteOpen) return;
    window.requestAnimationFrame(() => quickNoteInputRef.current?.focus());
  }, [quickNoteOpen]);

  useEffect(() => {
    if (quickNoteRequestId > 0) openQuickCapture("notes");
  }, [quickNoteRequestId]);

  useEffect(() => {
    if (quickTaskRequestId > 0) openQuickCapture("tasks");
  }, [quickTaskRequestId]);

  async function runSearch(value: string, mode = searchMode) {
    setQuery(value);
    setSelectedSearchIndex(0);
    setSearchError(null);
    if (value.trim().length < 2) {
      setResults([]);
      setSearchOpen(true);
      return;
    }
    setSearchOpen(true);
    setSearchPending(true);
    try {
      const response = await vaultRequest<{ results: SearchResult[] }>("search.query", { query: value, modes: [mode], limit: 6 });
      setResults(response.results);
    } catch (error) {
      setResults([]);
      setSearchError(error instanceof Error ? error.message : "Search is unavailable right now.");
    } finally {
      setSearchPending(false);
    }
  }

  function changeSearchMode(mode: "fts" | "hybrid") {
    setSearchMode(mode);
    if (query.trim().length >= 2) void runSearch(query, mode);
  }

  function openSearchResult(result: SearchResult) {
    if (result.target_type === "claim") {
      setSelectedClaimId(result.target_id);
      setSurface("graph");
    } else if (result.note_id || result.source_type === "note") {
      setSelectedNoteId(result.note_id ?? undefined);
      setSurface("notes");
    } else {
      const sourceId = result.source_refs?.[0];
      setSelectedSourceId(sourceId);
      setSelectedSourceBlockId(result.target_type === "source_block" ? result.target_id : undefined);
      setSurface("sources");
    }
    setQuery("");
    setResults([]);
    setSearchOpen(false);
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSearchOpen(false);
      return;
    }
    if (query.trim().length < 2) {
      if (!searchOpen || commandActions.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedSearchIndex((index) => Math.min(index + 1, commandActions.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedSearchIndex((index) => Math.max(index - 1, 0));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        runCommandAction(commandActions[selectedSearchIndex] ?? commandActions[0]);
      }
      return;
    }
    if (!searchOpen || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedSearchIndex((index) => Math.min(index + 1, results.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedSearchIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      openSearchResult(results[selectedSearchIndex] ?? results[0]);
    }
  }

  function closeQuickNote() {
    if (quickCapture.isPending || quickTaskCapture.isPending) return;
    setQuickNoteOpen(false);
    setQuickNoteDestination("notes");
  }

  function saveQuickNote() {
    const text = quickNoteText.trim();
    if (!text || quickCapture.isPending) return;
    quickCapture.mutate(text);
  }

  function saveQuickTask() {
    const text = quickNoteText.trim();
    if (!text || quickTaskCapture.isPending) return;
    quickTaskCapture.mutate(text);
  }

  function importQuickNoteAsSource() {
    if (quickCapture.isPending || quickTaskCapture.isPending) return;
    const text = quickNoteText.trim();
    openSourceCapture(text);
    setQuickNoteOpen(false);
    setQuickNoteDestination("notes");
    if (text) setQuickNoteText("");
  }

  function saveQuickCapture() {
    if (quickNoteDestination === "storage") {
      importQuickNoteAsSource();
      return;
    }
    if (quickNoteDestination === "tasks") {
      saveQuickTask();
      return;
    }
    saveQuickNote();
  }

  function openQuickCapture(destination: QuickCaptureDestination) {
    setQuickNoteDestination(destination);
    setQuickNoteOpen(true);
  }

  function openSourceCapture(draftText = "") {
    setSurface("sources");
    requestAddSource(draftText);
  }

  function focusSearch() {
    setSearchOpen(true);
    setSelectedSearchIndex(0);
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }

  function closeCommandSurface() {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
    setSelectedSearchIndex(0);
  }

  function runCommandAction(action: CommandAction | undefined) {
    if (!action || action.disabled) return;
    action.action();
    closeCommandSurface();
  }

  const commandActions: CommandAction[] = [
    {
      id: "quick-note",
      title: "Quick note",
      description: "Save a thought to the Notes inbox without opening the editor.",
      shortcut: "Cmd/Ctrl+Shift+N",
      icon: NotebookPen,
      action: () => requestQuickNote()
    },
    {
      id: "quick-task",
      title: "Quick task",
      description: "Capture a follow-up without leaving the current surface.",
      shortcut: "Cmd/Ctrl+Shift+T",
      icon: List,
      action: () => requestQuickTask()
    },
    {
      id: "new-note",
      title: "New note",
      description: "Open a blank research note for authored thinking.",
      shortcut: "Enter",
      icon: FilePlus2,
      disabled: createNote.isPending,
      action: () => createNote.mutate()
    },
    {
      id: "add-source",
      title: "Add source",
      description: "Import pasted text, files, or audio into immutable Storage.",
      shortcut: "Cmd/Ctrl+Shift+E",
      icon: Plus,
      action: () => openSourceCapture()
    },
    {
      id: "open-notes",
      title: "Open Notes",
      description: "Go to editable writing, quick captures, and synthesis.",
      icon: NotebookPen,
      action: () => setSurface("notes")
    },
    {
      id: "open-storage",
      title: "Open Storage",
      description: "Go to imported source records and evidence blocks.",
      icon: HardDrive,
      action: () => setSurface("sources")
    }
  ];
  const showCommandActions = searchOpen && query.trim().length < 2;
  const showSearchResults = searchOpen && query.trim().length >= 2;
  const showSearchPopover = showCommandActions || showSearchResults;

  return (
    <TooltipProvider delayDuration={250}>
      <header className="topbar">
        <div className="workspace-heading">
          <h1>{surfaceCopy[surface].title}</h1>
        </div>
        <div className="command-search" ref={searchRef}>
          <Search size={17} />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => void runSearch(event.target.value)}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search notes, Storage, or actions"
            aria-expanded={showSearchPopover}
            aria-controls="global-search-results"
            aria-keyshortcuts="Meta+K Control+K"
          />
          <kbd className="search-shortcut" aria-hidden="true">
            ⌘K
          </kbd>
          <Tabs value={searchMode} onValueChange={(value) => changeSearchMode(value as "fts" | "hybrid")} className="search-mode">
            <TabsList aria-label="Search style">
              {(["fts", "hybrid"] as const).map((mode) => (
                <TabsTrigger key={mode} value={mode} onClick={() => changeSearchMode(mode)}>
                  {searchModeLabel(mode)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {showSearchPopover && (
            <div className="search-popover" id="global-search-results" role="listbox" aria-label="Search and actions">
              {showCommandActions && (
                <div className="command-action-group" aria-label="Fast actions">
                  <div className="search-section-label">Fast actions</div>
                  {commandActions.map((action, index) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        role="option"
                        aria-selected={selectedSearchIndex === index}
                        className={selectedSearchIndex === index ? "active" : ""}
                        disabled={action.disabled}
                        onMouseEnter={() => setSelectedSearchIndex(index)}
                        onClick={() => runCommandAction(action)}
                      >
                        <Icon size={15} />
                        <span className="search-result-body">
                          <strong>{action.title}</strong>
                          <span>{action.description}</span>
                        </span>
                        {action.shortcut && <kbd className="command-action-shortcut">{action.shortcut}</kbd>}
                      </button>
                    );
                  })}
                  {createNote.error && <div className="search-empty bad">{createNote.error.message}</div>}
                </div>
              )}
              {showSearchResults && searchPending && <div className="search-empty">Searching local knowledge...</div>}
              {showSearchResults && !searchPending && searchError && <div className="search-empty bad">{searchError}</div>}
              {showSearchResults && !searchPending && !searchError && results.length === 0 && <div className="search-empty">No matches in notes, storage, or claims.</div>}
              {showSearchResults &&
                !searchPending &&
                !searchError &&
                results.map((result, index) => {
                  const meta = searchResultMeta(result);
                  const Icon = meta.icon;
                  return (
                    <button
                      key={`${result.target_type}-${result.target_id}`}
                      type="button"
                      role="option"
                      aria-selected={selectedSearchIndex === index}
                      className={selectedSearchIndex === index ? "active" : ""}
                      onMouseEnter={() => setSelectedSearchIndex(index)}
                      onClick={() => openSearchResult(result)}
                    >
                      <Icon size={15} />
                      <span className="search-result-body">
                        <strong>{result.title}</strong>
                        <span>{result.snippet}</span>
                        <small>
                          {meta.label}
                          {formatSearchModes(result.modes)}
                        </small>
                      </span>
                      <em>{meta.action}</em>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              icon={<NotebookPen size={16} />}
              onClick={() => requestQuickNote()}
              variant="primary"
              aria-label="Quick note"
              aria-keyshortcuts="Meta+Shift+KeyN Control+Shift+KeyN"
            >
              Quick note
            </Button>
          </TooltipTrigger>
          <TooltipContent>Capture a thought into Notes. Cmd/Ctrl+Shift+N</TooltipContent>
        </Tooltip>
      </header>
      <Dialog.Root open={quickNoteOpen} onOpenChange={(open) => (open ? setQuickNoteOpen(true) : closeQuickNote())}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay quick-note-overlay" />
          <Dialog.Content
            className="dialog-content quick-note-dialog"
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              quickNoteInputRef.current?.focus();
            }}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveQuickCapture();
              }}
            >
              <Dialog.Title className="visually-hidden">{quickCaptureTitle(quickNoteDestination)}</Dialog.Title>
              <div className="quick-note-spotlight">
                <div className="quick-note-input-shell">
                  <Textarea
                    ref={quickNoteInputRef}
                    aria-label={quickCaptureInputLabel(quickNoteDestination)}
                    value={quickNoteText}
                    placeholder={quickCapturePlaceholder(quickNoteDestination)}
                    onChange={(event) => setQuickNoteText(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault();
                        saveQuickCapture();
                      }
                    }}
                  />
                  <Dialog.Close asChild>
                    <Button icon={<X size={15} />} size="icon" variant="quiet" className="quick-note-close" aria-label="Close quick note" />
                  </Dialog.Close>
                </div>
                {quickCapture.error && <small className="model-test-error">{quickCapture.error.message}</small>}
                {quickTaskCapture.error && <small className="model-test-error">{quickTaskCapture.error.message}</small>}
                <div className="quick-note-footer">
                  <div className="quick-note-route-grid" aria-label="Capture destination">
                    <button
                      type="button"
                      className={`quick-note-route-option ${quickNoteDestination === "notes" ? "active" : ""}`}
                      aria-pressed={quickNoteDestination === "notes"}
                      aria-label="Save as note"
                      onClick={() => setQuickNoteDestination("notes")}
                    >
                      <NotebookPen size={14} />
                      <strong>Note</strong>
                    </button>
                    <button
                      type="button"
                      className={`quick-note-route-option ${quickNoteDestination === "tasks" ? "active" : ""}`}
                      aria-pressed={quickNoteDestination === "tasks"}
                      aria-label="Save as task"
                      onClick={() => setQuickNoteDestination("tasks")}
                    >
                      <List size={14} />
                      <strong>Task</strong>
                    </button>
                    <button
                      type="button"
                      className={`quick-note-route-option ${quickNoteDestination === "storage" ? "active" : ""}`}
                      aria-pressed={quickNoteDestination === "storage"}
                      aria-label="Save as source"
                      onClick={() => setQuickNoteDestination("storage")}
                    >
                      <HardDrive size={14} />
                      <strong>Source</strong>
                    </button>
                  </div>
                  <div className="quick-note-actions">
                    <kbd title="Command or Control Enter">⌘↵</kbd>
                    <Button
                      type="submit"
                      size="icon"
                      variant="primary"
                      icon={<ArrowUp size={16} />}
                      aria-label={quickCaptureSaveLabel(quickNoteDestination)}
                      disabled={!quickNoteText.trim() || quickCapture.isPending || quickTaskCapture.isPending}
                    />
                  </div>
                </div>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </TooltipProvider>
  );
}

function quickNoteTitle(text: string): string {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const title = firstLine?.replace(/^#{1,6}\s*/, "").trim() || "Quick note";
  return title.length > 80 ? `${title.slice(0, 77)}...` : title;
}

function quickNoteMarkdown(text: string): string {
  const markdown = text.trim();
  return markdown.endsWith("\n") ? markdown : `${markdown}\n`;
}

function quickNoteEditorDoc(text: string): Record<string, unknown> {
  return plainTextToTiptapDoc(text.trim());
}

function quickNoteContent(text: string): Record<string, unknown> {
  return {
    capture_mode: "quick_note",
    capture_destination: "notes",
    captured_at: new Date().toISOString(),
    editor_engine: "tiptap",
    editor_doc: quickNoteEditorDoc(text)
  };
}

function quickCaptureTitle(destination: QuickCaptureDestination): string {
  if (destination === "tasks") return "Quick task";
  if (destination === "storage") return "Quick source";
  return "Quick note";
}

function quickCaptureInputLabel(destination: QuickCaptureDestination): string {
  if (destination === "tasks") return "Quick task text";
  if (destination === "storage") return "Quick source text";
  return "Quick note text";
}

function quickCapturePlaceholder(destination: QuickCaptureDestination): string {
  if (destination === "tasks") return "Add task...";
  if (destination === "storage") return "Paste source material...";
  return "Write a note...";
}

function quickCaptureSaveLabel(destination: QuickCaptureDestination): string {
  if (destination === "tasks") return "Save to Tasks";
  if (destination === "storage") return "Save to Storage";
  return "Save to Notes";
}

function searchResultMeta(result: SearchResult): { label: string; action: string; icon: typeof FileText } {
  if (result.target_type === "claim") {
    return { label: result.status ? `Claim · ${result.status}` : "Claim", action: "Open graph", icon: GitBranch };
  }
  if (result.note_id || result.source_type === "note") {
    return { label: result.locator ? `Note · ${result.locator}` : "Note", action: "Open note", icon: FileText };
  }
  return {
    label: result.locator ? `Storage · ${result.locator}` : result.source_type ? `Storage · ${result.source_type}` : "Storage",
    action: "Open storage",
    icon: HardDrive
  };
}

function searchModeLabel(mode: string): string {
  if (mode === "fts") return "Exact";
  if (mode === "hybrid") return "Smart";
  if (mode === "vector") return "Semantic";
  return mode
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function capabilityDisplayLabel(capability: string): string {
  const labels: Record<string, string> = {
    embed_text: "Search index",
    rerank_results: "Result ranking",
    extract_claims: "Claim suggestions",
    extract_objects: "Concept suggestions",
    generate_note: "Draft notes",
    grounded_answer: "Assistant answers",
    transcribe_audio: "Dictation",
    synthesize_speech: "Read aloud"
  };
  return labels[capability] ?? searchModeLabel(capability);
}

function audioAssetKindLabel(kind?: string | null): string {
  if (!kind) return "Audio note";
  if (kind === "voice_memo") return "Voice memo";
  if (kind === "transcript") return "Transcript";
  return searchModeLabel(kind);
}

function speechAssetPrivacyLabel(asset: { sent_off_device?: boolean; provider?: string | null }): string {
  return asset.sent_off_device ? "Off-device" : "On device";
}

function storageLinkLabel(sourceId?: unknown) {
  return sourceId ? "Linked to Storage" : "Not linked";
}

function generatedDraftPrivacyLabel(value: { sent_off_device?: unknown }) {
  return value.sent_off_device === true ? "Drafted off-device" : "Drafted locally";
}

function generatedRunLabel(runId?: unknown) {
  return runId ? "Run recorded" : "No run recorded";
}

function modelDownloadLabel(state: string) {
  if (state === "installed") return "Available";
  if (state === "not_installed") return "Needs download";
  if (state === "downloading") return "Downloading";
  if (state === "queued") return "Queued";
  if (state === "paused") return "Paused";
  if (state === "failed") return "Download failed";
  return searchModeLabel(state);
}

function jobStatusLabel(status?: string | null): string {
  if (status === "completed") return "Complete";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  if (status === "running") return "Running";
  if (status === "queued") return "Queued";
  return status ? searchModeLabel(status) : "Queued";
}

function embeddingProgressDetailLabel(output: Record<string, unknown>, embeddingSpace?: Record<string, unknown>): string {
  if (embeddingSpace?.space_id) return "Search index selected";
  if (output.phase) return jobStatusLabel(String(output.phase));
  return "Queued";
}

function setupStatusLabel(status?: string | null): string {
  if (status === "done" || status === "pass" || status === "completed") return "Complete";
  if (status === "ready") return "Ready";
  if (status === "blocked" || status === "failed") return "Needs action";
  if (status === "not_started") return "Not set up";
  if (status === "partial") return "Partly ready";
  if (status === "pending") return "Pending";
  if (status === "running") return "Running";
  return status ? searchModeLabel(status) : "Checking";
}

function setupRunPackLabel(result: AISetupRunResult): string {
  if (result.release_channel === "production") return "Trusted model setup";
  if (result.release_channel === "demo") return "Starter model setup";
  return "Local model setup";
}

function modelKindLabel(kind: AIModelInfo["kind"]) {
  if (kind === "llm") return "Writing model";
  if (kind === "embedding") return "Search index model";
  if (kind === "reranker") return "Ranking model";
  if (kind === "stt") return "Dictation model";
  if (kind === "tts") return "Read-aloud voice";
  return searchModeLabel(kind);
}

function modelRuntimeLabel(runtime?: string | null, kind?: AIModelInfo["kind"]) {
  if (runtime === "llama_cpp") return "Local text runtime";
  if (runtime === "whisper_cpp") return "Local dictation runtime";
  if (runtime === "piper") return "Local voice runtime";
  return kind ? modelKindLabel(kind) : "Local model";
}

function modelFormatLabel(format?: string | null) {
  if (!format) return "Model file";
  if (format === "gguf") return "GGUF file";
  if (format === "onnx") return "ONNX file";
  if (format === "safetensors") return "Weights file";
  return searchModeLabel(format);
}

function modelSourceLabel(sourceType?: string | null) {
  if (sourceType === "local_import") return "Imported file";
  if (sourceType === "local_fixture") return "Starter file";
  if (sourceType === "url") return "Approved source";
  if (sourceType === "manual") return "Manual file";
  return sourceType ? searchModeLabel(sourceType) : null;
}

function modelCapabilitySummary(capabilities: string[]) {
  if (capabilities.length === 0) return "No tasks assigned";
  return capabilities.map(capabilityDisplayLabel).join(" + ");
}

function modelTrustLabel(trustLevel?: string | null) {
  if (!trustLevel) return null;
  if (trustLevel === "approved" || trustLevel === "release_approved") return "Approved for local use";
  if (trustLevel === "demo" || trustLevel === "fixture") return "Starter only";
  if (trustLevel === "untrusted") return "Needs approval";
  return searchModeLabel(trustLevel);
}

function voiceRuntimeStateLabel(state?: string | null) {
  if (state === "ready") return "Ready";
  if (state === "mock_only") return "Starter voice";
  if (state === "not_configured") return "Needs setup";
  if (state === "degraded") return "Needs attention";
  return state ? searchModeLabel(state) : "Checking";
}

function savedModelSummary(modelId?: string | null, fallback = "No saved model") {
  return modelId ? "Saved model selected" : fallback;
}

function managedDictationModelOptionLabel(model: AIModelInfo) {
  return `${model.display_name} - ${modelDownloadLabel(model.download_state)}`;
}

function managedDictationStatusLabel(model?: AIModelInfo) {
  return model ? modelDownloadLabel(model.download_state) : "Manual path";
}

function managedDictationStatusDescription(model?: AIModelInfo) {
  if (!model) return "Paste a local whisper.cpp model path.";
  if (model.disk_path) return "Local dictation model ready.";
  return "Download before saving dictation.";
}

function formatSearchModes(modes?: string[]): string {
  if (!modes?.length) return "";
  return ` · ${modes.map(searchModeLabel).join(" + ")}`;
}

function CapabilityStatus({ capability, compact = false }: { capability: string; compact?: boolean }) {
  const capabilities = useQuery({ queryKey: ["ai-capabilities"], queryFn: () => vaultRequest<CapabilityBinding[]>("ai.capabilities") });
  const providers = useQuery({ queryKey: ["ai-providers"], queryFn: () => vaultRequest<AIProviderInfo[]>("ai.providers") });
  const binding = (capabilities.data ?? []).find((item) => item.capability === capability);
  const provider = (providers.data ?? []).find((item) => item.id === binding?.provider_id);
  const llamaCppProvider = binding?.provider_id === "llama_cpp_cli" || binding?.provider_id === "llama_cpp_server";
  const tone = provider?.locality === "cloud" ? "bad" : provider?.locality === "external_local" || llamaCppProvider ? "good" : "info";
  const localityLabel =
    provider?.locality === "cloud"
      ? "cloud"
      : provider?.locality === "external_local"
        ? "local service"
        : llamaCppProvider
          ? "local model"
          : "mock local";
  return (
    <div className={compact ? "capability-chip compact" : "capability-chip"}>
      <Badge tone={tone}>{localityLabel}</Badge>
      <span title={capability}>{capabilityDisplayLabel(capability)}</span>
      <small>{binding?.model_id ?? "No model selected"}</small>
    </div>
  );
}

function NoteProvenance({ note }: { note: Note }) {
  const content = note.content ?? {};
  const sourceIds = stringList(content.source_ids);
  const claimIds = stringList(content.claim_ids);
  const citations = Array.isArray(content.citations) ? content.citations.slice(0, 4) : [];
  const hasAIProvenance = Boolean(content.ai_run_id) || Boolean(content.model_id) || note.origin === "ai_generated";
  const hasEvidenceProvenance = sourceIds.length > 0 || citations.length > 0;
  if (!hasAIProvenance && !hasEvidenceProvenance) return null;
  const generationStatus = typeof content.generation_status === "string" ? content.generation_status : note.status;
  return (
    <div className="provenance-strip">
      <Badge tone={content.sent_off_device ? "bad" : "good"}>{hasAIProvenance ? (content.sent_off_device ? "off device" : "on device") : "cited evidence"}</Badge>
      <Badge tone={!hasAIProvenance || content.requires_review === false ? "good" : "warn"}>{generationStatus}</Badge>
      <span title={String(content.capability ?? (hasAIProvenance ? "generated" : "linked source"))}>
        {content.capability ? capabilityDisplayLabel(String(content.capability)) : hasAIProvenance ? "Generated note" : "Linked source"}
      </span>
      {hasAIProvenance && (
        <small title={String(content.model_id ?? content.generated_by ?? "unknown model")}>{generatedDraftPrivacyLabel(content)}</small>
      )}
      {Boolean(content.ai_run_id) && <small title={String(content.ai_run_id)}>{generatedRunLabel(content.ai_run_id)}</small>}
      {sourceIds.length > 0 && <small>{sourceIds.length} source{sourceIds.length === 1 ? "" : "s"}</small>}
      {claimIds.length > 0 && <small>{claimIds.length} claim{claimIds.length === 1 ? "" : "s"}</small>}
      {citations.length > 0 && (
        <div className="evidence-chip-list" aria-label="Generated note evidence">
          {citations.map((citation: any, index) => {
            const label = `${String(citation?.title ?? "Evidence")}${citation?.locator ? ` (${String(citation.locator)})` : ""}`;
            return (
              <span key={`${String(citation?.source_block_id ?? citation?.title ?? "citation")}-${index}`} className="evidence-chip" title={label}>
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function isTiptapDoc(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && (value as Record<string, unknown>).type === "doc" && Array.isArray((value as Record<string, unknown>).content));
}

function editorDocFromNote(note: Note): Record<string, unknown> | string {
  const content = note.content ?? {};
  const nestedEditorDoc = (content as Record<string, unknown>).editor_doc;
  if (isTiptapDoc(nestedEditorDoc)) return nestedEditorDoc;
  if (isTiptapDoc(content)) return content;
  return note.content_markdown || "";
}

function plainTextToTiptapDoc(text: string): Record<string, unknown> {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }]
    }));
  return {
    type: "doc",
    content: paragraphs.length ? paragraphs : [{ type: "paragraph" }]
  };
}

function createBlankNoteDoc(): Record<string, unknown> {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Untitled research note" }]
      },
      { type: "paragraph" }
    ]
  };
}

function blankResearchNoteInput() {
  return {
    title: "Untitled research note",
    content_markdown: "Untitled research note\n",
    content_json: createBlankNoteDoc(),
    origin: "user_written"
  };
}

const tiptapMarkdownSerializer = new MarkdownSerializer(
  {
    blockquote: defaultMarkdownSerializer.nodes.blockquote,
    bulletList: defaultMarkdownSerializer.nodes.bullet_list,
    codeBlock: defaultMarkdownSerializer.nodes.code_block,
    doc: defaultMarkdownSerializer.nodes.doc,
    hardBreak: defaultMarkdownSerializer.nodes.hard_break,
    heading: defaultMarkdownSerializer.nodes.heading,
    horizontalRule: defaultMarkdownSerializer.nodes.horizontal_rule,
    listItem: defaultMarkdownSerializer.nodes.list_item,
    orderedList: defaultMarkdownSerializer.nodes.ordered_list,
    paragraph: defaultMarkdownSerializer.nodes.paragraph,
    text: defaultMarkdownSerializer.nodes.text
  },
  {
    bold: defaultMarkdownSerializer.marks.strong,
    code: defaultMarkdownSerializer.marks.code,
    italic: defaultMarkdownSerializer.marks.em,
    strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true }
  },
  { hardBreakNodeName: "hardBreak", strict: false }
);

function noteKind(note: Note): { label: string; tone: "neutral" | "good" | "warn" | "bad" | "info" } {
  const captureMode = String(note.content?.capture_mode ?? "");
  if (captureMode === "quick_note") return { label: "Quick capture", tone: "info" };
  if (captureMode === "source_block_note") return { label: "From Storage", tone: "good" };
  if (note.origin === "ai_generated") return { label: "AI draft", tone: "warn" };
  if (note.origin === "lab_brief") return { label: "Lab brief", tone: "info" };
  return { label: "Note", tone: "neutral" };
}

function noteLaneIntent(note: Note):
  | {
      title: string;
      description: string;
      badge: string;
      tone: "neutral" | "good" | "warn" | "bad" | "info";
      icon: typeof CircleDot;
    }
  | null {
  const captureMode = String(note.content?.capture_mode ?? "");
  if (captureMode === "quick_note") {
    return {
      title: "Notes inbox",
      description: "Refine this capture into a written note when the thought is ready.",
      badge: "quick capture",
      tone: "info",
      icon: TextCursorInput
    };
  }
  if (captureMode === "source_block_note") {
    return {
      title: "Storage-linked note",
      description: "Edit the synthesis here; the original source block stays immutable in Storage.",
      badge: "source backed",
      tone: "good",
      icon: HardDrive
    };
  }
  if (note.origin === "ai_generated" || note.status === "generated_pending_review") {
    return {
      title: "Review before trust",
      description: "Generated writing stays provisional until claim review is prepared and approved.",
      badge: "AI draft",
      tone: "warn",
      icon: Sparkles
    };
  }
  return null;
}

function notePreview(note: Note): string {
  const text = note.content_markdown.replace(/[#>*_`-]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "Empty note";
  return text.length > 116 ? `${text.slice(0, 113)}...` : text;
}

function noteVersionPreview(version: NoteVersion): string {
  const text = version.content_markdown.replace(/[#>*_`-]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "Empty version";
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function noteExportFilename(note: Pick<Note, "id" | "title">): string {
  return `${safeExportSlug(note.title || "untitled-note")}-${note.id}.md`;
}

function safeExportSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");
  return (slug || "untitled").slice(0, 80);
}

function noteMarkdownExport(note: Note, markdown: string, title: string): string {
  const frontmatter: Record<string, unknown> = {
    id: note.id,
    title,
    origin: note.origin,
    status: note.status,
    version: note.version,
    source_id: note.source_id,
    updated_at: note.updated_at
  };
  const metadata = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n");
  return `---\n${metadata}\n---\n\n${markdown}`;
}

function compactDate(value?: string): string {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function editorMarkdownForSave(editor: Editor): string {
  const markdown = tiptapMarkdownSerializer.serialize(editor.state.doc).trimEnd();
  return markdown ? `${markdown}\n` : "";
}

function stableSnapshot(value: unknown): string {
  return JSON.stringify(value);
}

function noteSnapshotFromPersisted(note: Note): string {
  return stableSnapshot({
    title: note.title,
    content_markdown: note.content_markdown,
    content_json: note.content ?? {}
  });
}

function noteContentForSave(note: Note, editorDoc: Record<string, unknown>, markdownChanged = false) {
  const content: Record<string, unknown> = note.content ?? {};
  const hasAIProvenance = note.origin === "ai_generated" || Boolean(content.ai_run_id) || Boolean(content.generation_status);
  if (!hasAIProvenance) {
    if (isTiptapDoc(content)) return editorDoc;
    const metadata = Object.assign({}, content) as Record<string, unknown>;
    return Object.keys(metadata).length ? { ...metadata, editor_doc: editorDoc } : editorDoc;
  }
  const nextContent: Record<string, unknown> = { ...content, editor_doc: editorDoc };
  if (markdownChanged && content.generated_claim_review_status === "prepared") {
    nextContent.generated_claim_review_status = "stale";
  }
  return nextContent;
}

function EmbeddingJobProgress({
  job,
  onCancel,
  cancelling
}: {
  job: LabJob;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const output = job.output ?? {};
  const percent = Math.max(0, Math.min(100, Number(output.percent ?? 0)));
  const blocksIndexed = Number(output.blocks_indexed ?? 0);
  const blocksTotal = Number(output.blocks_total ?? 0);
  const sourcesDone = Number(output.sources_done ?? 0);
  const sourcesTotal = Number(output.sources_total ?? 0);
  const embeddingSpace = output.embedding_space as Record<string, unknown> | undefined;
  const canCancel = job.status === "queued" || job.status === "running";
  const tone = job.status === "completed" ? "good" : job.status === "failed" ? "bad" : job.status === "cancelled" ? "warn" : "info";
  const progressDetail = String(embeddingSpace?.space_id ?? output.phase ?? "queued");

  return (
    <div className="job-progress">
      <div className="job-progress-header">
        <Badge tone={tone} title={job.status}>
          {jobStatusLabel(job.status)}
        </Badge>
        <strong>Embedding reindex</strong>
        <span>
          {sourcesDone}/{sourcesTotal} sources
        </span>
        <span>
          {blocksIndexed}/{blocksTotal} blocks
        </span>
        {canCancel && (
          <Button icon={<X size={14} />} variant="quiet" onClick={onCancel} disabled={cancelling}>
            Cancel
          </Button>
        )}
      </div>
      <div className="progress-track" aria-label="Embedding reindex progress" aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <small title={progressDetail}>{embeddingProgressDetailLabel(output, embeddingSpace)}</small>
      {job.error && <small className="model-test-error">{job.error}</small>}
    </div>
  );
}

function formatBytes(value?: number | null) {
  if (value == null) return "?";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function licenseReferenceLabel(item: { license_url?: string | null; license_path?: string | null }) {
  const reference = item.license_path ?? item.license_url;
  if (!reference || reference === "REQUIRED_BEFORE_RELEASE" || reference.includes("REPLACE_WITH_APPROVED")) return "license artifact pending";
  return reference;
}

function downloadPercent(download: AIModelDownload) {
  if (!download.bytes_total) return download.state === "installed" ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((download.bytes_downloaded / download.bytes_total) * 100)));
}

function isLoopbackEndpoint(value: string) {
  if (!value.trim()) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function downloadTone(state: string): "good" | "warn" | "bad" | "info" {
  if (state === "installed") return "good";
  if (state === "failed" || state === "cancelled") return "bad";
  if (state === "paused") return "warn";
  return "info";
}

function packStatusTone(status: AIModelPackInfo["release_status"]): "good" | "warn" | "bad" | "info" {
  if (status === "installed" || status === "ready") return "good";
  if (status === "demo_ready") return "info";
  return "warn";
}

function packStatusLabel(status?: AIModelPackInfo["release_status"] | null): string {
  if (status === "installed") return "Installed";
  if (status === "ready") return "Ready";
  if (status === "demo_ready") return "Starter ready";
  if (status === "blocked") return "Needs approval";
  return status ? searchModeLabel(status) : "Checking";
}

function setupStatusTone(status: AISetupStatus["overall_status"] | AISetupStepInfo["status"]): "good" | "warn" | "bad" | "info" | "neutral" {
  if (status === "ready" || status === "done") return "good";
  if (status === "demo_ready" || status === "not_started") return "info";
  if (status === "blocked") return "warn";
  return "neutral";
}

function setupRunTone(status: AISetupRunResult["status"] | AISetupRunStep["status"]): "good" | "warn" | "bad" | "info" | "neutral" {
  if (status === "ready" || status === "demo_ready" || status === "done") return "good";
  if (status === "partial" || status === "queued" || status === "skipped") return "info";
  if (status === "failed") return "bad";
  if (status === "blocked") return "warn";
  return "neutral";
}

function runtimeStateTone(item: AIRuntimeInfo): "good" | "warn" | "bad" | "info" | "neutral" {
  const integrityStatus = item.integrity_status ?? "unknown";
  if (integrityStatus === "mismatch" || integrityStatus === "missing" || integrityStatus === "failed") return "bad";
  if (item.installed || integrityStatus === "verified") return "good";
  if (item.compatible === false) return "warn";
  if (item.installable) return "info";
  return "warn";
}

function runtimeIntegrityTone(status: AIRuntimeInfo["integrity_status"]): "good" | "warn" | "bad" | "info" | "neutral" {
  if (status === "verified") return "good";
  if (status === "mismatch" || status === "missing" || status === "failed") return "bad";
  return "neutral";
}

function runtimeInstallStateLabel(item: AIRuntimeInfo): string {
  const integrityStatus = item.integrity_status ?? "unknown";
  if (integrityStatus === "mismatch" || integrityStatus === "missing" || integrityStatus === "failed") return "Needs repair";
  if (item.installed || item.install_state === "installed") return "Installed";
  if (item.install_state === "not_installed") return "Needs install";
  if (item.install_state === "failed") return "Needs repair";
  return searchModeLabel(item.install_state);
}

function releaseChannelLabel(channel?: string | null): string {
  if (channel === "production") return "Trusted";
  if (channel === "demo") return "Starter";
  return channel ? searchModeLabel(channel) : "Local";
}

function runtimeIntegrityLabel(status?: AIRuntimeInfo["integrity_status"] | null): string {
  if (status === "verified") return "Verified";
  if (status === "mismatch" || status === "missing" || status === "failed") return "Needs repair";
  return status ? searchModeLabel(status) : "Not checked";
}

function runtimeCompatibilityLabel(item: AIRuntimeInfo) {
  if (item.compatible === false) return "wrong host";
  if (item.host_platform && item.host_arch) return "host ok";
  return "host unknown";
}

function runtimeCompatibilityDisplay(item: AIRuntimeInfo) {
  if (item.compatible === false) return "Wrong device";
  if (item.host_platform && item.host_arch) return "Works here";
  return "Compatibility unknown";
}

function runtimeCompatibilityTitle(item: AIRuntimeInfo) {
  return `Target ${item.platform}/${item.arch}; host ${item.host_platform ?? "unknown"}/${item.host_arch ?? "unknown"}`;
}

function runtimeLatestLog(item: AIRuntimeInfo) {
  const logs = item.install_log ?? [];
  const latest = logs[logs.length - 1];
  if (typeof latest?.detail !== "string") return null;
  const version = typeof latest.version === "string" && latest.version.trim() ? ` (${latest.version})` : "";
  return `${latest.detail}${version}`;
}

function localAIUserText(value?: string) {
  if (!value) return "";
  if (value === "blocked") return "Needs action";
  if (value === "ready") return "Ready";
  if (value === "done") return "Complete";
  return value
    .replace(/\bPrepare demo lab\b/g, "Use starter setup")
    .replace(/\bDemo fallback\b/g, "Starter setup")
    .replace(/\bDownload demo\b/g, "Download starter")
    .replace(/\bInstall demo runtime\b/g, "Install starter runtime")
    .replace(/\bdemo llama\.cpp runtime\b/gi, "starter llama.cpp runtime")
    .replace(/\bdemo lab\b/gi, "starter setup")
    .replace(/\bdemo fallback\b/gi, "starter setup")
    .replace(/\bapproved local production models\b/gi, "approved local models")
    .replace(/\bapproved local production model\b/gi, "approved local model")
    .replace(/\blocal production models\b/gi, "approved local models")
    .replace(/\blocal production model\b/gi, "approved local model")
    .replace(/\bproduction local models\b/gi, "approved local models")
    .replace(/\bproduction local model\b/gi, "approved local model")
    .replace(/\bproduction local\b/gi, "approved local")
    .replace(/\bapproved local Pack\b/g, "Trusted Local Pack")
    .replace(/\bPin production model checksums\b/g, "Verify model file checksums")
    .replace(/\bPin the SHA-256 checksum before use\.?/g, "Add the SHA-256 checksum before using this model.")
    .replace(/\bApprove production runtime sources\b/g, "Trust runtime sources")
    .replace(/\bRoute production capabilities\b/g, "Connect local model tasks")
    .replace(/\bRequired production capabilities\b/g, "Required local model tasks")
    .replace(/\bProduction model packs\b/g, "Trusted model packs")
    .replace(/\bProduction runtime manifests\b/g, "Trusted runtime files")
    .replace(/\bProduction runtimes\b/g, "Trusted runtimes")
    .replace(/\bProduction Local Pack\b/g, "Trusted Local Pack")
    .replace(/\bCapability routes\b/g, "Model task routing")
    .replace(/\bextract_claims route\b/g, "Claim suggestions task")
    .replace(/\bgenerate_note route\b/g, "Draft notes task")
    .replace(/\bproduction readiness\b/gi, "local model readiness")
    .replace(/\brelease evidence\b/gi, "model evidence")
    .replace(/\bregistry tools\b/gi, "setup tools")
    .replace(/\bregistry structure\b/gi, "file list")
    .replace(/\bmanifest validation\b/gi, "file check")
    .replace(/\bManifest evidence\b/g, "File evidence")
    .replace(/\bmanifest evidence\b/gi, "file evidence")
    .replace(/\bmanifest blockers\b/gi, "file items")
    .replace(/\bmanifest items\b/gi, "file items")
    .replace(/\bcandidate manifests\b/gi, "candidate files")
    .replace(/\bEvaluate candidate manifests\b/g, "Evaluate candidate files")
    .replace(/\bregistry validation\b/gi, "file checks")
    .replace(/\bcandidate registries\b/gi, "candidate files")
    .replace(/\bcandidate registry\b/gi, "candidate file")
    .replace(/\bpinned registries\b/gi, "trusted model files")
    .replace(/\bpinned metadata\b/gi, "trusted metadata")
    .replace(/\bpinned source\b/gi, "trusted source")
    .replace(/\bmetadata is not hydrated\b/gi, "source metadata is not checked")
    .replace(/\bHydrate upstream metadata\b/g, "Check source metadata")
    .replace(/\bhydrate upstream metadata\b/gi, "check source metadata")
    .replace(/\bhydrated\b/gi, "checked")
    .replace(/\bhydrate\b/gi, "check")
    .replace(/\bSource probe\b/g, "Source check")
    .replace(/\bsource probe\b/gi, "source check")
    .replace(/\bprobed\b/gi, "checked")
    .replace(/\bprobe\b/gi, "check")
    .replace(/\bByte verification\b/g, "File verification")
    .replace(/\bbyte verification\b/gi, "file verification")
    .replace(/\bartifact bytes\b/gi, "files")
    .replace(/\bartifact sources\b/gi, "sources")
    .replace(/\bVerify artifact bytes\b/g, "Verify candidate files")
    .replace(/\bReviewer evidence has not been applied to candidate registries\b/g, "Reviewer evidence has not been applied to candidate files")
    .replace(/\bApply reviewer evidence JSON\b/g, "Apply reviewer evidence")
    .replace(/\bpatched registries and handoff\b/gi, "prepared files and review commands")
    .replace(/\bPatched registry handoff\b/g, "Prepared file handoff")
    .replace(/\bBundled registries\b/g, "Bundled model files")
    .replace(/\brelease URL\b/gi, "trusted source URL")
    .replace(/\brelease blocker\b/gi, "setup item")
    .replace(/Route this capability[\s\S]*before use\.?/gi, "Choose an approved local model for this task before using it.")
    .replace(/\bnot ready to pin\b/gi, "needs evidence")
    .replace(/\bready to pin\b/gi, "ready to trust")
    .replace(/\bpin-ready\b/gi, "ready to trust")
    .replace(/\bblockers\b/gi, "items")
    .replace(/\bblocker\b/gi, "item")
    .replace(/\brelease-ready downloads\b/gi, "approved downloads")
    .replace(/\bbefore release\b/gi, "before use");
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function readinessTone(status: AIReadinessCheck["status"]): "good" | "warn" | "bad" | "info" | "neutral" {
  if (status === "pass") return "good";
  if (status === "blocked") return "bad";
  if (status === "warn") return "warn";
  return "info";
}

function readinessReportTone(status: AIProductionReadinessReport["status"] | AIReadinessReportSection["status"]): "good" | "warn" | "bad" | "info" | "neutral" {
  if (status === "ready") return "good";
  if (status === "blocked") return "bad";
  if (status === "warn") return "warn";
  return "info";
}

function registryValidationTone(report?: AIRegistryValidationReport): "good" | "warn" | "bad" | "info" | "neutral" {
  if (!report) return "neutral";
  if (report.status === "fail" || report.summary.error_count > 0) return "bad";
  if (report.summary.warning_count > 0) return "warn";
  return "good";
}

function registryPolicyTone(report?: AIRegistryValidationReport): "good" | "warn" | "bad" | "neutral" {
  if (!report?.policy) return "neutral";
  if (report.policy.status === "pass") return "good";
  if (report.policy.status === "missing" || report.policy.status === "fail") return "bad";
  return "warn";
}

function approvalCategoryLabel(category: AIProductionReadinessReport["approval_items"][number]["category"]) {
  if (category === "model_pack") return "model pack";
  if (category === "runtime") return "runtime";
  if (category === "privacy") return "privacy";
  return "route";
}

function approvalCategoryTone(category: AIProductionReadinessReport["approval_items"][number]["category"]): "good" | "warn" | "bad" | "info" | "neutral" {
  if (category === "privacy") return "bad";
  if (category === "runtime") return "warn";
  if (category === "capability_route") return "info";
  return "neutral";
}

function approvalActionLabel(category: AIProductionReadinessReport["approval_items"][number]["category"]) {
  if (category === "capability_route") return "Open Search";
  if (category === "runtime") return "Open runtimes";
  if (category === "privacy") return "Review privacy";
  return "Setup";
}

type ApprovalItem = AIProductionReadinessReport["approval_items"][number];
type ApprovalCheckContext = { section: AIReadinessReportSection; check: AIReadinessCheck };

function approvalChecksForItem(report: AIProductionReadinessReport, item: ApprovalItem): ApprovalCheckContext[] {
  const checkIds = new Set(item.check_ids);
  if (checkIds.size === 0) return [];
  return report.sections.flatMap((section) => section.checks.filter((check) => checkIds.has(check.id)).map((check) => ({ section, check })));
}

function visibleApprovalItems(items: ApprovalItem[], limit = 8): ApprovalItem[] {
  const sorted = [...items].sort((a, b) => b.blocker_count - a.blocker_count || a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  if (sorted.length <= limit) return sorted;
  const selected = sorted.slice(0, limit);
  const selectedCategories = new Set(selected.map((item) => item.category));
  for (const item of sorted.slice(limit)) {
    if (selectedCategories.has(item.category)) continue;
    const replaceIndex = leastCostlyApprovalReplacementIndex(selected);
    selected[replaceIndex] = item;
    selectedCategories.add(item.category);
  }
  return selected.sort((a, b) => b.blocker_count - a.blocker_count || a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
}

function leastCostlyApprovalReplacementIndex(items: ApprovalItem[]): number {
  const categoryCounts = items.reduce<Record<string, number>>((counts, item) => {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
    return counts;
  }, {});
  const candidates = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => categoryCounts[item.category] > 1);
  const replaceable = candidates.length ? candidates : items.map((item, index) => ({ item, index }));
  return replaceable.reduce((best, candidate) => {
    if (candidate.item.blocker_count < best.item.blocker_count) return candidate;
    if (candidate.item.blocker_count === best.item.blocker_count && candidate.item.title > best.item.title) return candidate;
    return best;
  }).index;
}

function packSetupActionLabel(pack: AIModelPackInfo) {
  if (pack.installed) return "Re-test pack";
  return pack.installable ? "Install & test" : "Check readiness";
}

function packSetupActionTone(pack: AIModelPackInfo, recommended: boolean): "primary" | "secondary" | "quiet" | "danger" {
  if (pack.installable && recommended) return "primary";
  if (recommended) return "secondary";
  return "quiet";
}

function capabilityRouteTone(binding?: CapabilityBinding): "good" | "warn" | "bad" | "info" | "neutral" {
  if (!binding) return "bad";
  if (!binding.local_only) return "bad";
  if (binding.provider_id.startsWith("mock_")) return "warn";
  return "good";
}

function capabilityRouteLabel(binding?: CapabilityBinding) {
  if (!binding) return "Needs route";
  if (!binding.local_only) return "Off-device";
  if (binding.provider_id.startsWith("mock_")) return "Starter route";
  return "Trusted route";
}

function runtimeInstallLabel(item: AIRuntimeInfo) {
  const integrityStatus = item.integrity_status ?? "unknown";
  if (item.installed) return "Installed";
  if (item.install_state === "failed" || ["mismatch", "missing", "failed"].includes(integrityStatus)) return "Repair";
  return item.installable ? "Install" : "Blocked";
}

function runtimeHealthLabel(state?: RuntimeHealth["llama_cpp"]["state"]) {
  if (state === "ready") return "Ready";
  if (state === "degraded") return "Needs attention";
  if (state === "no_installed_model") return "Needs model";
  if (state === "not_configured") return "Needs setup";
  return "Checking";
}

function runtimeCliLabel(configured?: boolean) {
  return configured ? "Runtime ready" : "Runtime missing";
}

function runtimeInstalledModelsLabel(count: number) {
  if (count === 0) return "No local GGUF models";
  if (count === 1) return "1 local GGUF model";
  return `${count} local GGUF models`;
}

function runtimeBinaryStatusLabel(binary?: RuntimeHealth["llama_cpp"]["cli"]) {
  if (binary?.configured) return "Ready";
  return "Missing";
}

function runtimeBinaryDescription(kind: "cli" | "server", binary?: RuntimeHealth["llama_cpp"]["cli"]) {
  if (binary?.configured) return kind === "cli" ? "Ready for local model tests" : "Ready for loopback model routes";
  return kind === "cli" ? "Install a local runtime to test models here." : "Optional server is not set up.";
}

function runtimeBinaryTitle(binary?: RuntimeHealth["llama_cpp"]["cli"]) {
  const parts = [
    binary?.path ? `Path: ${binary.path}` : "Path: not configured",
    `Source: ${binary?.source ?? "unknown"}`,
    `Integrity: ${binary?.integrity_status ?? "unknown"}`
  ];
  if (binary?.version) parts.push(`Version: ${binary.version}`);
  if (binary?.error) parts.push(`Error: ${binary.error}`);
  return parts.join(" | ");
}

function serverProcessLabel(state?: string | null) {
  if (state === "running") return "Running";
  if (state === "exited") return "Stopped";
  if (state === "stopped") return "Stopped";
  return "Idle";
}

function serverProcessDescription(process?: RuntimeHealth["llama_cpp"]["server_process"]) {
  if (process?.state === "running") return process.endpoint ? "Running on loopback" : "Running locally";
  if (process?.state === "exited") return "Stopped after the last run";
  return "No model server running";
}

function serverProcessTitle(process?: RuntimeHealth["llama_cpp"]["server_process"]) {
  if (!process) return "No server process loaded";
  const parts = [
    `State: ${process.state}`,
    process.endpoint ? `Endpoint: ${process.endpoint}` : "",
    process.model_id ? `Model: ${process.model_id}` : "",
    process.mode ? `Mode: ${process.mode}` : "",
    process.pid ? `PID: ${process.pid}` : "",
    process.log_path ? `Log: ${process.log_path}` : "",
    process.exit_code != null ? `Exit: ${process.exit_code}` : ""
  ].filter(Boolean);
  return parts.join(" | ");
}

function setupActionIcon(step: AISetupStepInfo) {
  if (step.action_route === "ai.modelPacks.download") return <Download size={14} />;
  if (step.action_route === "ai.runtimes.install") return <Download size={14} />;
  if (step.action_route?.startsWith("settings.")) return <SlidersHorizontal size={14} />;
  return <Play size={14} />;
}

function AISetupGuide({
  setup,
  busy,
  onAction,
  onPrepareDemo,
  onOpenWizard
}: {
  setup?: AISetupStatus;
  busy: boolean;
  onAction: (step: AISetupStepInfo) => void;
  onPrepareDemo: () => void;
  onOpenWizard: () => void;
}) {
  if (!setup || !Array.isArray(setup.steps)) return null;
  const currentStep =
    setup.steps.find((step) => step.action_label && (step.status === "blocked" || step.status === "ready")) ??
    setup.steps.find((step) => step.status === "blocked") ??
    setup.steps.find((step) => step.status === "ready") ??
    setup.steps.find((step) => step.status !== "done") ??
    setup.steps[0];
  return (
    <section className="setup-guide" aria-label="Private model setup steps">
      <div className="setup-guide-header">
        <div>
          <Badge tone={setupStatusTone(setup.overall_status)} title={setup.overall_status}>
            {setupStatusLabel(setup.overall_status)}
          </Badge>
          <h3>Private setup steps</h3>
          <p>{localAIUserText(setup.next_action)}</p>
        </div>
        <div className="setup-guide-summary">
          <Badge tone="good">{setup.privacy_label}</Badge>
          <span>{setup.recommended_profile} profile</span>
          {setup.recommended_pack_id && <small title={setup.recommended_pack_id}>Trusted pack selected</small>}
          <Button icon={<Sparkles size={14} />} variant="secondary" disabled={busy} onClick={onOpenWizard}>
            Setup
          </Button>
          {setup.can_use_demo && (
            <Button icon={<Beaker size={14} />} variant="primary" disabled={busy} onClick={onPrepareDemo}>
              Use starter setup
            </Button>
          )}
        </div>
      </div>
      {currentStep && (
        <article className={`setup-current-step ${currentStep.status}`} aria-label="Current local AI setup step">
          <Badge tone={setupStatusTone(currentStep.status)}>current</Badge>
          <div>
            <strong>{localAIUserText(currentStep.title)}</strong>
            <span>{localAIUserText(currentStep.summary)}</span>
            {currentStep.detail && <small>{localAIUserText(currentStep.detail)}</small>}
          </div>
          {currentStep.action_label && (
            <Button icon={setupActionIcon(currentStep)} variant={currentStep.status === "ready" ? "primary" : "secondary"} disabled={busy} onClick={() => onAction(currentStep)}>
              {localAIUserText(currentStep.action_label)}
            </Button>
          )}
        </article>
      )}
      <div className="setup-step-chips" aria-label="Local AI setup progress">
        {setup.steps.map((step) => (
          <span key={step.id} className={`setup-step-chip ${step.status}`}>
            <Badge tone={setupStatusTone(step.status)} title={step.status}>
              {setupStatusLabel(step.status)}
            </Badge>
            {localAIUserText(step.title)}
          </span>
        ))}
      </div>
    </section>
  );
}

function LocalAICommandCenter({
  setup,
  report,
  releasePlan,
  productionPack,
  demoPack,
  runtimes,
  busy,
  candidateBusy,
  onOpenWizard,
  onOpenRouting,
  onRunDemo,
  onRunRecommended,
  onEvaluateCandidate
}: {
  setup?: AISetupStatus;
  report?: AIProductionReadinessReport;
  releasePlan?: AIRegistryReleasePlanReport;
  productionPack?: AIModelPackInfo;
  demoPack?: AIModelPackInfo;
  runtimes: AIRuntimeInfo[];
  busy: boolean;
  candidateBusy: boolean;
  onOpenWizard: () => void;
  onOpenRouting: () => void;
  onRunDemo: () => void;
  onRunRecommended: () => void;
  onEvaluateCandidate: () => void;
}) {
  if (!setup && !report && !releasePlan) return null;
  const reportSummary = report?.summary;
  const reportSections = Array.isArray(report?.sections) ? report.sections : [];
  const setupSteps = Array.isArray(setup?.steps) ? setup.steps : [];
  const releaseSummary = releasePlan?.summary;
  const routeSection = reportSections.find((section) => section.id === "capability-routes");
  const productionGateTotal =
    (reportSummary?.production_pack_count ?? 0) + (reportSummary?.production_runtime_count ?? 0) + (routeSection ? 1 : 0);
  const productionGateReady =
    (reportSummary?.ready_production_pack_count ?? 0) +
    (reportSummary?.ready_production_runtime_count ?? 0) +
    (routeSection && routeSection.blocked_count === 0 ? 1 : 0);
  const progressPercent = productionGateTotal ? Math.round((productionGateReady / productionGateTotal) * 100) : 0;
  const topApproval = [...(report?.approval_items ?? [])].sort((a, b) => b.blocker_count - a.blocker_count)[0];
  const blockedSetup = setupSteps.find((step) => step.status === "blocked");
  const installableRuntimeCount = runtimes.filter((runtimeItem) => runtimeItem.installable && !runtimeItem.installed).length;
  const demoAvailable = Boolean(setup?.can_use_demo || demoPack?.installable || demoPack?.installed);
  const nextTitle = topApproval?.title ?? blockedSetup?.title ?? setup?.next_action ?? "Check private model setup";
  const nextDetail = topApproval?.next_action ?? blockedSetup?.detail ?? report?.next_actions?.[0] ?? setup?.next_action;
  const nextDetailCopy =
    topApproval?.category === "capability_route" ? "Choose an approved local model for this task before using it." : localAIUserText(nextDetail);
  const productionGateLabel = productionGateTotal ? `${productionGateReady}/${productionGateTotal} essentials ready` : "setup checks loading";
  const routeLabel = routeSection ? (routeSection.blocked_count ? `${routeSection.blocked_count} tasks need models` : "Tasks connected") : "Task checks loading";
  const releaseBlockerCount = releaseSummary?.blocked_count ?? 0;
  let primaryActionKey = "wizard";
  let primaryActionLabel = "Setup";
  let primaryActionIcon = <Wrench size={14} />;
  let primaryActionDisabled = busy;
  let primaryActionVariant: "primary" | "secondary" = "primary";
  let primaryAction = onOpenWizard;
  if (topApproval?.category === "capability_route") {
    primaryActionKey = "routes";
    primaryActionLabel = "Open Search";
    primaryActionIcon = <SlidersHorizontal size={14} />;
    primaryActionDisabled = false;
    primaryAction = onOpenRouting;
  } else if (topApproval?.category === "model_pack") {
    primaryActionKey = "candidate";
    primaryActionLabel = candidateBusy ? "Loading files" : "Add evidence";
    primaryActionIcon = <FolderOpen size={14} />;
    primaryActionDisabled = candidateBusy;
    primaryAction = onEvaluateCandidate;
  } else if (productionPack?.installable || setup?.recommended_pack_id) {
    primaryActionKey = "recommended";
    primaryActionLabel =
      productionPack?.id === "starter-local-pack"
        ? productionPack.installable
          ? "Install Starter"
          : "Review Starter"
        : productionPack?.installable
          ? "Use recommended pack"
          : "Review setup";
    primaryActionIcon = <Sparkles size={14} />;
    primaryActionDisabled = busy || (!productionPack && !setup?.recommended_pack_id);
    primaryActionVariant = productionPack?.installable ? "primary" : "secondary";
    primaryAction = onRunRecommended;
  }

  return (
    <section className="local-ai-command" aria-label="Local AI setup summary">
      <div className="local-ai-command-header">
        <div>
          <Badge tone={report?.production_ready ? "good" : setup?.can_use_demo ? "warn" : "bad"}>
            {report?.production_ready ? "approved" : setup?.can_use_demo ? "starter ready" : "needs setup"}
          </Badge>
          <h3>Local models</h3>
          <p>{localAIUserText(setup?.next_action ?? report?.next_actions?.[0] ?? "Finish setup before using approved local models.")}</p>
        </div>
        <div className="local-ai-command-score">
          <strong>{progressPercent}%</strong>
          <span>{productionGateLabel}</span>
          <div className="local-ai-command-progress" aria-hidden="true">
            <i style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>
      <div className="local-ai-command-grid">
        <article className={report?.production_ready ? "ready" : "blocked"}>
          <div>
            <Badge tone={report?.production_ready ? "good" : "bad"}>{report?.production_ready ? "Ready" : `${reportSummary?.blocked_count ?? 0} items`}</Badge>
            <Shield size={18} />
          </div>
          <strong>Trusted models</strong>
          <span>
            {report
              ? `${reportSummary?.ready_production_pack_count ?? 0}/${reportSummary?.production_pack_count ?? 0} packs, ${reportSummary?.ready_production_runtime_count ?? 0}/${reportSummary?.production_runtime_count ?? 0} runtimes`
              : "approval status loading"}
          </span>
          <small>{routeLabel}</small>
        </article>
        <article className={demoAvailable ? "ready" : "blocked"}>
          <div>
            <Badge tone={demoAvailable ? "info" : "bad"}>{demoAvailable ? "Available" : "Needs files"}</Badge>
            <Beaker size={18} />
          </div>
          <strong>Starter models</strong>
          <span>{demoPack?.display_name ?? setup?.demo_pack_id ?? "No demo pack selected"}</span>
          <small>{demoPack?.installed ? "Starter models are installed." : demoPack?.installable ? "Starter models can be prepared." : "Starter setup needs files."}</small>
        </article>
        <article className={releaseSummary?.ready_to_pin ? "ready" : "blocked"}>
          <div>
            <Badge tone={releaseSummary?.ready_to_pin ? "good" : "warn"}>
              {releaseSummary?.ready_to_pin ? "Ready to use" : `${releaseBlockerCount} items`}
            </Badge>
            <HardDrive size={18} />
          </div>
          <strong>Items to finish</strong>
          <span>
            {releasePlan
              ? `${releaseSummary?.ready_production_model_count ?? 0}/${releaseSummary?.production_model_count ?? 0} model files, ${releaseSummary?.ready_production_runtime_count ?? 0}/${releaseSummary?.production_runtime_count ?? 0} runtimes`
              : "Setup checklist loading"}
          </span>
          <small>{installableRuntimeCount ? `${installableRuntimeCount} runtimes can be installed now.` : "No runtime install is waiting."}</small>
        </article>
        <aside className="local-ai-next-move">
          <div>
            <Badge tone={topApproval ? approvalCategoryTone(topApproval.category) : "info"}>next</Badge>
            <strong>{localAIUserText(nextTitle)}</strong>
            {nextDetailCopy && <span>{nextDetailCopy}</span>}
          </div>
          <div>
            <Button icon={primaryActionIcon} variant={primaryActionVariant} disabled={primaryActionDisabled} onClick={primaryAction}>
              {primaryActionLabel}
            </Button>
            <Button icon={<Beaker size={14} />} variant="secondary" disabled={!demoAvailable || busy} onClick={onRunDemo}>
              Use starter setup
            </Button>
            {primaryActionKey !== "routes" && (
              <Button icon={<SlidersHorizontal size={14} />} variant="quiet" onClick={onOpenRouting}>
                Open Search
              </Button>
            )}
            {primaryActionKey !== "wizard" && (
              <Button icon={<Wrench size={14} />} variant="quiet" onClick={onOpenWizard}>
                Setup
              </Button>
            )}
            {primaryActionKey !== "candidate" && topApproval?.category !== "capability_route" && (
              <Button icon={<FolderOpen size={14} />} variant="quiet" disabled={candidateBusy} onClick={onEvaluateCandidate}>
                {candidateBusy ? "Loading files" : "Add evidence"}
              </Button>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function AIProductionReadinessPanel({
  report,
  registryValidation,
  registryValidationLoading,
  exportBusy,
  exportStatus,
  templateBusy,
  templateStatus,
  onExport,
  onExportTemplate,
  onExportEvidenceTemplate,
  onOpenWizard,
  onOpenRouting
}: {
  report?: AIProductionReadinessReport;
  registryValidation?: AIRegistryValidationReport;
  registryValidationLoading: boolean;
  exportBusy: boolean;
  exportStatus?: string | null;
  templateBusy: boolean;
  templateStatus?: string | null;
  onExport: () => void;
  onExportTemplate: () => void;
  onExportEvidenceTemplate: () => void;
  onOpenWizard: () => void;
  onOpenRouting: () => void;
}) {
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  if (!report || !Array.isArray(report.sections)) return null;
  const blockedSections = report.sections.filter((section) => section.status === "blocked");
  const visibleActions = report.next_actions.slice(0, 4);
  const approvalItems = visibleApprovalItems(report.approval_items ?? [], 8);
  const selectedApproval = approvalItems.find((item) => item.id === selectedApprovalId) ?? approvalItems[0];
  const selectedApprovalChecks = selectedApproval ? approvalChecksForItem(report, selectedApproval).slice(0, 8) : [];
  const validationSummary = registryValidation?.summary;
  const validationIssue =
    registryValidation?.errors[0] ??
    registryValidation?.warnings[0] ??
    "Model and runtime file list is ready for setup checks.";
  return (
    <section className="production-readiness" aria-label="Local AI approval checklist">
      <div className="production-readiness-header">
        <div>
          <Badge tone={readinessReportTone(report.status)}>{report.production_ready ? "approved" : "needs approval"}</Badge>
          <h3>Approval checklist</h3>
          <p>Checks that keep real local models private, verified, and safe to use for notes, search, and voice.</p>
        </div>
        <div className="production-readiness-actions">
          <Button icon={<Sparkles size={14} />} variant="secondary" onClick={onOpenWizard}>
            Setup
          </Button>
          <Button icon={<Save size={14} />} variant="secondary" disabled={exportBusy} onClick={onExport}>
            {exportBusy ? "Exporting..." : "Export checklist"}
          </Button>
          <Button icon={<FilePlus2 size={14} />} variant="quiet" disabled={templateBusy} onClick={onExportTemplate}>
            {templateBusy ? "Exporting..." : "Export approval template"}
          </Button>
          <Button icon={<FilePlus2 size={14} />} variant="quiet" disabled={templateBusy} onClick={onExportEvidenceTemplate}>
            Export evidence file
          </Button>
          <Button icon={<SlidersHorizontal size={14} />} variant="quiet" onClick={onOpenRouting}>
            Open Search
          </Button>
        </div>
      </div>
      {exportStatus && <small className="readiness-export-status">{exportStatus}</small>}
      {templateStatus && <small className="readiness-export-status">{templateStatus}</small>}
      <div className="registry-health-band" aria-label="Local AI model files">
        <div>
          <Badge tone={registryValidationTone(registryValidation)}>
            {registryValidationLoading ? "checking" : registryValidation?.status ?? "unknown"}
          </Badge>
          <strong>Model files</strong>
          <span>
            {validationSummary
              ? `${validationSummary.model_count} models / ${validationSummary.model_pack_count} packs / ${validationSummary.runtime_count} runtimes`
              : "Checking model and runtime file list."}
          </span>
        </div>
        <div>
          <Badge tone={registryValidation?.summary.error_count ? "bad" : "good"}>{validationSummary?.error_count ?? 0} errors</Badge>
          <Badge tone={registryValidation?.summary.warning_count ? "warn" : "good"}>{validationSummary?.warning_count ?? 0} warnings</Badge>
          <Badge tone={registryPolicyTone(registryValidation)}>
            {registryValidation?.policy?.status === "pass" ? "checked" : setupStatusLabel(registryValidation?.policy?.status)}
          </Badge>
          <small>{localAIUserText(validationIssue)}</small>
        </div>
      </div>
      <div className="readiness-metrics">
        <article>
          <strong>{report.summary.blocked_count}</strong>
          <span>items to resolve</span>
        </article>
        <article>
          <strong>
            {report.summary.ready_production_pack_count}/{report.summary.production_pack_count}
          </strong>
          <span>packs ready</span>
        </article>
        <article>
          <strong>
            {report.summary.ready_production_runtime_count}/{report.summary.production_runtime_count}
          </strong>
          <span>runtimes ready</span>
        </article>
        <article>
          <strong>{report.demo_available ? "yes" : "no"}</strong>
          <span>starter path</span>
        </article>
      </div>
      {visibleActions.length > 0 && (
        <div className="readiness-next-actions">
          <strong>Next steps</strong>
          <div>
            {visibleActions.map((action) => (
              <span key={action}>{localAIUserText(action)}</span>
            ))}
          </div>
        </div>
      )}
      {approvalItems.length > 0 && (
        <div className="approval-board" aria-label="Local AI items to finish">
          <div className="approval-board-header">
            <div>
              <strong>Items to finish</strong>
              <span>{approvalItems.length} setup areas need evidence before local models are trusted.</span>
            </div>
            <Badge tone="warn">{approvalItems.reduce((total, item) => total + item.blocker_count, 0)} items</Badge>
          </div>
          <div className="approval-board-body">
            <div className="approval-board-list">
              {approvalItems.map((item, index) => (
                <article key={item.id} className={selectedApproval?.id === item.id ? "active" : ""}>
                  <div>
                    <Badge tone="neutral">#{index + 1}</Badge>
                    <Badge tone={approvalCategoryTone(item.category)}>{approvalCategoryLabel(item.category)}</Badge>
                    <Badge tone="warn">{item.blocker_count} items</Badge>
                    <Badge tone="neutral">{item.check_ids.length} checks</Badge>
                  </div>
                  <strong>{localAIUserText(item.title)}</strong>
                  <span>{localAIUserText(item.next_action)}</span>
                  {item.sample_details[0] && <small>{localAIUserText(item.sample_details[0])}</small>}
                  <div className="approval-card-actions">
                    <Button icon={<Search size={14} />} variant={selectedApproval?.id === item.id ? "secondary" : "quiet"} onClick={() => setSelectedApprovalId(item.id)}>
                      Inspect
                    </Button>
                    <Button
                      icon={item.category === "capability_route" ? <SlidersHorizontal size={14} /> : <Wrench size={14} />}
                      variant="quiet"
                      onClick={item.category === "capability_route" ? onOpenRouting : onOpenWizard}
                    >
                      {approvalActionLabel(item.category)}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
            {selectedApproval && (
              <aside className="approval-detail" aria-label="Selected local AI setup item">
                <div className="approval-detail-kicker">
                  <Badge tone={approvalCategoryTone(selectedApproval.category)}>{approvalCategoryLabel(selectedApproval.category)}</Badge>
                  <Badge tone="warn">{selectedApproval.blocker_count} items</Badge>
                  <Badge tone="neutral">{selectedApproval.check_ids.length} linked checks</Badge>
                </div>
                <h4>{localAIUserText(selectedApproval.title)}</h4>
                <p>{localAIUserText(selectedApproval.next_action)}</p>
                <div className="approval-detail-actions">
                  <Button
                    icon={selectedApproval.category === "capability_route" ? <SlidersHorizontal size={14} /> : <Wrench size={14} />}
                    variant={selectedApproval.category === "capability_route" ? "secondary" : "primary"}
                    onClick={selectedApproval.category === "capability_route" ? onOpenRouting : onOpenWizard}
                  >
                    {approvalActionLabel(selectedApproval.category)}
                  </Button>
                </div>
                <div className="approval-check-list">
                  {selectedApprovalChecks.length > 0
                    ? selectedApprovalChecks.map(({ section, check }) => (
                        <article key={check.id}>
                          <div>
                            <Badge tone={readinessTone(check.status)}>{setupStatusLabel(check.status)}</Badge>
                            <span>{localAIUserText(section.title)}</span>
                          </div>
                          <strong>{localAIUserText(check.label)}</strong>
                          <small>{localAIUserText(check.detail)}</small>
                          {check.action && <em>{localAIUserText(check.action)}</em>}
                        </article>
                      ))
                    : selectedApproval.sample_details.map((detail) => (
                        <article key={detail}>
                          <div>
                            <Badge tone="bad">Needs action</Badge>
                            <span>{approvalCategoryLabel(selectedApproval.category)}</span>
                          </div>
                          <strong>{localAIUserText(selectedApproval.title)}</strong>
                          <small>{localAIUserText(detail)}</small>
                        </article>
                      ))}
                </div>
                {selectedApproval.blocker_count > selectedApprovalChecks.length && (
                  <small className="approval-detail-more">
                    {selectedApproval.blocker_count - selectedApprovalChecks.length} more items share this setup action.
                  </small>
                )}
              </aside>
            )}
          </div>
        </div>
      )}
      <div className="readiness-section-list">
        {report.sections.map((section) => {
          const firstBlocked = section.checks.find((check) => check.status === "blocked");
          return (
            <article key={section.id}>
              <Badge tone={readinessReportTone(section.status)}>{setupStatusLabel(section.status)}</Badge>
              <div>
                <strong>{localAIUserText(section.title)}</strong>
                <span>{localAIUserText(section.summary)}</span>
                {firstBlocked && <small>{localAIUserText(firstBlocked.detail)}</small>}
              </div>
              <em>{section.blocked_count} items</em>
            </article>
          );
        })}
      </div>
      {blockedSections.length === 0 && <small className="import-result">All local model readiness sections are clear.</small>}
    </section>
  );
}

function AIRegistryReleasePlanPanel({
  plan,
  productionReadiness,
  exportBusy,
  exportStatus,
  candidate,
  candidateHydration,
  candidateArtifactProbe,
  candidateArtifactVerification,
  candidateEvidence,
  candidateReleasePacket,
  workspace,
  workspaceBusy,
  candidateBusy,
  candidateHydrationBusy,
  candidateHydrationExportBusy,
  candidateExportBusy,
  candidateProbeBusy,
  candidateProbeExportBusy,
  candidateVerificationBusy,
  candidateVerificationExportBusy,
  candidateTemplateBusy,
  candidateEvidenceBusy,
  candidateReleasePacketBusy,
  patchedRegistryExportBusy,
  evidenceMarkdownExportBusy,
  canHydrateCandidate,
  candidateStatus,
  workspaceStatus,
  onExport,
  onSaveWorkspace,
  onClearWorkspace,
  onEvaluateCandidate,
  onHydrateCandidateMetadata,
  onExportHydratedModelRegistry,
  onExportCandidate,
  onProbeCandidateArtifacts,
  onExportCandidateArtifactProbe,
  onVerifyCandidateArtifacts,
  onExportCandidateArtifactVerification,
  onExportCandidateArtifactEvidence,
  onExportCandidateTemplate,
  onExportCandidateEvidenceTemplate,
  onApplyCandidateEvidence,
  onPrepareReleasePacket,
  onPrepareVerifiedReleasePacket,
  onExportAppliedReleasePlan,
  onExportAppliedApprovalTemplate,
  onExportPinHandoff,
  onExportPatchedModelRegistry,
  onExportPatchedRuntimeRegistry
}: {
  plan?: AIRegistryReleasePlanReport;
  productionReadiness?: AIProductionReadinessReport;
  exportBusy: boolean;
  exportStatus?: string | null;
  candidate?: AIRegistryReleasePlanExport | null;
  candidateHydration?: AIRegistryMetadataHydrationExport | null;
  candidateArtifactProbe?: AIRegistryArtifactProbeExport | null;
  candidateArtifactVerification?: AIRegistryArtifactVerificationExport | null;
  candidateEvidence?: AIRegistryEvidenceOverlayExport | null;
  candidateReleasePacket?: AIRegistryReleasePacket | null;
  workspace?: AIRegistryReleaseWorkspace;
  workspaceBusy: boolean;
  candidateBusy: boolean;
  candidateHydrationBusy: boolean;
  candidateHydrationExportBusy: boolean;
  candidateExportBusy: boolean;
  candidateProbeBusy: boolean;
  candidateProbeExportBusy: boolean;
  candidateVerificationBusy: boolean;
  candidateVerificationExportBusy: boolean;
  candidateTemplateBusy: boolean;
  candidateEvidenceBusy: boolean;
  candidateReleasePacketBusy: boolean;
  patchedRegistryExportBusy: boolean;
  evidenceMarkdownExportBusy: boolean;
  canHydrateCandidate: boolean;
  candidateStatus?: string | null;
  workspaceStatus?: string | null;
  onExport: () => void;
  onSaveWorkspace: () => void;
  onClearWorkspace: () => void;
  onEvaluateCandidate: () => void;
  onHydrateCandidateMetadata: () => void;
  onExportHydratedModelRegistry: () => void;
  onExportCandidate: () => void;
  onProbeCandidateArtifacts: () => void;
  onExportCandidateArtifactProbe: () => void;
  onVerifyCandidateArtifacts: () => void;
  onExportCandidateArtifactVerification: () => void;
  onExportCandidateArtifactEvidence: () => void;
  onExportCandidateTemplate: () => void;
  onExportCandidateEvidenceTemplate: () => void;
  onApplyCandidateEvidence: () => void;
  onPrepareReleasePacket: () => void;
  onPrepareVerifiedReleasePacket: () => void;
  onExportAppliedReleasePlan: () => void;
  onExportAppliedApprovalTemplate: () => void;
  onExportPinHandoff: () => void;
  onExportPatchedModelRegistry: () => void;
  onExportPatchedRuntimeRegistry: () => void;
}) {
  if (!plan?.summary || !Array.isArray(plan.artifacts) || !Array.isArray(plan.next_actions)) return null;
  const topArtifacts = [...(plan.artifacts ?? [])]
    .filter((artifact) => artifact.status !== "ready")
    .sort((a, b) => b.blocked_count - a.blocked_count || b.warning_count - a.warning_count)
    .slice(0, 5);
  const visibleActions = plan.next_actions.slice(0, 4);
  const readyTone = plan.summary.ready_to_pin ? "good" : "bad";
  const promotionStages = releasePromotionStages(
    plan,
    productionReadiness,
    candidate,
    candidateHydration,
    candidateArtifactProbe,
    candidateArtifactVerification,
    candidateEvidence
  );
  return (
    <section className="registry-release-plan" aria-label="Local model preparation">
      <div className="registry-release-plan-header">
        <div>
          <Badge tone={readyTone}>{plan.summary.ready_to_pin ? "ready to trust" : "needs evidence"}</Badge>
          <h3>Local model preparation</h3>
          <p>Check candidate model and runtime files before they can power private notes, search, and voice.</p>
        </div>
        <div className="registry-release-plan-policy">
          <Badge tone={registryValidationTone(plan.validation)}>{setupStatusLabel(plan.validation.status)}</Badge>
          <Badge tone={plan.summary.validation_warning_count ? "warn" : "good"}>{plan.summary.validation_warning_count} validation warnings</Badge>
          <Badge tone={plan.summary.blocked_count ? "bad" : "good"}>{plan.summary.blocked_count} items</Badge>
          {workspace?.has_workspace && <Badge tone="info">setup draft saved</Badge>}
          <Button icon={<FolderOpen size={14} />} variant="secondary" disabled={candidateBusy} onClick={onEvaluateCandidate}>
            {candidateBusy ? "Evaluating..." : "Evaluate candidate files"}
          </Button>
          {candidate && (
            <Button icon={<Save size={14} />} variant="secondary" disabled={workspaceBusy} onClick={onSaveWorkspace}>
              {workspaceBusy ? "Saving..." : "Save draft"}
            </Button>
          )}
          {(candidate || workspace?.has_workspace) && (
            <Button icon={<X size={14} />} variant="quiet" disabled={workspaceBusy} onClick={onClearWorkspace}>
              Clear draft
            </Button>
          )}
          {candidate?.plan && (
            <Button
              icon={<RefreshCw size={14} />}
              variant="secondary"
              disabled={candidateHydrationBusy || !canHydrateCandidate}
              onClick={onHydrateCandidateMetadata}
            >
              {candidateHydrationBusy ? "Checking..." : "Check source metadata"}
            </Button>
          )}
          {candidateHydration && (
            <Button icon={<Save size={14} />} variant="secondary" disabled={candidateHydrationExportBusy} onClick={onExportHydratedModelRegistry}>
              Export checked model file
            </Button>
          )}
          {candidate && (
            <Button icon={<Save size={14} />} variant="secondary" disabled={candidateExportBusy} onClick={onExportCandidate}>
              Export candidate check
            </Button>
          )}
          {candidate && (
            <Button icon={<Search size={14} />} variant="secondary" disabled={candidateProbeBusy} onClick={onProbeCandidateArtifacts}>
              {candidateProbeBusy ? "Checking..." : "Check sources"}
            </Button>
          )}
          {candidateArtifactProbe && (
            <Button icon={<Save size={14} />} variant="secondary" disabled={candidateProbeExportBusy} onClick={onExportCandidateArtifactProbe}>
              Export source check
            </Button>
          )}
          {candidate && (
            <Button icon={<HardDrive size={14} />} variant="secondary" disabled={candidateVerificationBusy} onClick={onVerifyCandidateArtifacts}>
              {candidateVerificationBusy ? "Checking..." : "Verify files"}
            </Button>
          )}
          {candidateArtifactVerification && (
            <Button icon={<Save size={14} />} variant="secondary" disabled={candidateVerificationExportBusy} onClick={onExportCandidateArtifactVerification}>
              Export file check
            </Button>
          )}
          {candidateArtifactVerification && (
            <Button icon={<Save size={14} />} variant="secondary" disabled={candidateVerificationExportBusy} onClick={onExportCandidateArtifactEvidence}>
              Export file evidence
            </Button>
          )}
          {candidate && (
            <Button icon={<Import size={14} />} variant="secondary" disabled={candidateEvidenceBusy} onClick={onApplyCandidateEvidence}>
              Apply evidence
            </Button>
          )}
          {candidateEvidence && (
            <Button icon={<Archive size={14} />} variant="secondary" disabled={candidateReleasePacketBusy} onClick={onPrepareReleasePacket}>
              {candidateReleasePacketBusy ? "Preparing..." : "Prepare bundle"}
            </Button>
          )}
          {candidateEvidence && (
            <Button icon={<Shield size={14} />} variant="secondary" disabled={candidateReleasePacketBusy} onClick={onPrepareVerifiedReleasePacket}>
              Verified bundle
            </Button>
          )}
          {candidate && (
            <Button icon={<FilePlus2 size={14} />} variant="secondary" disabled={candidateTemplateBusy} onClick={onExportCandidateTemplate}>
              Export candidate approval template
            </Button>
          )}
          {candidate && (
            <Button icon={<FilePlus2 size={14} />} variant="secondary" disabled={candidateTemplateBusy} onClick={onExportCandidateEvidenceTemplate}>
              Export candidate evidence file
            </Button>
          )}
          <Button icon={<Save size={14} />} variant="secondary" disabled={exportBusy} onClick={onExport}>
            Export setup checklist
          </Button>
        </div>
      </div>
      {exportStatus && <small className="registry-release-plan-export-status">{exportStatus}</small>}
      {candidateStatus && <small className="registry-release-plan-export-status">{candidateStatus}</small>}
      {workspaceStatus && <small className="registry-release-plan-export-status">{workspaceStatus}</small>}
      <ReleasePromotionPipeline stages={promotionStages} />
      {candidateHydration && <CandidateMetadataHydrationSummary hydration={candidateHydration} />}
      {candidate && (
        <CandidateReleasePlanSummary
          candidate={candidate}
          candidateArtifactProbe={candidateArtifactProbe}
          candidateArtifactVerification={candidateArtifactVerification}
          candidateEvidence={candidateEvidence}
          candidateReleasePacket={candidateReleasePacket}
          patchedRegistryExportBusy={patchedRegistryExportBusy}
          evidenceMarkdownExportBusy={evidenceMarkdownExportBusy}
          onExportAppliedReleasePlan={onExportAppliedReleasePlan}
          onExportAppliedApprovalTemplate={onExportAppliedApprovalTemplate}
          onExportPinHandoff={onExportPinHandoff}
          onExportPatchedModelRegistry={onExportPatchedModelRegistry}
          onExportPatchedRuntimeRegistry={onExportPatchedRuntimeRegistry}
        />
      )}
      <div className="registry-release-plan-metrics">
        <article>
          <strong>
            {plan.summary.ready_production_pack_count}/{plan.summary.production_pack_count}
          </strong>
          <span>packs ready to trust</span>
        </article>
        <article>
          <strong>
            {plan.summary.ready_production_model_count}/{plan.summary.production_model_count}
          </strong>
          <span>models ready to trust</span>
        </article>
        <article>
          <strong>
            {plan.summary.ready_production_runtime_count}/{plan.summary.production_runtime_count}
          </strong>
          <span>runtimes ready to trust</span>
        </article>
        <article>
          <strong>{plan.summary.total_checks}</strong>
          <span>file checks</span>
        </article>
      </div>
      {visibleActions.length > 0 && (
        <div className="registry-release-plan-actions">
          <strong>Before trusting</strong>
          <div>
            {visibleActions.map((action) => (
              <span key={action}>{action}</span>
            ))}
          </div>
        </div>
      )}
      <div className="registry-release-artifacts">
        {topArtifacts.length > 0 ? (
          topArtifacts.map((artifact) => {
            const firstBlocked = artifact.readiness_checks.find((check) => check.status === "blocked");
            return (
              <article key={`${artifact.type}:${artifact.id}`}>
                <div>
                  <Badge tone={artifact.status === "blocked" ? "bad" : "warn"}>{setupStatusLabel(artifact.status)}</Badge>
                  <Badge tone="neutral">{releaseArtifactTypeLabel(artifact.type)}</Badge>
                  {artifact.runtime_name && <Badge tone="info">{artifact.runtime_name.replace("_", ".")}</Badge>}
                </div>
                <strong>{artifact.display_name}</strong>
                <span>
                  {artifact.blocked_count} items / {artifact.warning_count} warnings
                </span>
                {firstBlocked && <small>{localAIUserText(firstBlocked.detail)}</small>}
              </article>
            );
          })
        ) : (
          <small className="import-result">All model files are ready to trust.</small>
        )}
      </div>
    </section>
  );
}

type ReleasePromotionStage = AIRegistryPromotionStage;

function ReleasePromotionPipeline({ stages }: { stages: ReleasePromotionStage[] }) {
  return (
    <div className="release-promotion-pipeline" aria-label="Local AI setup path">
      <div className="release-promotion-header">
        <div>
          <strong>Setup path</strong>
          <span>{stages.filter((stage) => stage.status === "done").length}/{stages.length} stages clear</span>
        </div>
        <Badge tone={stages.some((stage) => stage.status === "blocked") ? "bad" : stages.every((stage) => stage.status === "done") ? "good" : "warn"}>
          {stages.some((stage) => stage.status === "blocked") ? "Needs action" : stages.every((stage) => stage.status === "done") ? "Clear" : "In progress"}
        </Badge>
      </div>
      <div className="release-promotion-stages">
        {stages.map((stage, index) => (
          <article key={stage.id} className={stage.status}>
            <div className="release-promotion-index">
              <span>{index + 1}</span>
            </div>
            <div>
              <Badge tone={releasePromotionTone(stage.status)}>{setupStatusLabel(stage.status)}</Badge>
              <strong>{stage.title}</strong>
              <small>{localAIUserText(stage.detail)}</small>
              <em>{localAIUserText(stage.action)}</em>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function releasePromotionStages(
  bundledPlan: AIRegistryReleasePlanReport,
  productionReadiness?: AIProductionReadinessReport,
  candidate?: AIRegistryReleasePlanExport | null,
  hydration?: AIRegistryMetadataHydrationExport | null,
  probe?: AIRegistryArtifactProbeExport | null,
  verification?: AIRegistryArtifactVerificationExport | null,
  evidence?: AIRegistryEvidenceOverlayExport | null
): ReleasePromotionStage[] {
  const candidatePlan = candidate?.plan;
  const activePlan = candidatePlan ?? bundledPlan;
  const baseStages = normalizePromotionStages(activePlan.promotion_stages);
  const stageById = new Map(baseStages.map((stage) => [stage.id, stage]));
  const candidateReady = Boolean(candidatePlan?.summary.ready_to_pin);
  const manifestStage = stageById.get("manifest-evidence");
  const hydrationStage = stageById.get("metadata-hydration");
  const manifestStatus: ReleasePromotionStage["status"] = manifestStage?.status ?? (candidateReady ? "done" : candidatePlan ? "blocked" : bundledPlan.summary.ready_to_pin ? "done" : "active");
  const manifestBlockers = activePlan.summary.blocked_count;
  const hydrationStatus: ReleasePromotionStage["status"] = hydration
    ? hydration.status === "hydrated"
      ? "done"
      : "blocked"
    : hydrationStage?.status ?? (candidateReady ? "done" : candidate ? "active" : "pending");

  const probeStatus: ReleasePromotionStage["status"] = !candidate
    ? "pending"
    : probe?.report.status === "pass"
      ? "done"
      : probe?.report.status === "blocked"
        ? "blocked"
        : probe
          ? "active"
          : "active";

  const verificationStatus: ReleasePromotionStage["status"] = !candidate
    ? "pending"
    : verification?.report.status === "pass" || verification?.report.status === "warn"
      ? "done"
      : verification?.report.status === "blocked"
        ? "blocked"
        : probe?.report.status === "pass"
          ? "active"
          : "pending";

  const evidenceStatus: ReleasePromotionStage["status"] = evidence?.status === "applied" ? "done" : candidate ? "active" : "pending";
  const handoffReady = Boolean((evidence?.pin_handoff as { ready_to_pin?: unknown } | undefined)?.ready_to_pin);
  const handoffStatus: ReleasePromotionStage["status"] = handoffReady ? "done" : evidence ? "blocked" : "pending";
  const finalPinStatus: ReleasePromotionStage["status"] = bundledPlan.summary.ready_to_pin ? "done" : handoffReady ? "active" : "pending";
  const readinessStatus: ReleasePromotionStage["status"] = productionReadiness?.production_ready
    ? "done"
    : productionReadiness?.status === "blocked"
      ? "blocked"
      : "pending";

  return [
    {
      id: "manifest-evidence",
      title: "File evidence",
      status: manifestStatus,
      detail: manifestStage?.detail ?? (manifestBlockers ? `${manifestBlockers} file items remain.` : "Candidate files are ready to trust."),
      action: manifestStage?.action ?? (candidatePlan ? "Keep candidate check clear." : "Evaluate candidate files.")
    },
    {
      id: "metadata-hydration",
      title: "Source metadata",
      status: hydrationStatus,
      detail: hydration
        ? `${hydration.summary.updated_field_count} metadata fields checked.`
        : hydrationStage?.detail ?? "Source revision, size, checksum, and license label metadata have not been checked.",
      action: hydrationStage?.action ?? "Check source metadata before reviewer evidence."
    },
    {
      id: "source-probe",
      title: "Source check",
      status: probeStatus,
      detail: probe ? `${probe.report.summary.pass_count}/${probe.report.summary.check_count} source checks passed.` : "Candidate sources have not been checked.",
      action: "Check source, size, checksum, and license evidence."
    },
    {
      id: "byte-verification",
      title: "File verification",
      status: verificationStatus,
      detail: verification
        ? `${verification.report.summary.verified_file_count}/${verification.report.summary.file_count} candidate files verified.`
        : "Candidate files have not been hashed into evidence.",
      action: "Verify candidate files before reviewer evidence."
    },
    {
      id: "evidence-overlay",
      title: "Evidence overlay",
      status: evidenceStatus,
      detail: evidence ? `${evidence.applied_count} evidence fields applied.` : "Reviewer evidence has not been applied.",
      action: "Apply reviewer evidence."
    },
    {
      id: "pin-handoff",
      title: "Review commands",
      status: handoffStatus,
      detail: handoffReady ? "Final review commands are ready." : "Prepared file handoff needs evidence.",
      action: "Export prepared files and review commands."
    },
    {
      id: "final-pin",
      title: "Final trust",
      status: finalPinStatus,
      detail: bundledPlan.summary.ready_to_pin ? "Bundled model files are ready to trust." : "Bundled model files still reflect production placeholders that need evidence.",
      action: "Run guarded approval command."
    },
    {
      id: "readiness-gate",
      title: "Readiness gate",
      status: readinessStatus,
      detail: productionReadiness
        ? `${productionReadiness.summary.blocked_count} production readiness blockers remain.`
        : "Production readiness has not been loaded.",
      action: "Run strict local-AI readiness gate."
    }
  ];
}

function normalizePromotionStages(stages?: AIRegistryPromotionStage[]): AIRegistryPromotionStage[] {
  return Array.isArray(stages) ? stages.filter((stage) => stage && typeof stage.id === "string") : [];
}

function releasePromotionTone(status: ReleasePromotionStage["status"]): "good" | "warn" | "bad" | "info" | "neutral" {
  if (status === "done") return "good";
  if (status === "active") return "info";
  if (status === "blocked") return "bad";
  return "neutral";
}

function CandidateMetadataHydrationSummary({ hydration }: { hydration: AIRegistryMetadataHydrationExport }) {
  const topWarning = hydration.errors[0] ?? hydration.warnings[0];
  const tone = hydration.status === "hydrated" ? (hydration.summary.warning_count ? "warn" : "good") : "bad";
  return (
    <div className="registry-metadata-hydration" aria-label="Candidate Hugging Face metadata hydration">
      <div className="registry-metadata-hydration-header">
        <div>
          <Badge tone={tone}>{setupStatusLabel(hydration.status)}</Badge>
          <strong>Source metadata</strong>
          <span>{hydration.model_registry_label ?? "Checked model file"}</span>
        </div>
        <code>{hydration.model_registry_sha256.slice(0, 12)}...</code>
      </div>
      <div className="registry-release-plan-metrics registry-release-candidate-metrics">
        <article>
          <strong>{hydration.summary.updated_field_count}</strong>
          <span>fields checked</span>
        </article>
        <article>
          <strong>{hydration.summary.warning_count}</strong>
          <span>warnings</span>
        </article>
        <article>
          <strong>{hydration.summary.error_count}</strong>
          <span>errors</span>
        </article>
      </div>
      {hydration.updates.length > 0 && (
        <div className="registry-metadata-updates">
          {hydration.updates.slice(0, 4).map((update) => (
            <article key={`${update.model_id}:${update.field}`}>
              <span>{update.model_id}</span>
              <code>{update.field}</code>
            </article>
          ))}
        </div>
      )}
      {topWarning ? <small>{topWarning}</small> : <small>Approval and license files still stay in the reviewer evidence gate.</small>}
    </div>
  );
}

function CandidateReleasePlanSummary({
  candidate,
  candidateArtifactProbe,
  candidateArtifactVerification,
  candidateEvidence,
  candidateReleasePacket,
  patchedRegistryExportBusy,
  evidenceMarkdownExportBusy,
  onExportAppliedReleasePlan,
  onExportAppliedApprovalTemplate,
  onExportPinHandoff,
  onExportPatchedModelRegistry,
  onExportPatchedRuntimeRegistry
}: {
  candidate: AIRegistryReleasePlanExport;
  candidateArtifactProbe?: AIRegistryArtifactProbeExport | null;
  candidateArtifactVerification?: AIRegistryArtifactVerificationExport | null;
  candidateEvidence?: AIRegistryEvidenceOverlayExport | null;
  candidateReleasePacket?: AIRegistryReleasePacket | null;
  patchedRegistryExportBusy: boolean;
  evidenceMarkdownExportBusy: boolean;
  onExportAppliedReleasePlan: () => void;
  onExportAppliedApprovalTemplate: () => void;
  onExportPinHandoff: () => void;
  onExportPatchedModelRegistry: () => void;
  onExportPatchedRuntimeRegistry: () => void;
}) {
  const plan = candidate.plan;
  const pinPreview = plan.pin_preview;
  const topArtifact = plan.artifacts
    .filter((artifact) => artifact.status !== "ready")
    .sort((a, b) => b.blocked_count - a.blocked_count || b.warning_count - a.warning_count)[0];
  const firstBlocked = topArtifact?.readiness_checks.find((check) => check.status === "blocked");
  const sourceLabels = [candidate.model_registry_label, candidate.runtime_registry_label].filter(Boolean).join(" + ");
  const handoffCommands = pinHandoffCommandEntries(candidateEvidence?.pin_handoff);
  const [copiedHandoffCommandId, setCopiedHandoffCommandId] = useState("");
  const [handoffCopyError, setHandoffCopyError] = useState("");
  async function copyHandoffCommand(command: { id: string; label: string; command: string }) {
    try {
      await copyTextToClipboard(command.command);
      setHandoffCopyError("");
      setCopiedHandoffCommandId(command.id);
      window.setTimeout(() => setCopiedHandoffCommandId((id) => (id === command.id ? "" : id)), 1600);
    } catch (error) {
      setHandoffCopyError(error instanceof Error ? error.message : "Could not copy this command.");
    }
  }
  return (
    <div className="registry-release-candidate" aria-label="Candidate model file check">
      <div className="registry-release-candidate-title">
        <div>
          <Badge tone={plan.summary.ready_to_pin ? "good" : "bad"}>{plan.summary.ready_to_pin ? "Ready to trust" : "Needs evidence"}</Badge>
          <strong>Candidate check</strong>
          <span>{sourceLabels || "Selected candidate files"}</span>
        </div>
        <Badge tone={registryValidationTone(plan.validation)}>{setupStatusLabel(plan.validation.status)}</Badge>
      </div>
      <div className="registry-release-plan-metrics registry-release-candidate-metrics">
        <article>
          <strong>
            {plan.summary.ready_production_pack_count}/{plan.summary.production_pack_count}
          </strong>
          <span>packs ready</span>
        </article>
        <article>
          <strong>
            {plan.summary.ready_production_model_count}/{plan.summary.production_model_count}
          </strong>
          <span>models ready</span>
        </article>
        <article>
          <strong>
            {plan.summary.ready_production_runtime_count}/{plan.summary.production_runtime_count}
          </strong>
          <span>runtimes ready</span>
        </article>
        <article>
          <strong>{plan.summary.blocked_count}</strong>
          <span>items</span>
        </article>
      </div>
      {pinPreview && (
        <div className="registry-pin-preview" aria-label="Candidate registry pin impact">
          <div className="registry-pin-preview-header">
            <strong>File changes</strong>
            <span>
              {pinPreview.total_added} added / {pinPreview.total_changed} changed / {pinPreview.total_removed} removed
            </span>
          </div>
          <div className="registry-pin-preview-list">
            {pinPreview.registries.map((registry) => (
              <article key={registry.registry}>
                <div>
                  <Badge tone={registry.changed ? "warn" : "good"}>{registry.changed ? "will change" : "unchanged"}</Badge>
                  <strong>{registryPreviewLabel(registry.registry)}</strong>
                </div>
                <code>{registry.candidate_sha256.slice(0, 12)}...</code>
                <span>
                  +{registry.total_added} / changed {registry.total_changed} / -{registry.total_removed}
                </span>
              </article>
            ))}
          </div>
        </div>
      )}
      {topArtifact ? (
        <small>
          Top item: {topArtifact.display_name}
          {firstBlocked ? ` - ${localAIUserText(firstBlocked.detail)}` : ""}
        </small>
      ) : (
        <small>All candidate production artifacts are ready to trust.</small>
      )}
      {candidateArtifactProbe && <CandidateArtifactProbeSummary probe={candidateArtifactProbe} />}
      {candidateArtifactVerification && <CandidateArtifactVerificationSummary verification={candidateArtifactVerification} />}
      {candidateEvidence && (
        <div className="registry-patched-exports" aria-label="Prepared candidate model files">
          <div>
            <Badge tone={candidateEvidence.status === "applied" ? "good" : "bad"}>{setupStatusLabel(candidateEvidence.status)}</Badge>
            <strong>Prepared model files</strong>
            <span>Save these JSON files for the final setup check and approval step.</span>
            {candidateEvidence.evidence_label && <small>Evidence: {candidateEvidence.evidence_label}</small>}
            <code>model {candidateEvidence.patched_model_registry_sha256.slice(0, 12)}...</code>
            <code>runtime {candidateEvidence.patched_runtime_registry_sha256.slice(0, 12)}...</code>
          </div>
          {handoffCommands.length > 0 && (
            <div className="registry-pin-handoff" aria-label="Candidate review commands">
              {handoffCommands.map((command) => (
                <article key={command.id}>
                  <div>
                    <span>{command.label}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="quiet"
                      icon={copiedHandoffCommandId === command.id ? <Check size={13} /> : <Copy size={13} />}
                      aria-label={`${copiedHandoffCommandId === command.id ? "Copied" : "Copy"} ${command.label} command`}
                      title={`${copiedHandoffCommandId === command.id ? "Copied" : "Copy"} ${command.label} command`}
                      onClick={() => void copyHandoffCommand(command)}
                    />
                  </div>
                  <code>{command.command}</code>
                </article>
              ))}
              {handoffCopyError && <small className="model-test-error">{handoffCopyError}</small>}
            </div>
          )}
          <div>
            <Button icon={<Save size={14} />} variant="secondary" disabled={evidenceMarkdownExportBusy} onClick={onExportAppliedReleasePlan}>
              Export applied plan
            </Button>
            <Button icon={<Save size={14} />} variant="secondary" disabled={evidenceMarkdownExportBusy} onClick={onExportAppliedApprovalTemplate}>
              Export applied checklist
            </Button>
            <Button icon={<Save size={14} />} variant="secondary" disabled={evidenceMarkdownExportBusy} onClick={onExportPinHandoff}>
              Export review commands
            </Button>
            <Button icon={<Save size={14} />} variant="secondary" disabled={patchedRegistryExportBusy} onClick={onExportPatchedModelRegistry}>
              Export model file
            </Button>
            <Button icon={<Save size={14} />} variant="secondary" disabled={patchedRegistryExportBusy} onClick={onExportPatchedRuntimeRegistry}>
              Export runtime file
            </Button>
          </div>
        </div>
      )}
      {candidateReleasePacket && <CandidateReleasePacketSummary packet={candidateReleasePacket} />}
    </div>
  );
}

function CandidateReleasePacketSummary({ packet }: { packet: AIRegistryReleasePacket }) {
  const probeStatus = String(packet.artifact_probe?.status ?? "not_run");
  const verificationStatus = String(packet.artifact_verification?.status ?? "not_run");
  const topAction = packet.next_actions[0];
  return (
    <div className="registry-release-packet" aria-label="Candidate setup bundle">
      <div className="registry-release-packet-header">
        <div>
          <Badge tone={packet.ready_to_pin ? "good" : "bad"}>{packet.ready_to_pin ? "Ready to trust" : setupStatusLabel(packet.status)}</Badge>
          <strong>Setup bundle</strong>
          <span>{packet.output_dir}</span>
        </div>
        <div>
          <Badge tone={probeStatus === "pass" || probeStatus === "not_run" ? "neutral" : "bad"}>sources {setupStatusLabel(probeStatus)}</Badge>
          <Badge tone={verificationStatus === "pass" || verificationStatus === "not_run" ? "neutral" : "bad"}>files {setupStatusLabel(verificationStatus)}</Badge>
        </div>
      </div>
      <div className="registry-release-plan-metrics registry-release-candidate-metrics">
        <article>
          <strong>{packet.artifacts.length}</strong>
          <span>files</span>
        </article>
        <article>
          <strong>{packet.applied_count}</strong>
          <span>evidence fields</span>
        </article>
        <article>
          <strong>{packet.errors.length}</strong>
          <span>errors</span>
        </article>
        <article>
          <strong>{packet.warnings.length}</strong>
          <span>warnings</span>
        </article>
      </div>
      <div className="registry-release-packet-artifacts">
        {packet.artifacts.slice(0, 6).map((artifact) => (
          <article key={`${artifact.type}:${artifact.filename}`}>
            <Badge tone="neutral">{artifact.type.replace(/_/g, " ")}</Badge>
            <span>{artifact.filename}</span>
            <small>{formatBytes(artifact.bytes)}</small>
          </article>
        ))}
      </div>
      {topAction ? <small>{localAIUserText(topAction)}</small> : <small>Setup bundle files are ready for final review.</small>}
    </div>
  );
}

function CandidateArtifactProbeSummary({ probe }: { probe: AIRegistryArtifactProbeExport }) {
  const summary = probe.report.summary;
  const topArtifact = probe.report.artifacts.find((artifact) => artifact.status !== "pass");
  const topCheck = topArtifact?.checks.find((check) => check.status !== "pass");
  const tone = probe.report.status === "pass" ? "good" : probe.report.status === "blocked" ? "bad" : "warn";
  return (
    <div className="registry-artifact-probe" aria-label="Candidate artifact source probe">
      <div className="registry-artifact-probe-header">
        <div>
          <Badge tone={tone}>{setupStatusLabel(probe.report.status)}</Badge>
          <strong>Source check</strong>
          <span>
            {summary.pass_count}/{summary.check_count} checks passed
          </span>
        </div>
        <div>
          <Badge tone={summary.blocked_count ? "bad" : "good"}>{summary.blocked_count} items</Badge>
          <Badge tone={summary.warn_count ? "warn" : "good"}>{summary.warn_count} warnings</Badge>
          <Badge tone={summary.pending_count ? "warn" : "good"}>{summary.pending_count} pending</Badge>
        </div>
      </div>
      {topArtifact && topCheck ? (
        <small>
          Source issue: {topArtifact.display_name} - {topCheck.detail}
        </small>
      ) : (
        <small>Candidate source and license URLs are reachable.</small>
      )}
    </div>
  );
}

function CandidateArtifactVerificationSummary({ verification }: { verification: AIRegistryArtifactVerificationExport }) {
  const summary = verification.report.summary;
  const topArtifact = verification.report.artifacts.find((artifact) => artifact.status !== "pass");
  const topFile = topArtifact?.files.find((file) => file.status !== "pass");
  const topCheck = topFile?.checks.find((check) => check.status !== "pass");
  const tone = verification.report.status === "pass" ? "good" : verification.report.status === "blocked" ? "bad" : "warn";
  return (
    <div className="registry-artifact-probe registry-artifact-verification" aria-label="Candidate artifact byte verification">
      <div className="registry-artifact-probe-header">
        <div>
          <Badge tone={tone}>{setupStatusLabel(verification.report.status)}</Badge>
          <strong>File verification</strong>
          <span>
            {summary.verified_file_count}/{summary.file_count} files verified
          </span>
        </div>
        <div>
          <Badge tone={summary.blocked_count ? "bad" : "good"}>{summary.blocked_count} items</Badge>
          <Badge tone={summary.evidence_model_count + summary.evidence_runtime_count ? "good" : "warn"}>
            {summary.evidence_model_count + summary.evidence_runtime_count} evidence
          </Badge>
        </div>
      </div>
      {topArtifact && topCheck ? (
        <small>
          File issue: {topArtifact.display_name} - {topCheck.detail}
        </small>
      ) : (
        <small>Candidate files are hashed into size and checksum evidence.</small>
      )}
    </div>
  );
}

function pinHandoffCommandEntries(handoff?: Record<string, unknown> | null) {
  const commands = handoff?.commands;
  if (!commands || typeof commands !== "object") return [];
  const commandMap = commands as Record<string, unknown>;
  return [
    ["artifact_probe", "Check sources"],
    ["artifact_verification", "Verify files"],
    ["release_packet", "Setup bundle"],
    ["acceptance_report", "Acceptance report"],
    ["pin_check", "Dry-run approval"],
    ["pin", "Trust model files"],
    ["readiness", "Readiness gate"]
  ]
    .map(([id, label]) => {
      const command = commandMap[id];
      return typeof command === "string" && command ? { id, label, command } : null;
    })
    .filter((entry): entry is { id: string; label: string; command: string } => Boolean(entry));
}

async function copyTextToClipboard(text: string) {
  if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable.");
  await navigator.clipboard.writeText(text);
}

function releaseArtifactTypeLabel(type: AIRegistryReleasePlanReport["artifacts"][number]["type"]) {
  if (type === "model_pack") return "pack";
  if (type === "runtime") return "runtime";
  return "model";
}

function registryPreviewLabel(type: string) {
  if (type === "model_registry") return "model file";
  if (type === "runtime_registry") return "runtime file";
  return type.replace("_", " ");
}

async function parseCandidateRegistryFiles(files: SelectedRegistryFile[]): Promise<AIRegistryReleasePlanEvaluateInput> {
  let modelRegistry: Record<string, unknown> | undefined;
  let runtimeRegistry: Record<string, unknown> | undefined;
  let modelRegistryLabel: string | undefined;
  let runtimeRegistryLabel: string | undefined;
  let modelRegistrySha256: string | undefined;
  let runtimeRegistrySha256: string | undefined;

  for (const file of files) {
    const label = file.filename || file.filePath || "candidate registry";
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.contents);
    } catch {
      throw new Error(`${label} is not valid JSON.`);
    }
    if (!isRegistryObject(parsed)) throw new Error(`${label} must contain a JSON object.`);

    const embeddedModelRegistry = isRegistryObject(parsed.model_registry) ? parsed.model_registry : undefined;
    const embeddedRuntimeRegistry = isRegistryObject(parsed.runtime_registry) ? parsed.runtime_registry : undefined;
    const modelCandidate = embeddedModelRegistry ?? parsed;
    const runtimeCandidate = embeddedRuntimeRegistry ?? parsed;
    const looksLikeModelRegistry = hasRegistryArray(modelCandidate, "models") || hasRegistryArray(modelCandidate, "model_packs");
    const looksLikeRuntimeRegistry = hasRegistryArray(runtimeCandidate, "runtimes");
    const fileSha256 = await sha256Hex(file.contents);

    if (looksLikeModelRegistry) {
      if (modelRegistry) throw new Error("Select only one candidate model file.");
      modelRegistry = modelCandidate;
      modelRegistryLabel = embeddedModelRegistry ? `${label}:model_registry` : label;
      modelRegistrySha256 = embeddedModelRegistry ? await sha256Hex(JSON.stringify(embeddedModelRegistry)) : fileSha256;
    }
    if (looksLikeRuntimeRegistry) {
      if (runtimeRegistry) throw new Error("Select only one candidate runtime file.");
      runtimeRegistry = runtimeCandidate;
      runtimeRegistryLabel = embeddedRuntimeRegistry ? `${label}:runtime_registry` : label;
      runtimeRegistrySha256 = embeddedRuntimeRegistry ? await sha256Hex(JSON.stringify(embeddedRuntimeRegistry)) : fileSha256;
    }
    if (!looksLikeModelRegistry && !looksLikeRuntimeRegistry) {
      throw new Error(`${label} is not an AI model or runtime file.`);
    }
  }

  if (!modelRegistry && !runtimeRegistry) throw new Error("Select at least one candidate model or runtime file.");
  return {
    model_registry: modelRegistry,
    runtime_registry: runtimeRegistry,
    model_registry_label: modelRegistryLabel,
    runtime_registry_label: runtimeRegistryLabel,
    model_registry_sha256: modelRegistrySha256,
    runtime_registry_sha256: runtimeRegistrySha256
  };
}

type EvidenceSectionName = "models" | "runtimes";
type EvidencePatchMap = Record<string, Record<string, unknown>>;

function parseEvidenceOverlayFiles(files: SelectedRegistryFile[]): Pick<AIRegistryEvidenceOverlayInput, "evidence" | "evidence_label"> | null {
  if (!files.length) return null;
  const evidence: Record<string, unknown> = { schema_version: 1, models: {}, runtimes: {} };
  const labels: string[] = [];
  let entryCount = 0;

  for (const file of files) {
    const label = file.filename || file.filePath || "candidate evidence";
    labels.push(label);
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.contents);
    } catch {
      throw new Error(`${label} is not valid JSON.`);
    }
    if (!isRegistryObject(parsed)) throw new Error(`${label} must contain a JSON object.`);
    if (looksLikeCandidateRegistryJson(parsed)) {
      throw new Error(`${label} is a registry JSON file. Select evidence JSON exports with top-level models or runtimes evidence instead.`);
    }
    if (looksLikeAppliedEvidenceBundle(parsed)) {
      throw new Error(`${label} is an applied evidence bundle. Select the original byte or reviewer evidence JSON exports instead.`);
    }

    const modelEvidence = normalizeEvidenceSection(parsed.models, "models", label);
    const runtimeEvidence = normalizeEvidenceSection(parsed.runtimes, "runtimes", label);
    entryCount += Object.keys(modelEvidence).length + Object.keys(runtimeEvidence).length;
    mergeEvidenceSection(evidence.models as EvidencePatchMap, modelEvidence);
    mergeEvidenceSection(evidence.runtimes as EvidencePatchMap, runtimeEvidence);
  }

  if (entryCount === 0) {
    throw new Error("Selected JSON did not contain model or runtime evidence entries. Choose byte evidence or a filled reviewer evidence JSON export.");
  }
  return { evidence, evidence_label: formatEvidenceOverlayLabel(labels) };
}

function normalizeEvidenceSection(value: unknown, section: EvidenceSectionName, label: string): EvidencePatchMap {
  if (value == null) return {};
  const normalized: EvidencePatchMap = {};
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      if (!isRegistryObject(entry) || !entry.id) {
        throw new Error(`${label} ${section}[${index}] must be an object with an id.`);
      }
      const id = String(entry.id).trim();
      if (!id) throw new Error(`${label} ${section}[${index}] must include a non-empty id.`);
      const { id: _id, ...patch } = entry;
      normalized[id] = patch;
    });
    return normalized;
  }
  if (!isRegistryObject(value)) {
    throw new Error(`${label} ${section} must be an object keyed by id or a list of id-bearing objects.`);
  }
  Object.entries(value).forEach(([id, patch]) => {
    const trimmedId = id.trim();
    if (!trimmedId) throw new Error(`${label} ${section} contains an empty id.`);
    if (!isRegistryObject(patch)) throw new Error(`${label} ${section}.${id} evidence must be an object.`);
    normalized[trimmedId] = patch;
  });
  return normalized;
}

function mergeEvidenceSection(target: EvidencePatchMap, next: EvidencePatchMap) {
  Object.entries(next).forEach(([id, patch]) => {
    target[id] = mergeEvidencePatch(target[id] ?? {}, patch);
  });
}

function mergeEvidencePatch(current: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current, ...next };
  for (const key of ["source", "defaults", "approval"]) {
    if (isRegistryObject(current[key]) && isRegistryObject(next[key])) {
      merged[key] = { ...(current[key] as Record<string, unknown>), ...(next[key] as Record<string, unknown>) };
    }
  }
  if (Array.isArray(current.files) && Array.isArray(next.files)) {
    const currentFirst = current.files[0];
    const nextFirst = next.files[0];
    if (isRegistryObject(currentFirst) && isRegistryObject(nextFirst)) {
      merged.files = [{ ...currentFirst, ...nextFirst }, ...next.files.slice(1)];
    }
  }
  return merged;
}

function looksLikeCandidateRegistryJson(value: Record<string, unknown>): boolean {
  return hasRegistryArray(value, "model_packs") || sectionArrayLooksLikeRegistry(value.models, "models") || sectionArrayLooksLikeRegistry(value.runtimes, "runtimes");
}

function sectionArrayLooksLikeRegistry(value: unknown, section: EvidenceSectionName): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((entry) => {
    if (!isRegistryObject(entry)) return false;
    if (section === "models") {
      return Boolean(entry.display_name || entry.kind || entry.runtime_id || entry.context_window || entry.capabilities);
    }
    return Boolean(entry.display_name || entry.runtime_name || entry.binary || entry.install || entry.platforms);
  });
}

function looksLikeAppliedEvidenceBundle(value: Record<string, unknown>): boolean {
  return Boolean(value.model_registry || value.runtime_registry || value.bundle_json || value.applied_fields);
}

function formatEvidenceOverlayLabel(labels: string[]): string {
  if (labels.length === 1) return labels[0] ?? "candidate evidence";
  const visibleLabels = labels.slice(0, 3).join(", ");
  const suffix = labels.length > 3 ? `, +${labels.length - 3} more` : "";
  return `${labels.length} evidence files: ${visibleLabels}${suffix}`;
}

function isRegistryObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasRegistryArray(value: Record<string, unknown>, key: string) {
  return Array.isArray(value[key]);
}

async function sha256Hex(contents: string): Promise<string | undefined> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return undefined;
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(contents));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const setupStepOrder: AISetupStepInfo["id"][] = ["privacy", "hardware", "runtime", "production_pack", "demo_fallback", "capability_routes"];

function AISetupWizard({
  open,
  setup,
  hardware,
  productionPack,
  demoPack,
  runtimes,
  capabilities,
  busy,
  setupResult,
  setupError,
  onClose,
  onStepAction,
  onRunDemo,
  onRunRecommended,
  onInstallRuntime,
  onDownloadPack
}: {
  open: boolean;
  setup?: AISetupStatus;
  hardware?: HardwareProfile;
  productionPack?: AIModelPackInfo;
  demoPack?: AIModelPackInfo;
  runtimes: AIRuntimeInfo[];
  capabilities: CapabilityBinding[];
  busy: boolean;
  setupResult?: AISetupRunResult;
  setupError?: Error | null;
  onClose: () => void;
  onStepAction: (step: AISetupStepInfo) => void;
  onRunDemo: () => void;
  onRunRecommended: () => void;
  onInstallRuntime: (runtimeId: string) => void;
  onDownloadPack: (packId: string) => void;
}) {
  const [activeStepId, setActiveStepId] = useState<AISetupStepInfo["id"]>("privacy");

  useEffect(() => {
    if (!open || !setup?.steps.length) return;
    const firstActionable = setup.steps.find((step) => step.status === "blocked") ?? setup.steps.find((step) => step.status === "ready") ?? setup.steps[0];
    setActiveStepId(firstActionable.id);
  }, [open, setup?.overall_status, setup?.steps]);

  if (!open || !setup) return null;

  const setupState = setup;
  const orderedSteps = setupStepOrder.map((id) => setupState.steps.find((step) => step.id === id)).filter(Boolean) as AISetupStepInfo[];
  if (orderedSteps.length === 0) return null;
  const activeStep = orderedSteps.find((step) => step.id === activeStepId) ?? orderedSteps[0];
  const activeIndex = Math.max(0, orderedSteps.findIndex((step) => step.id === activeStep.id));
  const targetCapabilities = productionPack?.capabilities.length ? productionPack.capabilities : demoPack?.capabilities ?? [];
  const routedCapabilities = capabilities.filter((binding) => targetCapabilities.includes(binding.capability));
  const cloudRouteCount = capabilities.filter((binding) => !binding.local_only).length;
  const productionReady = Boolean(productionPack?.installable || productionPack?.installed);
  const recommendedSetupLabel = productionReady ? "Use recommended setup" : "Review setup";

  function go(delta: number) {
    const next = orderedSteps[Math.max(0, Math.min(orderedSteps.length - 1, activeIndex + delta))];
    if (next) setActiveStepId(next.id);
  }

  function renderActiveStep() {
    if (activeStep.id === "privacy") {
      return (
        <div className="setup-wizard-panel">
          <div className="setup-wizard-copy">
            <Badge tone={cloudRouteCount ? "warn" : "good"}>{setupState.privacy_label}</Badge>
            <h3>Keep inference local by default</h3>
            <p>Model downloads may use approved sources, but prompts and source content stay on-device unless a cloud route is explicitly enabled later.</p>
          </div>
          <div className="setup-wizard-stats">
            <article>
              <strong>{capabilities.length}</strong>
              <span>model routes</span>
            </article>
            <article>
              <strong>{cloudRouteCount}</strong>
              <span>cloud-enabled model routes</span>
            </article>
            <article>
              <strong>{setupState.blocked_reasons.length}</strong>
              <span>items to finish</span>
            </article>
          </div>
        </div>
      );
    }
    if (activeStep.id === "hardware") {
      return (
        <div className="setup-wizard-panel">
          <div className="setup-wizard-copy">
            <Badge tone="info">{hardware?.recommended_profile ?? setupState.recommended_profile} profile</Badge>
            <h3>Choose the smallest useful local pack</h3>
            <p>Hardware detection decides the default pack, context size, and safe runtime posture. Detection is best-effort and never blocks app startup.</p>
          </div>
          <div className="setup-wizard-stats">
            <article>
              <strong>{hardware?.os ?? "unknown"}</strong>
              <span>{hardware?.arch ?? "unknown"} architecture</span>
            </article>
            <article>
              <strong>{hardware?.physical_ram_gb ?? "?"} GB</strong>
              <span>physical RAM</span>
            </article>
            <article>
              <strong>{hardware?.metal_available || hardware?.cuda_available || hardware?.rocm_available || hardware?.vulkan_available ? "yes" : "no"}</strong>
              <span>accelerator detected</span>
            </article>
          </div>
          {hardware?.warnings.length ? (
            <ul className="setup-wizard-list">
              {hardware.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }
    if (activeStep.id === "runtime") {
      return (
        <div className="setup-wizard-panel">
          <div className="setup-wizard-copy">
            <Badge tone={setupStatusTone(activeStep.status)} title={activeStep.status}>
              {setupStatusLabel(activeStep.status)}
            </Badge>
            <h3>Install verified local runtimes</h3>
            <p>{activeStep.detail ?? "The app can manage local binaries under Vault app data and verify them before use."}</p>
          </div>
          <div className="setup-wizard-runtime-list">
            {runtimes.slice(0, 4).map((runtimeItem) => (
              <article key={runtimeItem.id}>
                <div className="setup-wizard-runtime-title">
                  <div>
                    <Badge tone={runtimeStateTone(runtimeItem)} title={runtimeItem.install_state}>
                      {runtimeInstallStateLabel(runtimeItem)}
                    </Badge>
                    <Badge tone={runtimeItem.release_channel === "demo" ? "info" : "neutral"} title={runtimeItem.release_channel}>
                      {releaseChannelLabel(runtimeItem.release_channel)}
                    </Badge>
                    <Badge tone={runtimeItem.compatible === false ? "warn" : "good"}>{runtimeCompatibilityLabel(runtimeItem)}</Badge>
                  </div>
                  <strong>{runtimeItem.display_name}</strong>
                </div>
                <span title={runtimeItem.binary_name}>Runtime binary</span>
                <span title={runtimeCompatibilityTitle(runtimeItem)}>{runtimeCompatibilityDisplay(runtimeItem)}</span>
                <small>{localAIUserText(runtimeItem.blocked_reasons[0] ?? runtimeItem.readiness_checks[0]?.detail ?? "Runtime is ready for local setup checks.")}</small>
                <Button
                  icon={<Download size={14} />}
                  variant={runtimeItem.installable && !runtimeItem.installed ? "primary" : "quiet"}
                  disabled={!runtimeItem.installable || runtimeItem.installed || busy}
                  onClick={() => onInstallRuntime(runtimeItem.id)}
                >
                  {runtimeInstallLabel(runtimeItem)}
                </Button>
              </article>
            ))}
          </div>
        </div>
      );
    }
    if (activeStep.id === "production_pack") {
      return (
        <div className="setup-wizard-panel">
          <div className="setup-wizard-copy">
            <Badge tone={productionPack ? packStatusTone(productionPack.release_status) : "warn"} title={productionPack?.release_status}>
              {productionPack ? packStatusLabel(productionPack.release_status) : "Missing"}
            </Badge>
            <h3>{productionPack?.display_name ?? "Production pack missing"}</h3>
            <p>{productionPack?.description ?? "A production Tiny, Standard, or Strong local pack must be registered before first-run local AI can be fully self-serve."}</p>
          </div>
          {productionPack && (
            <>
              <div className="setup-wizard-stats">
                <article>
                  <strong>{productionPack.installed_model_ids.length}/{productionPack.required_model_ids.length}</strong>
                  <span>models ready</span>
                </article>
                <article>
                  <strong>{formatBytes(productionPack.disk_bytes)}</strong>
                  <span>storage</span>
                </article>
                <article>
                  <strong>{productionPack.downloadable_model_ids.length}</strong>
                  <span>downloads ready</span>
                </article>
              </div>
              <ReadinessChecklist checks={productionPack.readiness_checks} limit={8} />
              <div className="setup-wizard-actions">
                <Button icon={<Download size={14} />} variant="primary" disabled={!productionPack.installable || busy} onClick={() => onDownloadPack(productionPack.id)}>
                  Download and test
                </Button>
                <Button icon={<Sparkles size={14} />} variant={productionReady ? "primary" : "quiet"} disabled={!productionPack || busy} onClick={onRunRecommended}>
                  {recommendedSetupLabel}
                </Button>
              </div>
            </>
          )}
        </div>
      );
    }
    if (activeStep.id === "demo_fallback") {
      return (
        <div className="setup-wizard-panel">
          <div className="setup-wizard-copy">
            <Badge tone={demoPack ? packStatusTone(demoPack.release_status) : "warn"} title={demoPack?.release_status}>
              {demoPack ? packStatusLabel(demoPack.release_status) : "Missing"}
            </Badge>
            <h3>{demoPack?.display_name ?? "Starter setup missing"}</h3>
            <p>{demoPack?.description ? localAIUserText(demoPack.description) : "The starter setup keeps local AI testable while approved model packs are being prepared."}</p>
          </div>
          {demoPack && (
            <>
              <div className="setup-wizard-stats">
                <article>
                  <strong>{demoPack.installed_model_ids.length}/{demoPack.required_model_ids.length}</strong>
                  <span>models ready</span>
                </article>
                <article>
                  <strong>{demoPack.downloadable_model_ids.length}</strong>
                  <span>downloads ready</span>
                </article>
                <article>
                  <strong>{demoPack.capabilities.length}</strong>
                  <span>tasks covered</span>
                </article>
              </div>
              <div className="setup-wizard-actions">
                <Button icon={<Beaker size={14} />} variant="primary" disabled={busy} onClick={onRunDemo}>
                  Use starter setup
                </Button>
                <Button icon={<Download size={14} />} variant="quiet" disabled={!demoPack.installable || demoPack.installed || busy} onClick={() => onDownloadPack(demoPack.id)}>
                  Download starter
                </Button>
              </div>
            </>
          )}
        </div>
      );
    }
    return (
      <div className="setup-wizard-panel">
        <div className="setup-wizard-copy">
          <Badge tone={setupStatusTone(activeStep.status)} title={activeStep.status}>
            {setupStatusLabel(activeStep.status)}
          </Badge>
          <h3>Preview route activation</h3>
          <p>The setup runner only activates routes when providers and models are installed, local-only, and safe for the selected capability.</p>
        </div>
        <div className="setup-wizard-routes">
          {routedCapabilities.length === 0 && <p>No target pack routes are active yet.</p>}
          {routedCapabilities.map((binding) => (
            <article key={binding.capability}>
              <Badge tone={capabilityRouteTone(binding)} title={binding.provider_id}>
                {capabilityRouteLabel(binding)}
              </Badge>
              <strong title={binding.capability}>{capabilityDisplayLabel(binding.capability)}</strong>
              <span title={binding.provider_id}>{binding.local_only ? "On this device" : "Leaves this device"}</span>
              <small title={binding.model_id ?? undefined}>{binding.model_id ? "Model selected" : "No model selected"}</small>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="setup-wizard-backdrop">
      <section className="setup-wizard" role="dialog" aria-modal="true" aria-label="Model setup">
        <div className="setup-wizard-titlebar">
          <div>
            <Badge tone={setupStatusTone(setupState.overall_status)} title={setupState.overall_status}>
              {setupStatusLabel(setupState.overall_status)}
            </Badge>
            <h2>Model setup</h2>
            <p>{localAIUserText(setupState.next_action)}</p>
          </div>
          <Button icon={<X size={16} />} variant="quiet" aria-label="Close setup" onClick={onClose} />
        </div>
        <div className="setup-wizard-body">
          <nav className="setup-wizard-rail" aria-label="Setup steps">
            {orderedSteps.map((step, index) => (
              <button key={step.id} className={step.id === activeStep.id ? "active" : ""} onClick={() => setActiveStepId(step.id)}>
                <Badge tone={setupStatusTone(step.status)}>{index + 1}</Badge>
                <span>{localAIUserText(step.title)}</span>
                <small>{localAIUserText(step.summary)}</small>
              </button>
            ))}
          </nav>
          <div className="setup-wizard-main">
            <div className="setup-wizard-step-header">
              <div>
                <Badge tone={setupStatusTone(activeStep.status)} title={activeStep.status}>
                  {setupStatusLabel(activeStep.status)}
                </Badge>
                <h3>{localAIUserText(activeStep.title)}</h3>
                <p>{localAIUserText(activeStep.summary)}</p>
              </div>
              {activeStep.action_label && (
                <Button icon={setupActionIcon(activeStep)} variant={activeStep.status === "ready" ? "primary" : "quiet"} disabled={busy} onClick={() => onStepAction(activeStep)}>
                  {localAIUserText(activeStep.action_label)}
                </Button>
              )}
            </div>
            {renderActiveStep()}
            {setupResult && <AISetupRunReport result={setupResult} />}
            {setupError && <small className="import-result import-error">{setupError.message}</small>}
          </div>
        </div>
        <div className="setup-wizard-footer">
          <Button icon={<Play size={14} />} variant="quiet" disabled={activeIndex === 0} onClick={() => go(-1)}>
            Back
          </Button>
          <div>
            {setupState.can_use_demo && (
              <Button icon={<Beaker size={14} />} variant="secondary" disabled={busy} onClick={onRunDemo}>
                Use starter setup
              </Button>
            )}
            <Button icon={<Sparkles size={14} />} variant={productionReady ? "primary" : "quiet"} disabled={!productionPack || busy} onClick={onRunRecommended}>
              {recommendedSetupLabel}
            </Button>
            <Button icon={<Play size={14} />} variant="quiet" disabled={activeIndex >= orderedSteps.length - 1} onClick={() => go(1)}>
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AISetupRunReport({ result }: { result?: AISetupRunResult }) {
  if (!result) return null;
  return (
    <section className="setup-run-report" aria-label="Setup result">
      <div className="setup-run-header">
        <div>
          <Badge tone={setupRunTone(result.status)} title={result.status}>
            {setupStatusLabel(result.status)}
          </Badge>
          <h3>Setup result</h3>
          <p title={[result.pack_id, result.release_channel].filter(Boolean).join(" / ")}>{setupRunPackLabel(result)}</p>
        </div>
        <div>
          <Badge tone="good">{result.selected_capabilities.length} routes activated</Badge>
          <span>{result.downloads.length} downloads checked</span>
        </div>
      </div>
      <div className="setup-run-steps">
        {result.steps.map((step) => (
          <article key={step.id}>
            <Badge tone={setupRunTone(step.status)} title={step.status}>
              {setupStatusLabel(step.status)}
            </Badge>
            <div>
              <strong>{localAIUserText(step.title)}</strong>
              {step.detail && <small>{localAIUserText(step.detail)}</small>}
              {step.capability && <small title={step.capability}>{capabilityDisplayLabel(step.capability)}</small>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReadinessChecklist({ checks, limit = 6 }: { checks?: AIReadinessCheck[]; limit?: number }) {
  const visible = (checks ?? []).slice(0, limit);
  if (visible.length === 0) return null;
  return (
    <div className="readiness-checklist">
      {visible.map((check) => (
        <article key={check.id}>
          <Badge tone={readinessTone(check.status)} title={check.status}>
            {setupStatusLabel(check.status)}
          </Badge>
          <div>
            <strong>{localAIUserText(check.label)}</strong>
            <small>{localAIUserText(check.detail)}</small>
            {check.action && <small>{localAIUserText(check.action)}</small>}
          </div>
        </article>
      ))}
    </div>
  );
}

function PackRouteCoverage({ pack, capabilities }: { pack: AIModelPackInfo; capabilities: CapabilityBinding[] }) {
  const bindingsByCapability = new Map(capabilities.map((binding) => [binding.capability, binding]));
  const coveredCount = pack.capabilities.filter((capability) => {
    const binding = bindingsByCapability.get(capability);
    return binding && binding.local_only && !binding.provider_id.startsWith("mock_");
  }).length;
  return (
    <div className="pack-route-coverage" aria-label={`${pack.display_name} route coverage`}>
      <div>
        <strong>Route coverage</strong>
        <span>
          {coveredCount}/{pack.capabilities.length} trusted local routes
        </span>
      </div>
      <div>
        {pack.capabilities.map((capability) => {
          const binding = bindingsByCapability.get(capability);
          return (
            <span key={capability} title={binding ? `${binding.provider_id} / ${binding.model_id ?? "no model"}` : "No route configured"}>
              <Badge tone={capabilityRouteTone(binding)}>{capabilityRouteLabel(binding)}</Badge>
              {capabilityDisplayLabel(capability)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function DownloadQueueRow({
  download,
  onPause,
  onResume,
  onCancel,
  busy
}: {
  download: AIModelDownload;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const percent = downloadPercent(download);
  const canPause = download.state === "queued" || download.state === "downloading";
  const canResume = download.state === "paused" || download.state === "failed";
  const canCancel = ["queued", "downloading", "paused", "failed"].includes(download.state);

  return (
    <article>
      <Badge tone={downloadTone(download.state)} title={download.state}>
        {modelDownloadLabel(download.state)}
      </Badge>
      <div className="download-meta">
        <strong>{download.model_id}</strong>
        <span>
          {formatBytes(download.bytes_downloaded)} / {formatBytes(download.bytes_total)}
        </span>
        <div className="progress-track" aria-label={`${download.model_id} download progress`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent}>
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="download-actions">
        <Button icon={<Pause size={14} />} variant="quiet" disabled={!canPause || busy} onClick={onPause}>
          Pause
        </Button>
        <Button icon={<Play size={14} />} variant="quiet" disabled={!canResume || busy} onClick={onResume}>
          Resume
        </Button>
        <Button icon={<X size={14} />} variant="danger" disabled={!canCancel || busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {download.error && <small>{download.error}</small>}
    </article>
  );
}

type WorkspacePathStatus = "done" | "ready" | "pending" | "blocked";
type WorkspacePathStep = {
  id: string;
  title: string;
  badge: string;
  status: WorkspacePathStatus;
  icon: typeof CircleDot;
  actionLabel: string;
  action: () => void;
};

function HomeStartPanel({
  stats,
  setup,
  onQuickNote,
  onOpenNotes,
  onOpenStorage,
  onOpenReview,
  onOpenSettings
}: {
  stats?: Stats;
  setup?: AISetupStatus;
  onQuickNote: () => void;
  onOpenNotes: () => void;
  onOpenStorage: () => void;
  onOpenReview: () => void;
  onOpenSettings: () => void;
}) {
  const notes = stats?.notes ?? 0;
  const sources = stats?.sources ?? 0;
  const pendingReview = stats?.pending_review_items ?? 0;
  const claims = stats?.claims ?? 0;
  const setupReady = setup?.overall_status === "ready" || setup?.overall_status === "demo_ready";
  const setupBlocked = setup?.overall_status === "blocked";
  const steps: WorkspacePathStep[] = [
    {
      id: "notes",
      title: "Notes",
      badge: notes ? `${notes} notes` : "empty",
      status: notes ? "done" : "ready",
      icon: NotebookPen,
      actionLabel: notes ? "Open Notes" : "Quick note",
      action: notes ? onOpenNotes : onQuickNote
    },
    {
      id: "storage",
      title: "Storage",
      badge: sources ? `${sources} sources` : "empty",
      status: sources ? "done" : "ready",
      icon: HardDrive,
      actionLabel: sources ? "Open Storage" : "Add source",
      action: onOpenStorage
    },
    {
      id: "review",
      title: "Review",
      badge: pendingReview ? `${pendingReview} pending` : claims ? `${claims} claims` : "clear",
      status: pendingReview ? "ready" : claims ? "done" : "pending",
      icon: Check,
      actionLabel: "Open Review",
      action: onOpenReview
    },
    {
      id: "local-ai",
      title: "Models",
      badge: setupReady ? "ready" : setup ? setup.overall_status.replace("_", " ") : "checking",
      status: setupReady ? "done" : setupBlocked ? "blocked" : setup ? "ready" : "pending",
      icon: Cpu,
      actionLabel: "Models",
      action: onOpenSettings
    }
  ];
  return (
    <Panel className="home-start-panel" aria-label="Workspace start">
      <div className="home-start-steps">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <button key={step.id} type="button" className={step.status} onClick={step.action}>
              <div className="home-start-step-icon">
                <Icon size={16} />
              </div>
              <div>
                <strong>{step.title}</strong>
                <span>{step.badge}</span>
              </div>
              <small>{step.actionLabel}</small>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function isAISetupStatus(value: unknown): value is AISetupStatus {
  return Boolean(value && typeof value === "object" && "overall_status" in value && Array.isArray((value as AISetupStatus).steps));
}

function formatActivityAction(action: string): string {
  return action
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => (word.toLowerCase() === "ai" ? "AI" : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function nightLabStatusLabel(status?: string, pending = false): string {
  if (pending || status === "running") return "Running";
  if (status === "completed") return "Complete";
  if (status === "failed") return "Needs attention";
  if (status === "queued") return "Queued";
  return "Ready";
}

function nightLabTaskResultLabel(result?: Record<string, unknown>): string {
  if (!result?.status) return "";
  const count = Number(result.created_review_items ?? 0);
  return `${nightLabStatusLabel(String(result.status))} · ${countLabel(count, "proposal")}`;
}

function Dashboard() {
  const queryClient = useQueryClient();
  const setSurface = useUIStore((state) => state.setSurface);
  const setSelectedNoteId = useUIStore((state) => state.setSelectedNoteId);
  const requestQuickNote = useUIStore((state) => state.requestQuickNote);
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => vaultRequest<Stats>("stats.get"), refetchInterval: 5000 });
  const events = useQuery({ queryKey: ["events"], queryFn: () => vaultRequest<any[]>("events.list", { limit: 8 }) });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => vaultRequest<LabJob[]>("jobs.list"), refetchInterval: 4000 });
  const latestBrief = useQuery({ queryKey: ["night-lab-brief"], queryFn: () => vaultRequest<Note | null>("nightLab.latestBrief") });
  const aiSetup = useQuery({ queryKey: ["ai-setup-status"], queryFn: () => vaultRequest<AISetupStatus>("ai.setup.status"), refetchInterval: 10000 });
  const [taskSelection, setTaskSelection] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(nightLabTaskOptions.map((task) => [task.id, true]))
  );
  const selectedNightLabTasks = useMemo(
    () => nightLabTaskOptions.filter((task) => taskSelection[task.id]).map((task) => task.id),
    [taskSelection]
  );
  const nightLab = useMutation({
    mutationFn: () =>
      vaultRequest("nightLab.run", {
        mode: "manual",
        autonomy_level: 2,
        tasks: selectedNightLabTasks.length > 0 ? selectedNightLabTasks : defaultNightLabTasks
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["night-lab-brief"] });
    }
  });
  const values = stats.data;
  const setupStatus = isAISetupStatus(aiSetup.data) ? aiSetup.data : undefined;
  const latestNightLabJob = (jobs.data ?? []).find((job) => job.job_type === "night_lab");
  const latestNightLabOutput = latestNightLabJob?.output ?? {};
  const taskResults = (latestNightLabOutput as any).task_results ?? {};
  const briefNoteId = String((nightLab.data as any)?.brief_note_id ?? latestBrief.data?.id ?? (latestNightLabOutput as any).brief_note_id ?? "");
  const reviewCount = Number((nightLab.data as any)?.created_review_items ?? (latestNightLabOutput as any).created_review_items ?? 0);
  const recentEvents = events.data ?? [];
  return (
    <div className="surface dashboard-grid">
      <HomeStartPanel
        stats={values}
        setup={setupStatus}
        onQuickNote={() => requestQuickNote()}
        onOpenNotes={() => setSurface("notes")}
        onOpenStorage={() => setSurface("sources")}
        onOpenReview={() => setSurface("review")}
        onOpenSettings={() => setSurface("settings")}
      />
      <details className="home-disclosure night-lab-panel">
        <summary>
          <span>
            <strong>Local automation</strong>
          </span>
          <Badge tone={latestNightLabJob?.status === "failed" ? "bad" : latestNightLabJob?.status === "running" || nightLab.isPending ? "warn" : "neutral"} title={latestNightLabJob?.status ?? "idle"}>
            {nightLabStatusLabel(latestNightLabJob?.status, nightLab.isPending)}
          </Badge>
        </summary>
        <div className="home-disclosure-body">
          <div className="night-lab-actions">
            <Button icon={<Moon size={16} />} disabled={nightLab.isPending} onClick={() => nightLab.mutate()}>
              {nightLab.isPending ? "Running" : "Run Night Lab"}
            </Button>
            <Button icon={<BookOpen size={15} />} variant="quiet" disabled={!briefNoteId} onClick={() => {
              setSelectedNoteId(briefNoteId);
              setSurface("notes");
            }}>
              Open brief
            </Button>
            <Button icon={<Check size={15} />} variant="quiet" onClick={() => setSurface("review")}>
              Review proposals
            </Button>
          </div>
          <div className="night-lab-status">
            <article>
              <strong>{reviewCount} proposals</strong>
              <span>{latestNightLabJob?.finished_at ? `Finished ${new Date(latestNightLabJob.finished_at).toLocaleString()}` : "No completed run yet."}</span>
            </article>
            <article>
              <strong>{values?.failed_jobs ?? 0} failures</strong>
              <span>{jobs.data?.filter((job) => job.status === "running").length ?? 0} running now</span>
            </article>
            <article>
              <strong>{values?.pending_review_items ?? 0} pending</strong>
              <span>All Night Lab changes stay reviewable.</span>
            </article>
          </div>
          <div className="night-lab-task-grid" aria-label="Night Lab tasks">
            {nightLabTaskOptions.map((task) => {
              const result = taskResults[task.id];
              return (
                <label key={task.id} className={taskSelection[task.id] ? "active" : ""}>
                  <input
                    type="checkbox"
                    checked={taskSelection[task.id]}
                    onChange={(event) => setTaskSelection((current) => ({ ...current, [task.id]: event.target.checked }))}
                    aria-label={task.label}
                  />
                  <span>
                    <strong>{task.label}</strong>
                    <small title={result?.status ? String(result.status) : undefined}>{result?.status ? nightLabTaskResultLabel(result) : task.caption}</small>
                  </span>
                </label>
              );
            })}
          </div>
          {latestBrief.data?.content_markdown && (
            <div className="night-lab-brief-preview" aria-label="Latest Morning Lab Brief">
              <Badge tone="info">Morning Lab Brief</Badge>
              <p>{latestBrief.data.content_markdown.split("\n").find((line) => line.startsWith("- ")) ?? "Latest brief is ready in Notes."}</p>
            </div>
          )}
          {nightLab.error && <small className="model-test-error">{nightLab.error.message}</small>}
        </div>
      </details>
      <Panel className="activity-panel">
        <div className="activity-panel-header">
          <div>
            <h3>Recent activity</h3>
          </div>
          <span>{recentEvents.length} updates</span>
        </div>
        <div className="home-counts" aria-label="Workspace counts">
          <span><strong>{values?.notes ?? 0}</strong> notes</span>
          <span><strong>{values?.sources ?? 0}</strong> sources</span>
          <span><strong>{values?.pending_review_items ?? 0}</strong> to review</span>
          <span><strong>{values?.learning_items ?? 0}</strong> practice</span>
        </div>
        <div className="event-list">
          {recentEvents.length === 0 && <p className="empty-copy">No activity</p>}
          {recentEvents.map((event) => (
            <article key={event.id}>
              <span>{formatActivityAction(event.action)}</span>
              <small>{new Date(event.created_at).toLocaleString()}</small>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

type TodoView = "inbox" | "today" | "upcoming" | "completed";

const todoViews: Array<{ id: TodoView; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Done" }
];

function TasksView() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<TodoView>("inbox");
  const [quickAdd, setQuickAdd] = useState("");
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const todos = useQuery({
    queryKey: ["todos", view, selectedListId],
    queryFn: () => vaultRequest<TodoListResponse>("todos.list", { view, listId: selectedListId, limit: 100, offset: 0 })
  });
  const lists = useQuery({ queryKey: ["todo-lists"], queryFn: () => vaultRequest<TodoList[]>("todoLists.list") });
  const listRows = lists.data ?? [];
  const createTodo = useMutation({
    mutationFn: (text: string) => vaultRequest<TodoItem>("todos.create", { text }),
    onSuccess: (created) => {
      setQuickAdd("");
      if (created.list_id) setSelectedListId(created.list_id);
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const completeTodo = useMutation({
    mutationFn: (todo: TodoItem) => vaultRequest<TodoItem>("todos.complete", { todoId: todo.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const createList = useMutation({
    mutationFn: (name: string) => vaultRequest<TodoList>("todoLists.create", { name }),
    onSuccess: (created) => {
      setNewListName("");
      setSelectedListId(created.id);
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const updateList = useMutation({
    mutationFn: ({ listId, data }: { listId: string; data: Record<string, any> }) => vaultRequest<TodoList>("todoLists.update", { listId, data }),
    onSuccess: (updated) => {
      setEditingListId(null);
      setEditingListName("");
      if (updated.status === "archived" && selectedListId === updated.id) setSelectedListId(null);
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const rows = todos.data?.items ?? [];
  const openRows = view === "completed" ? rows : rows.filter((todo) => todo.status !== "completed");
  const selectedTodo = rows.find((todo) => todo.id === selectedTodoId) ?? null;
  useEffect(() => {
    if (selectedTodoId && !rows.some((todo) => todo.id === selectedTodoId)) setSelectedTodoId(null);
  }, [rows, selectedTodoId]);

  function submitQuickAdd(event: ReactFormEvent) {
    event.preventDefault();
    const text = quickAdd.trim();
    if (!text || createTodo.isPending) return;
    createTodo.mutate(text);
  }

  function submitNewList(event: ReactFormEvent) {
    event.preventDefault();
    const name = newListName.trim();
    if (!name || createList.isPending) return;
    createList.mutate(name);
  }

  function startEditingList(list: TodoList) {
    setEditingListId(list.id);
    setEditingListName(list.name);
  }

  function submitListRename(event: ReactFormEvent, list: TodoList) {
    event.preventDefault();
    const name = editingListName.trim();
    if (!name || updateList.isPending) return;
    updateList.mutate({ listId: list.id, data: { name } });
  }

  return (
    <div className="surface tasks-view">
      <Panel className="tasks-pane">
        <div className="tasks-header">
          <div className="task-view-tabs" role="tablist" aria-label="Task views">
            {todoViews.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                className={view === item.id ? "active" : ""}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <form className="task-quick-add" onSubmit={submitQuickAdd}>
          <Input
            value={quickAdd}
            aria-label="Add task"
            placeholder="Add task"
            onChange={(event) => setQuickAdd(event.target.value)}
          />
          <Button type="submit" size="icon" variant="primary" icon={<Plus size={16} />} aria-label="Add task" disabled={!quickAdd.trim() || createTodo.isPending} />
        </form>
        {createTodo.error && <small className="model-test-error">{createTodo.error.message}</small>}
        {completeTodo.error && <small className="model-test-error">{completeTodo.error.message}</small>}
        <div className="task-list" aria-label={`${todoViewLabel(view)} tasks`}>
          {todos.isLoading && <p className="empty-copy">Loading tasks...</p>}
          {!todos.isLoading && openRows.length === 0 && <p className="empty-copy">{todoEmptyCopy(view)}</p>}
          {openRows.map((todo) => (
            <TaskRow
              key={todo.id}
              todo={todo}
              selected={selectedTodoId === todo.id}
              completing={completeTodo.isPending}
              onSelect={() => setSelectedTodoId(todo.id)}
              onComplete={() => completeTodo.mutate(todo)}
            />
          ))}
        </div>
      </Panel>
      <aside className="tasks-side" aria-label="Task lists">
        {selectedTodo ? (
          <TaskDetail todo={selectedTodo} lists={listRows} onClose={() => setSelectedTodoId(null)} />
        ) : (
          <>
            <div className="tasks-side-section">
              <div className="tasks-side-title">
                <strong>Lists</strong>
              </div>
              <button type="button" className={!selectedListId ? "active" : ""} onClick={() => setSelectedListId(null)}>
                <span>{view === "inbox" ? "Inbox" : "All"}</span>
              </button>
              {lists.isLoading && <span>Loading...</span>}
              {!lists.isLoading && listRows.length === 0 && <span>No lists</span>}
              {listRows.map((list) => (
                <div key={list.id} className={`task-list-row ${selectedListId === list.id ? "active" : ""}`}>
                  {editingListId === list.id ? (
                    <form className="task-list-edit" onSubmit={(event) => submitListRename(event, list)}>
                      <Input
                        aria-label={`Rename ${list.name}`}
                        value={editingListName}
                        onChange={(event) => setEditingListName(event.target.value)}
                        autoFocus
                      />
                      <Button type="submit" size="icon" variant="quiet" icon={<Check size={14} />} aria-label="Save list name" disabled={!editingListName.trim() || updateList.isPending} />
                      <Button type="button" size="icon" variant="quiet" icon={<X size={14} />} aria-label="Cancel list rename" onClick={() => setEditingListId(null)} />
                    </form>
                  ) : (
                    <>
                      <button type="button" title={list.name} onClick={() => setSelectedListId(list.id)}>
                        <span>{list.name}</span>
                        <small>{list.open_count}</small>
                      </button>
                      <button type="button" className="task-list-icon" aria-label={`Rename ${list.name}`} onClick={() => startEditingList(list)}>
                        <TextCursorInput size={13} />
                      </button>
                      <button
                        type="button"
                        className="task-list-icon"
                        aria-label={`Archive ${list.name}`}
                        disabled={updateList.isPending}
                        onClick={() => updateList.mutate({ listId: list.id, data: { status: "archived" } })}
                      >
                        <Archive size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
              <form className="task-list-add" onSubmit={submitNewList}>
                <Input
                  aria-label="New list name"
                  placeholder="New list"
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                />
                <Button type="submit" size="icon" variant="quiet" icon={<Plus size={14} />} aria-label="Create list" disabled={!newListName.trim() || createList.isPending} />
              </form>
              {createList.error && <small className="model-test-error">{createList.error.message}</small>}
              {updateList.error && <small className="model-test-error">{updateList.error.message}</small>}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function TaskRow({ todo, selected, completing, onSelect, onComplete }: { todo: TodoItem; selected: boolean; completing: boolean; onSelect: () => void; onComplete: () => void }) {
  const meta = todoMetaLine(todo);
  return (
    <article className={`task-row ${selected ? "active" : ""} ${todo.status === "completed" ? "completed" : ""}`} onClick={onSelect}>
      <button
        type="button"
        className="task-check"
        aria-label={todo.status === "completed" ? `${todo.title} completed` : `Complete ${todo.title}`}
        disabled={todo.status === "completed" || completing}
        onClick={(event) => {
          event.stopPropagation();
          onComplete();
        }}
      >
        {todo.status === "completed" && <Check size={13} />}
      </button>
      <div className="task-row-main">
        <strong>{todo.title}</strong>
        {meta && <span>{meta}</span>}
        {(todo.labels.length > 0 || todo.context_links.length > 0) && (
          <div className="task-row-tags">
            {todo.labels.map((label) => (
              <Badge key={label} tone="neutral">@{label}</Badge>
            ))}
            {todo.context_links.slice(0, 2).map((link) => (
              <Badge key={link.id} tone="info">{todoContextLabel(link)}</Badge>
            ))}
          </div>
        )}
      </div>
      {todo.priority < 4 && <Badge tone={todo.priority === 1 ? "bad" : todo.priority === 2 ? "warn" : "neutral"}>p{todo.priority}</Badge>}
    </article>
  );
}

function TaskDetail({ todo, lists, onClose }: { todo: TodoItem; lists: TodoList[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? "");
  const [dueDate, setDueDate] = useState(todo.due_date ?? "");
  const [priority, setPriority] = useState(String(todo.priority || 4));
  const [listId, setListId] = useState(todo.list_id ?? "inbox");
  const [labels, setLabels] = useState(todo.labels.join(", "));
  const [recurrenceRule, setRecurrenceRule] = useState(todo.recurrence_rule ?? "");
  useEffect(() => {
    setTitle(todo.title);
    setDescription(todo.description ?? "");
    setDueDate(todo.due_date ?? "");
    setPriority(String(todo.priority || 4));
    setListId(todo.list_id ?? "inbox");
    setLabels(todo.labels.join(", "));
    setRecurrenceRule(todo.recurrence_rule ?? "");
  }, [todo.id, todo.title, todo.description, todo.due_date, todo.priority, todo.list_id, todo.labels, todo.recurrence_rule]);
  const updateTodo = useMutation({
    mutationFn: () =>
      vaultRequest<TodoItem>("todos.update", {
        todoId: todo.id,
        data: {
          title: title.trim(),
          description,
          due_date: dueDate || null,
          priority: Number(priority),
          list_id: listId === "inbox" ? null : listId,
          labels: labels.split(",").map((label) => label.trim()).filter(Boolean),
          recurrence_rule: recurrenceRule.trim() || null
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  return (
    <div className="task-detail" aria-label="Task detail">
      <div className="task-detail-header">
        <strong>Task</strong>
        <Button type="button" size="icon" variant="quiet" icon={<X size={14} />} aria-label="Close task detail" onClick={onClose} />
      </div>
      <label className="field">
        <span>Title</span>
        <Input aria-label="Task detail title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="field">
        <span>Due</span>
        <Input aria-label="Task due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </label>
      <label className="field">
        <span>List</span>
        <SelectRoot value={listId} onValueChange={setListId}>
          <SelectTrigger aria-label="Task list">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inbox">Inbox</SelectItem>
            {lists.map((list) => (
              <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
      </label>
      <label className="field">
        <span>Priority</span>
        <SelectRoot value={priority} onValueChange={setPriority}>
          <SelectTrigger aria-label="Task priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">p1</SelectItem>
            <SelectItem value="2">p2</SelectItem>
            <SelectItem value="3">p3</SelectItem>
            <SelectItem value="4">p4</SelectItem>
          </SelectContent>
        </SelectRoot>
      </label>
      <label className="field">
        <span>Labels</span>
        <Input aria-label="Task labels" placeholder="waiting, reading" value={labels} onChange={(event) => setLabels(event.target.value)} />
      </label>
      <label className="field">
        <span>Repeats</span>
        <Input aria-label="Task recurrence" placeholder="every friday" value={recurrenceRule} onChange={(event) => setRecurrenceRule(event.target.value)} />
      </label>
      <label className="field">
        <span>Note</span>
        <Textarea aria-label="Task description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      {todo.context_links.length > 0 && (
        <div className="task-detail-context">
          <strong>Context</strong>
          {todo.context_links.map((link) => (
            <span key={link.id} title={link.target_title ?? link.target_id}>{todoContextLabel(link)}</span>
          ))}
        </div>
      )}
      {updateTodo.error && <small className="model-test-error">{updateTodo.error.message}</small>}
      <Button type="button" variant="primary" disabled={!title.trim() || updateTodo.isPending} onClick={() => updateTodo.mutate()}>
        {updateTodo.isPending ? "Saving" : "Save"}
      </Button>
    </div>
  );
}

function todoViewLabel(view: TodoView): string {
  if (view === "today") return "Today";
  if (view === "upcoming") return "Upcoming";
  if (view === "completed") return "Completed";
  return "Inbox";
}

function todoEmptyCopy(view: TodoView): string {
  if (view === "today") return "Nothing due today.";
  if (view === "upcoming") return "No upcoming tasks.";
  if (view === "completed") return "No completed tasks.";
  return "Inbox clear.";
}

function todoMetaLine(todo: TodoItem): string {
  const parts = [
    todo.due_date ? todoDueLabel(todo.due_date) : "",
    todo.list_name ? `#${todo.list_name}` : "",
    todo.recurrence_rule ? todo.recurrence_rule : ""
  ].filter(Boolean);
  return parts.join(" · ");
}

function todoDueLabel(value: string): string {
  const today = new Date();
  const date = new Date(`${value}T00:00:00`);
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dayKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const offset = Math.round((dayKey - todayKey) / 86400000);
  if (offset === 0) return "today";
  if (offset === 1) return "tomorrow";
  if (offset === -1) return "yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function todoContextLabel(link: TodoContextLink): string {
  const type = searchModeLabel(link.target_type);
  return link.target_title ? `${type}: ${link.target_title}` : type;
}

function NotesView() {
  const queryClient = useQueryClient();
  const setSurface = useUIStore((state) => state.setSurface);
  const selectedNoteId = useUIStore((state) => state.selectedNoteId);
  const setSelectedNoteId = useUIStore((state) => state.setSelectedNoteId);
  const requestQuickNote = useUIStore((state) => state.requestQuickNote);
  const notes = useQuery({ queryKey: ["notes"], queryFn: () => vaultRequest<Note[]>("notes.list") });
  const noteRows = notes.data ?? [];
  const selectedNoteInRows = Boolean(selectedNoteId && noteRows.some((note) => note.id === selectedNoteId));
  const selected = useMemo(() => noteRows.find((note) => note.id === selectedNoteId) ?? noteRows[0], [noteRows, selectedNoteId]);
  useEffect(() => {
    if (!selectedNoteId && selected?.id) setSelectedNoteId(selected.id);
    if (selectedNoteId && selectedNoteInRows && selected?.id && selectedNoteId !== selected.id) setSelectedNoteId(selected.id);
  }, [selected?.id, selectedNoteId, selectedNoteInRows, setSelectedNoteId]);
  const createNote = useMutation({
    mutationFn: () => vaultRequest<Note>("notes.create", blankResearchNoteInput()),
    onSuccess: (note) => {
      setSelectedNoteId(note.id);
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    }
  });
  return (
    <div className="surface split-view">
      <Panel className="list-pane">
        <SectionHeader
          title="Notes"
          actions={
            <Button icon={<FilePlus2 size={16} />} onClick={() => createNote.mutate()}>
              New note
            </Button>
          }
        />
        <div className="entity-list notes-list">
          {notes.isLoading && <div className="entity-list-empty">Loading notes...</div>}
          {!notes.isLoading && noteRows.length === 0 && (
            <NotesEmptyState
              onNewNote={() => createNote.mutate()}
              onQuickNote={() => requestQuickNote()}
              onOpenStorage={() => setSurface("sources")}
            />
          )}
          {noteRows.map((note) => {
            const kind = noteKind(note);
            return (
              <button key={note.id} className={selected?.id === note.id ? "active" : ""} onClick={() => setSelectedNoteId(note.id)}>
                <span className="note-list-title">
                  <strong>{note.title}</strong>
                  <Badge tone={kind.tone}>{kind.label}</Badge>
                </span>
                <span className="note-list-preview">{notePreview(note)}</span>
                <small className="note-list-meta">
                  <Clock3 size={12} />
                  {compactDate(note.updated_at)} · v{note.version} · {note.status.replace(/_/g, " ")}
                </small>
                {Boolean(note.content?.model_id) && (
                  <small title={String(note.content?.model_id)}>{generatedDraftPrivacyLabel(note.content ?? {})}</small>
                )}
              </button>
            );
          })}
        </div>
      </Panel>
      <NoteEditor note={selected} />
    </div>
  );
}

function NotesEmptyState({
  onNewNote,
  onQuickNote,
  onOpenStorage
}: {
  onNewNote: () => void;
  onQuickNote: () => void;
  onOpenStorage: () => void;
}) {
  return (
    <div className="entity-list-empty notes-empty-state">
      <NotebookPen size={18} />
      <strong>Start with a note</strong>
      <span>Use Quick note for a thought, or New note for longer writing.</span>
      <div className="entity-list-empty-actions">
        <Button type="button" size="sm" variant="primary" icon={<NotebookPen size={14} />} onClick={onQuickNote}>
          Quick note
        </Button>
        <Button type="button" size="sm" variant="secondary" icon={<FilePlus2 size={14} />} onClick={onNewNote}>
          New note
        </Button>
        <Button type="button" size="sm" variant="quiet" icon={<HardDrive size={14} />} onClick={onOpenStorage}>
          Storage
        </Button>
      </div>
    </div>
  );
}

type RecordingState = "idle" | "recording" | "processing";
type MicrophonePermissionStatus = "checking" | "ready" | "granted" | "prompt" | "denied" | "unsupported" | "error";
type EditorSaveState = "saved" | "saving" | "unsaved" | "error";

function noteSaveStateLabel(saveState: EditorSaveState): string {
  if (saveState === "saved") return "All changes saved";
  if (saveState === "saving") return "Saving changes";
  if (saveState === "unsaved") return "Unsaved changes";
  return "Save failed";
}

function noteSaveStateTone(saveState: EditorSaveState): "neutral" | "good" | "warn" | "bad" {
  if (saveState === "saved") return "good";
  if (saveState === "saving") return "neutral";
  if (saveState === "unsaved") return "warn";
  return "bad";
}

function EditorFormatToolbar({ editor, onSave, saveState }: { editor: Editor | null; onSave: () => void; saveState: EditorSaveState }) {
  const disabled = !editor;
  const controls = [
    {
      label: "Paragraph",
      icon: Pilcrow,
      active: Boolean(editor?.isActive("paragraph")),
      run: () => editor?.chain().focus().setParagraph().run()
    },
    {
      label: "Heading 1",
      icon: Heading1,
      active: Boolean(editor?.isActive("heading", { level: 1 })),
      run: () => editor?.chain().focus().toggleHeading({ level: 1 }).run()
    },
    {
      label: "Heading 2",
      icon: Heading2,
      active: Boolean(editor?.isActive("heading", { level: 2 })),
      run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run()
    },
    {
      label: "Bold",
      icon: Bold,
      active: Boolean(editor?.isActive("bold")),
      run: () => editor?.chain().focus().toggleBold().run()
    },
    {
      label: "Italic",
      icon: Italic,
      active: Boolean(editor?.isActive("italic")),
      run: () => editor?.chain().focus().toggleItalic().run()
    },
    {
      label: "Strike",
      icon: Strikethrough,
      active: Boolean(editor?.isActive("strike")),
      run: () => editor?.chain().focus().toggleStrike().run()
    },
    {
      label: "Bullet list",
      icon: List,
      active: Boolean(editor?.isActive("bulletList")),
      run: () => editor?.chain().focus().toggleBulletList().run()
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: Boolean(editor?.isActive("orderedList")),
      run: () => editor?.chain().focus().toggleOrderedList().run()
    },
    {
      label: "Quote",
      icon: Quote,
      active: Boolean(editor?.isActive("blockquote")),
      run: () => editor?.chain().focus().toggleBlockquote().run()
    },
    {
      label: "Code block",
      icon: Code2,
      active: Boolean(editor?.isActive("codeBlock")),
      run: () => editor?.chain().focus().toggleCodeBlock().run()
    }
  ];

  return (
    <div className="format-toolbar" aria-label="Editor formatting">
      <div className="format-toolbar-group">
        {controls.map((control) => {
          const Icon = control.icon;
          return (
            <Button
              key={control.label}
              type="button"
              size="icon"
              variant={control.active ? "secondary" : "quiet"}
              className={control.active ? "active" : ""}
              icon={<Icon size={15} />}
              aria-label={control.label}
              aria-pressed={control.active}
              title={control.label}
              disabled={disabled}
              onClick={control.run}
            />
          );
        })}
      </div>
      <div className="format-toolbar-group">
        <Button
          type="button"
          size="icon"
          variant="quiet"
          icon={<Undo2 size={15} />}
          aria-label="Undo"
          title="Undo"
          disabled={disabled || !editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        />
        <Button
          type="button"
          size="icon"
          variant="quiet"
          icon={<Redo2 size={15} />}
          aria-label="Redo"
          title="Redo"
          disabled={disabled || !editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        />
      </div>
      <Button
        type="button"
        icon={<Save size={15} />}
        variant={saveState === "unsaved" || saveState === "error" ? "primary" : "quiet"}
        disabled={disabled || saveState === "saving"}
        onClick={onSave}
      >
        {saveState === "saving" ? "Saving" : "Save"}
      </Button>
    </div>
  );
}

function NoteEditor({ note }: { note?: Note }) {
  const queryClient = useQueryClient();
  const setSurface = useUIStore((state) => state.setSurface);
  const setSelectedNoteId = useUIStore((state) => state.setSelectedNoteId);
  const setSelectedSourceId = useUIStore((state) => state.setSelectedSourceId);
  const setSelectedSourceBlockId = useUIStore((state) => state.setSelectedSourceBlockId);
  const [title, setTitle] = useState(note?.title ?? "");
  const [saveState, setSaveState] = useState<EditorSaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [editorRevision, setEditorRevision] = useState(0);
  const [dictationResult, setDictationResult] = useState<any | null>(null);
  const [speechResult, setSpeechResult] = useState<any | null>(null);
  const [speechAudioUrl, setSpeechAudioUrl] = useState("");
  const [speechPlaybackError, setSpeechPlaybackError] = useState("");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingError, setRecordingError] = useState("");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStateRef = useRef(recordingState);
  const pushToTalkHeldRef = useRef(false);
  const lastSavedSnapshotRef = useRef(note ? noteSnapshotFromPersisted(note) : "");
  const versions = useQuery({
    queryKey: ["note-versions", note?.id],
    queryFn: () => vaultRequest<NoteVersion[]>("notes.versions", { noteId: note!.id }),
    enabled: Boolean(note?.id && versionsOpen)
  });
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: "Write the research trace. Put raw sources in Storage, then cite them here." })],
    content: note ? editorDocFromNote(note) : "",
    editorProps: { attributes: { class: "note-editor-prose" } },
    onUpdate: () => {
      setEditorRevision((revision) => revision + 1);
      setSaveError("");
      setSaveState((state) => (state === "saving" ? "saving" : "unsaved"));
    },
    onSelectionUpdate: () => {
      setEditorRevision((revision) => revision + 1);
    }
  });

  useEffect(
    () => () => {
      pushToTalkHeldRef.current = false;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      stopRecordingTracks();
    },
    []
  );

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  useEffect(() => {
    if (!note?.id) return;
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void saveCurrentNote();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editor, note?.id, title, editorRevision]);

  useEffect(() => {
    setTitle(note?.title ?? "");
    setSaveError("");
    setSaveState("saved");
    lastSavedSnapshotRef.current = note ? noteSnapshotFromPersisted(note) : "";
    if (editor && note) {
      editor.commands.setContent(editorDocFromNote(note), false);
      setEditorRevision((revision) => revision + 1);
    }
  }, [editor, note?.id, note?.version]);

  useEffect(() => {
    if (!versionsOpen) return;
    const next = versions.data?.[0]?.version ?? null;
    setSelectedVersionNumber((current) => (current && versions.data?.some((version) => version.version === current) ? current : next));
  }, [versionsOpen, versions.data]);

  useEffect(() => {
    if (!editor || !note) return;
    const timeout = window.setTimeout(async () => {
      await saveCurrentNote();
    }, 850);
    return () => window.clearTimeout(timeout);
  }, [editorRevision, title, note?.id]);

  async function saveCurrentNote() {
    if (!editor || !note) return;
    const editorDoc = editor.getJSON();
    const markdown = editorMarkdownForSave(editor);
    const contentJson = noteContentForSave(note, editorDoc, markdown !== note.content_markdown);
    const snapshot = stableSnapshot({ title, content_markdown: markdown, content_json: contentJson });
    if (snapshot === lastSavedSnapshotRef.current) {
      setSaveState("saved");
      return;
    }
    setSaveState("saving");
    setSaveError("");
    try {
      await vaultRequest("notes.update", {
        noteId: note.id,
        data: {
          title,
          content_json: contentJson,
          content_markdown: markdown
        }
      });
      lastSavedSnapshotRef.current = snapshot;
      setSaveState("saved");
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Could not save this note.");
    }
  }

  const extract = useMutation({
    mutationFn: () => vaultRequest("notes.extract", { noteId: note!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  });
  const generate = useMutation({
    mutationFn: () =>
      vaultRequest("notes.generate", {
        mode: "research_memo",
        title: `${title || "Generated"} memo`,
        prompt: editor?.getText() ?? "",
        source_ids: note?.source_id ? [note.source_id] : []
      }),
    onSuccess: (result: any) => {
      if (result?.note_id) setSelectedNoteId(String(result.note_id));
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const approveGenerated = useMutation({
    mutationFn: () => vaultRequest("notes.promoteGenerated", { noteId: note!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const rejectGenerated = useMutation({
    mutationFn: () => vaultRequest("notes.rejectGenerated", { noteId: note!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const prepareGeneratedReview = useMutation({
    mutationFn: () => vaultRequest("notes.prepareGeneratedReview", { noteId: note!.id, data: { force: false, extract: ["claims"] } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const restoreVersion = useMutation({
    mutationFn: (version: NoteVersion) => vaultRequest<Note>("notes.restoreVersion", { noteId: note!.id, version: version.version }),
    onSuccess: (restored) => {
      setSelectedNoteId(restored.id);
      setSelectedVersionNumber(restored.version);
      setSaveError("");
      setSaveState("saved");
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["note-versions", restored.id] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const exportNoteMarkdown = useMutation({
    mutationFn: async () => {
      if (!editor || !note) throw new Error("Select a note before exporting.");
      const markdown = editorMarkdownForSave(editor);
      const filename = noteExportFilename({ id: note.id, title });
      const saved = await saveTextFile(filename, noteMarkdownExport(note, markdown, title), "text/markdown");
      return { filename, saved };
    }
  });

  function openLinkedStorageSource() {
    if (!note?.source_id) return;
    void saveCurrentNote();
    setSelectedSourceId(note.source_id);
    setSelectedSourceBlockId(undefined);
    setSurface("sources");
  }

  async function insertDictationResult(result: any) {
    if (!result || !editor || !note) return;
    const transcriptText = transcriptTextFromResult(result);
    if (!transcriptText) return;
    const paragraphs = transcriptText
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => ({ type: "paragraph", content: [{ type: "text", text: paragraph }] }));
    editor.chain().focus().insertContent(paragraphs).run();
    const markdown = editorMarkdownForSave(editor);
    const contentJson = noteContentForSave(note, editor.getJSON(), markdown !== note.content_markdown);
    const snapshot = stableSnapshot({ title, content_markdown: markdown, content_json: contentJson });
    setSaveState("saving");
    await vaultRequest("notes.update", {
      noteId: note.id,
      data: { title, content_json: contentJson, content_markdown: markdown }
    });
    lastSavedSnapshotRef.current = snapshot;
    setSaveState("saved");
    setDictationResult(result);
    queryClient.invalidateQueries({ queryKey: ["notes"] });
    queryClient.invalidateQueries({ queryKey: ["sources"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
  }

  const dictateFile = useMutation<any | null, Error>({
    mutationFn: async () => {
      if (!note?.id) return null;
      const files = await selectFiles();
      if (!files[0]) return null;
      const filename = files[0].split(/[\\/]/).pop() ?? "Voice memo";
      const transcriptTitle = filename.replace(/\.[^.]+$/, "") || "Voice memo";
      return vaultRequest("voice.transcribe", {
        audio_path: files[0],
        title: transcriptTitle,
        create_source: true,
        local_only: true,
        metadata: { import_mode: "note_editor_insert", note_id: note.id }
      });
    },
    onSuccess: async (result) => {
      await insertDictationResult(result);
    }
  });
  const speakNote = useMutation<any | null, Error>({
    mutationFn: async () => {
      const text = editor?.getText({ blockSeparator: "\n\n" }).trim();
      if (!note?.id || !text) return null;
      return vaultRequest("voice.synthesize", {
        text,
        voice_id: "mock-local-voice",
        format: "wav",
        local_only: true,
        cache: true
      });
    },
    onSuccess: async (result) => {
      if (!result) return;
      setSpeechResult(result);
      setSpeechPlaybackError("");
      if (result.speech_asset_id) {
        try {
          const audio = await vaultRequest<any>("voice.speechAssetAudio", { speechAssetId: result.speech_asset_id });
          setSpeechAudioUrl(String(audio.data_url ?? ""));
        } catch (error) {
          setSpeechPlaybackError(error instanceof Error ? error.message : "Could not load generated speech audio.");
        }
      }
      queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
      queryClient.invalidateQueries({ queryKey: ["voice-speech-assets"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });

  async function startRecording(options: { pushToTalk?: boolean } = {}) {
    if (!note?.id) return;
    if (recordingStateRef.current !== "idle") return;
    recordingStateRef.current = "processing";
    if (options.pushToTalk) pushToTalkHeldRef.current = true;
    setRecordingError("");
    setDictationResult(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("Microphone recording is not available in this environment.");
      recordingStateRef.current = "idle";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = supportedRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setRecordingError("Microphone recording failed.");
      };
      recorder.onstop = () => {
        void finishRecording(recorder);
      };
      recorder.start();
      if (options.pushToTalk && !pushToTalkHeldRef.current) {
        recordingStateRef.current = "processing";
        setRecordingState("processing");
        recorder.stop();
      } else {
        recordingStateRef.current = "recording";
        setRecordingState("recording");
      }
    } catch (error) {
      setRecordingError(error instanceof Error ? error.message : "Could not start microphone recording.");
      stopRecordingTracks();
      recordingStateRef.current = "idle";
      setRecordingState("idle");
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recordingStateRef.current = "processing";
    setRecordingState("processing");
    recorder.stop();
  }

  async function finishRecording(recorder: MediaRecorder) {
    try {
      if (!note?.id) return;
      const mimeType = recorder.mimeType || supportedRecordingMimeType() || "audio/webm";
      const blob = new Blob(recordingChunksRef.current, { type: mimeType });
      const saved = await saveAudioRecording(await blobToArrayBuffer(blob), mimeType);
      const result = await vaultRequest<any>("voice.transcribe", {
        audio_path: saved.filePath,
        title: "Recorded dictation",
        create_source: true,
        local_only: true,
        metadata: {
          import_mode: "note_editor_microphone",
          note_id: note.id,
          mime_type: saved.mimeType,
          size_bytes: saved.sizeBytes
        }
      });
      await insertDictationResult(result);
    } catch (error) {
      setRecordingError(error instanceof Error ? error.message : "Could not transcribe the recording.");
    } finally {
      stopRecordingTracks();
      mediaRecorderRef.current = null;
      recordingChunksRef.current = [];
      recordingStateRef.current = "idle";
      setRecordingState("idle");
    }
  }

  function stopRecordingTracks() {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  }

  useEffect(() => {
    if (!note?.id) return;
    function isPushToTalkShortcut(event: KeyboardEvent) {
      return event.altKey && !event.ctrlKey && !event.metaKey && event.code === "Space";
    }
    function onKeyDown(event: KeyboardEvent) {
      if (!isPushToTalkShortcut(event)) return;
      event.preventDefault();
      if (event.repeat || pushToTalkHeldRef.current) return;
      pushToTalkHeldRef.current = true;
      void startRecording({ pushToTalk: true });
    }
    function onKeyUp(event: KeyboardEvent) {
      if (!isPushToTalkShortcut(event)) return;
      event.preventDefault();
      pushToTalkHeldRef.current = false;
      if (mediaRecorderRef.current?.state === "recording") stopRecording();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [note?.id]);

  if (!note) {
    return (
      <Panel className="editor-pane empty-state">
        <h3>No note selected.</h3>
        <p>Create a note to start writing, or open Storage when you want to add immutable evidence.</p>
      </Panel>
    );
  }

  const content = note.content ?? {};
  const generationStatus = typeof content.generation_status === "string" ? content.generation_status : "";
  const claimReviewStatus = typeof content.generated_claim_review_status === "string" ? content.generated_claim_review_status : "not_prepared";
  const claimReviewPrepared = claimReviewStatus === "prepared";
  const claimReviewBlocked = claimReviewStatus === "blocked";
  const claimReviewCount = Number(content.generated_claim_review_item_count ?? 0);
  const claimReviewQuarantined = Number(content.generated_claim_review_quarantined_count ?? 0);
  const claimReviewError = typeof content.generated_claim_review_error === "string" ? content.generated_claim_review_error : "";
  const isGeneratedDraft = note.origin === "ai_generated" && note.status === "generated_pending_review";
  const reviewBusy = approveGenerated.isPending || rejectGenerated.isPending || prepareGeneratedReview.isPending || generate.isPending;
  const versionRows = versions.data ?? [];
  const selectedVersion = versionRows.find((version) => version.version === selectedVersionNumber) ?? versionRows[0];
  const canRestoreSelectedVersion = Boolean(selectedVersion && selectedVersion.version !== note.version);

  return (
    <Panel className="editor-pane">
      <div className="editor-toolbar">
        <div className="editor-title-row">
          <div className="editor-title-stack">
            <input
              className="title-input"
              aria-label="Note title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setSaveError("");
                setSaveState((state) => (state === "saving" ? "saving" : "unsaved"));
              }}
            />
            <small>
              {noteKind(note).label} · v{note.version} · {compactDate(note.updated_at)}
            </small>
          </div>
          <div className="editor-status-row">
            <Badge tone={note.status === "generated_pending_review" ? "warn" : "good"}>{note.status.replace(/_/g, " ")}</Badge>
            <span role="status" aria-live="polite" aria-label="Note save status">
              <Badge tone={noteSaveStateTone(saveState)}>{noteSaveStateLabel(saveState)}</Badge>
            </span>
          </div>
        </div>
        <EditorFormatToolbar editor={editor} saveState={saveState} onSave={() => void saveCurrentNote()} />
        <details className="note-tools-panel">
          <summary>
            <span>
              <strong>Note tools</strong>
            </span>
            <Badge tone="good">local-first</Badge>
          </summary>
          <div className="note-tools-body" aria-label="Note actions">
            <section>
              <h4>Make from this note</h4>
              <div className="editor-action-row">
                <Button icon={<Sparkles size={16} />} onClick={() => extract.mutate()}>
                  Propose claims
                </Button>
                <Button icon={<Archive size={16} />} onClick={() => generate.mutate()}>
                  Draft memo
                </Button>
                <TaskCreateButton targetType="note" targetId={note.id} targetTitle={title || note.title} />
                <CapsuleAttachButton targetType="note" targetId={note.id} targetTitle={title || note.title} defaultRole="core" />
              </div>
            </section>
            <section>
              <h4>Voice</h4>
              <div className="editor-action-row">
                <Button icon={<Mic size={16} />} variant="quiet" disabled={dictateFile.isPending} onClick={() => dictateFile.mutate()}>
                  Insert audio
                </Button>
                <Button
                  icon={recordingState === "recording" ? <Pause size={16} /> : <Mic size={16} />}
                  variant={recordingState === "recording" ? "primary" : "quiet"}
                  disabled={recordingState === "processing"}
                  aria-keyshortcuts="Alt+Space"
                  title="Hold Option+Space for local dictation"
                  onClick={() => (recordingState === "recording" ? stopRecording() : void startRecording())}
                >
                  {recordingState === "recording" ? "Stop" : recordingState === "processing" ? "Saving" : "Record"}
                </Button>
                <Button icon={<Volume2 size={16} />} variant="quiet" disabled={speakNote.isPending} onClick={() => speakNote.mutate()}>
                  Read aloud
                </Button>
              </div>
            </section>
            <section>
              <h4>File and history</h4>
              <div className="editor-action-row">
                <Button
                  icon={<HardDrive size={16} />}
                  variant="quiet"
                  disabled={!note.source_id}
                  title="Open this note's indexed source record in Storage"
                  onClick={openLinkedStorageSource}
                >
                  Open in Storage
                </Button>
                <Button icon={<Download size={16} />} variant="quiet" disabled={exportNoteMarkdown.isPending} onClick={() => exportNoteMarkdown.mutate()}>
                  Export Markdown
                </Button>
                <Button variant="quiet" onClick={() => setVersionsOpen(!versionsOpen)}>
                  Versions
                </Button>
              </div>
            </section>
            <details className="editor-local-routes">
              <summary>
                <span>Model routes</span>
                <Badge tone="good">on device</Badge>
              </summary>
              <div aria-label="Model routes used by note actions">
                <CapabilityStatus capability="extract_claims" compact />
                <CapabilityStatus capability="extract_objects" compact />
                <CapabilityStatus capability="generate_note" compact />
              </div>
            </details>
          </div>
        </details>
      </div>
      <NoteProvenance note={note} />
      <NoteLaneIntent note={note} />
      {isGeneratedDraft && (
        <div className="generated-review-bar">
          <div>
            <Badge tone="warn">{generationStatus || "draft"}</Badge>
            <strong>Generated draft awaiting review</strong>
            <span>Prepare claim review items before promotion; any edited draft needs a fresh pass.</span>
            {claimReviewPrepared && (
              <small>
                {claimReviewCount} claim review{claimReviewCount === 1 ? "" : "s"} prepared
                {claimReviewQuarantined ? `, ${claimReviewQuarantined} held for review` : ""}.
              </small>
            )}
            {claimReviewBlocked && (
              <small className="model-test-error">
                {claimReviewError || "No approvable claims were prepared. Check held review output or regenerate the draft."}
              </small>
            )}
            {claimReviewStatus === "stale" && <small className="model-test-error">Draft changed after claim review. Prepare it again before approval.</small>}
          </div>
          <div className="generated-review-actions">
            <Button
              icon={<TestTube2 size={15} />}
              variant={claimReviewPrepared ? "quiet" : "primary"}
              disabled={reviewBusy || claimReviewPrepared}
              onClick={() => prepareGeneratedReview.mutate()}
            >
              {claimReviewPrepared ? "Claim review ready" : claimReviewStatus === "stale" || claimReviewBlocked ? "Recheck claims" : "Prepare claim review"}
            </Button>
            <Button icon={<Check size={15} />} variant={claimReviewPrepared ? "primary" : "secondary"} disabled={reviewBusy || !claimReviewPrepared} onClick={() => approveGenerated.mutate()}>
              Approve as note
            </Button>
            <Button icon={<RefreshCw size={15} />} variant="quiet" disabled={reviewBusy} onClick={() => generate.mutate()}>
              Regenerate
            </Button>
            <Button icon={<X size={15} />} variant="danger" disabled={reviewBusy} onClick={() => rejectGenerated.mutate()}>
              Reject
            </Button>
          </div>
        </div>
      )}
      {approveGenerated.error && <small className="model-test-error">{approveGenerated.error.message}</small>}
      {prepareGeneratedReview.error && <small className="model-test-error">{prepareGeneratedReview.error.message}</small>}
      {rejectGenerated.error && <small className="model-test-error">{rejectGenerated.error.message}</small>}
      {Boolean(extract.data) && (
        <div className="workflow-result">
          <Badge tone={(extract.data as any).quarantined_items ? "warn" : "good"}>Extraction</Badge>
          <span>{String((extract.data as any).created_review_items ?? 0)} review proposals</span>
          <small>{String((extract.data as any).quarantined_items ?? 0)} held for review</small>
        </div>
      )}
      {Boolean(generate.data) && (
        <div className="workflow-result">
          <Badge tone={(generate.data as any).sent_off_device ? "bad" : "good"}>Drafted</Badge>
          <span title={String((generate.data as any).model_id ?? "mock-local-llm")}>{generatedDraftPrivacyLabel(generate.data as any)}</span>
          <small title={String((generate.data as any).ai_run_id ?? "")}>{generatedRunLabel((generate.data as any).ai_run_id)}</small>
        </div>
      )}
      {dictationResult && (
        <div className="workflow-result">
          <Badge tone={dictationResult.sent_off_device ? "bad" : "good"}>Dictated</Badge>
          <span title={String(dictationResult.model_id ?? "mock-local-stt")}>{speechAssetPrivacyLabel(dictationResult)}</span>
          <small title={String(dictationResult.source_id ?? "")}>{storageLinkLabel(dictationResult.source_id)}</small>
        </div>
      )}
      {speechResult && (
        <div className="workflow-result">
          <Badge tone={speechResult.sent_off_device ? "bad" : "good"}>{speechResult.cached ? "Audio ready" : "Audio saved"}</Badge>
          <span title={String(speechResult.model_id ?? "")}>{speechAssetPrivacyLabel(speechResult)}</span>
          <small title={String(speechResult.speech_asset_id ?? "")}>Ready to play</small>
          {speechAudioUrl && <audio className="speech-player" src={speechAudioUrl} controls />}
        </div>
      )}
      {exportNoteMarkdown.data && (
        <div className="workflow-result">
          <Badge tone={exportNoteMarkdown.data.saved.saved ? "good" : "neutral"}>{exportNoteMarkdown.data.saved.saved ? "Exported" : "Export cancelled"}</Badge>
          <span>{exportNoteMarkdown.data.filename}</span>
          {exportNoteMarkdown.data.saved.filePath && <small>{exportNoteMarkdown.data.saved.filePath}</small>}
        </div>
      )}
      {dictateFile.error && <small className="model-test-error">{dictateFile.error.message}</small>}
      {speakNote.error && <small className="model-test-error">{speakNote.error.message}</small>}
      {exportNoteMarkdown.error && <small className="model-test-error">{exportNoteMarkdown.error.message}</small>}
      {speechPlaybackError && <small className="model-test-error">{speechPlaybackError}</small>}
      {recordingError && <small className="model-test-error">{recordingError}</small>}
      {saveError && <small className="model-test-error">{saveError}</small>}
      <EditorContent editor={editor} className="editor-frame" />
      {versionsOpen && (
        <div className="version-drawer">
          <div className="version-drawer-header">
            <div>
              <strong>Version history</strong>
              <span>{versions.isLoading ? "Loading saved versions..." : `${versionRows.length} saved version${versionRows.length === 1 ? "" : "s"}`}</span>
            </div>
            <Button size="icon" variant="quiet" icon={<X size={14} />} aria-label="Close version history" onClick={() => setVersionsOpen(false)} />
          </div>
          {versions.error && <small className="model-test-error">{versions.error.message}</small>}
          {!versions.isLoading && versionRows.length === 0 && <p className="empty-copy">No saved versions yet.</p>}
          {versionRows.length > 0 && (
            <div className="version-drawer-body">
              <div className="version-list" aria-label="Saved note versions">
                {versionRows.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    className={selectedVersion?.version === version.version ? "active" : ""}
                    onClick={() => setSelectedVersionNumber(version.version)}
                  >
                    <strong>
                      v{version.version}
                      {version.version === note.version ? " current" : ""}
                    </strong>
                    <span>{new Date(version.created_at).toLocaleString()}</span>
                  </button>
                ))}
              </div>
              {selectedVersion && (
                <aside className="version-preview" aria-label="Selected version preview">
                  <div>
                    <Badge tone={selectedVersion.version === note.version ? "good" : "info"}>v{selectedVersion.version}</Badge>
                    <small>{new Date(selectedVersion.created_at).toLocaleString()}</small>
                  </div>
                  <p>{noteVersionPreview(selectedVersion)}</p>
                  <Button
                    icon={<RefreshCw size={14} />}
                    variant={canRestoreSelectedVersion ? "primary" : "quiet"}
                    disabled={!canRestoreSelectedVersion || restoreVersion.isPending}
                    onClick={() => restoreVersion.mutate(selectedVersion)}
                  >
                    {restoreVersion.isPending ? "Restoring" : selectedVersion.version === note.version ? "Current version" : `Restore v${selectedVersion.version}`}
                  </Button>
                  {restoreVersion.error && <small className="model-test-error">{restoreVersion.error.message}</small>}
                </aside>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function NoteLaneIntent({ note }: { note: Note }) {
  const intent = noteLaneIntent(note);
  if (!intent) return null;
  const Icon = intent.icon;
  return (
    <div className="note-lane-intent" aria-label="Selected note lane">
      <Icon size={16} />
      <div>
        <Badge tone={intent.tone}>{intent.badge}</Badge>
        <strong>{intent.title}</strong>
        <span>{intent.description}</span>
      </div>
    </div>
  );
}

function transcriptTextFromResult(result: any): string {
  const text = String(result?.text ?? "").trim();
  if (text) return text;
  const segments = Array.isArray(result?.segments) ? result.segments : [];
  return segments
    .map((segment: any) => String(segment?.text ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

const RECORDING_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];

function supportedRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read recorded audio."));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
}

function SourcesView() {
  const queryClient = useQueryClient();
  const selectedSourceId = useUIStore((state) => state.selectedSourceId);
  const selectedSourceBlockId = useUIStore((state) => state.selectedSourceBlockId);
  const setSurface = useUIStore((state) => state.setSurface);
  const setSelectedNoteId = useUIStore((state) => state.setSelectedNoteId);
  const setSelectedSourceId = useUIStore((state) => state.setSelectedSourceId);
  const setSelectedSourceBlockId = useUIStore((state) => state.setSelectedSourceBlockId);
  const requestQuickNote = useUIStore((state) => state.requestQuickNote);
  const sourceDialogRequestId = useUIStore((state) => state.sourceDialogRequestId);
  const sourceDialogDraftText = useUIStore((state) => state.sourceDialogDraftText);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [sourceIntakeMode, setSourceIntakeMode] = useState("paste");
  const [paste, setPaste] = useState("");
  const [title, setTitle] = useState("");
  const [sourceQuery, setSourceQuery] = useState("");
  const [blockQuery, setBlockQuery] = useState("");
  const [copiedBlockId, setCopiedBlockId] = useState("");
  const [lastImportedSourceId, setLastImportedSourceId] = useState("");
  const sources = useQuery({ queryKey: ["sources"], queryFn: () => vaultRequest<Source[]>("sources.list") });
  const sourceRows = sources.data ?? [];
  const filteredSources = useMemo(() => {
    const value = sourceQuery.trim().toLowerCase();
    if (!value) return sourceRows;
    return sourceRows.filter((source) => sourceMatchesFilter(source, value));
  }, [sourceQuery, sourceRows]);
  const selectedSourceInRows = Boolean(selectedSourceId && sourceRows.some((source) => source.id === selectedSourceId));
  const selected = filteredSources.find((source) => source.id === selectedSourceId) ?? filteredSources[0];
  const blocks = useQuery({
    queryKey: ["source-blocks", selected?.id],
    queryFn: () => vaultRequest<SourceBlock[]>("sources.blocks", { sourceId: selected!.id }),
    enabled: Boolean(selected?.id)
  });
  const pipeline = useQuery({
    queryKey: ["source-pipeline", selected?.id],
    queryFn: () => vaultRequest<SourcePipeline>("sources.pipeline", { sourceId: selected!.id }),
    enabled: Boolean(selected?.id)
  });
  const filteredBlocks = useMemo(() => {
    const value = blockQuery.trim().toLowerCase();
    if (!value) return blocks.data ?? [];
    return (blocks.data ?? []).filter((block) => sourceBlockMatches(block, value));
  }, [blockQuery, blocks.data]);
  const selectedBlock = (blocks.data ?? []).find((block) => block.id === selectedSourceBlockId) ?? filteredBlocks[0];
  useEffect(() => {
    if (!selectedSourceId && selected?.id) setSelectedSourceId(selected.id);
    if (selectedSourceId && selectedSourceInRows && selected?.id && selectedSourceId !== selected.id) setSelectedSourceId(selected.id);
  }, [selected?.id, selectedSourceId, selectedSourceInRows, setSelectedSourceId]);
  useEffect(() => {
    if (sourceDialogRequestId > 0) {
      setSourceIntakeMode("paste");
      setPaste(sourceDialogDraftText);
      setTitle("");
      setSourceDialogOpen(true);
    }
  }, [sourceDialogDraftText, sourceDialogRequestId]);
  const importText = useMutation<any, Error>({
    mutationFn: () =>
      vaultRequest("sources.importText", {
        title: title.trim() || sourceTitleFromText(paste),
        type: "text",
        text: paste.trim(),
        metadata: { capture_context: "storage_dialog_paste" }
      }),
    onSuccess: (result) => {
      const sourceId = result?.source?.id ? String(result.source.id) : undefined;
      if (sourceId) {
        setSelectedSourceId(sourceId);
        setSelectedSourceBlockId(undefined);
        setLastImportedSourceId(sourceId);
      }
      setSourceDialogOpen(false);
      setTitle("");
      setPaste("");
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  });
  const importFiles = useMutation<any[], Error>({
    mutationFn: async () => {
      const files = await selectFiles();
      const imported: any[] = [];
      for (const file_path of files) {
        imported.push(await vaultRequest("sources.importFiles", { file_path, metadata: { capture_context: "storage_dialog_file" } }));
      }
      return imported;
    },
    onSuccess: (results) => {
      const sourceId = results
        .map((result) => result?.source?.id)
        .filter(Boolean)
        .map(String)
        .at(-1);
      if (sourceId) {
        setSelectedSourceId(sourceId);
        setSelectedSourceBlockId(undefined);
        setLastImportedSourceId(sourceId);
      }
      if (results.length > 0) setSourceDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  });
  const transcribeAudioFiles = useMutation<any[], Error>({
    mutationFn: async () => {
      const files = await selectAudioFiles();
      const transcribed: any[] = [];
      for (const audio_path of files) {
        transcribed.push(
          await vaultRequest("voice.transcribe", {
            audio_path,
            title: sourceTitleFromPath(audio_path),
            create_source: true,
            local_only: true,
            metadata: { capture_context: "storage_dialog_audio" }
          })
        );
      }
      return transcribed;
    },
    onSuccess: (results) => {
      const sourceId = results
        .map((result) => result?.source_id)
        .filter(Boolean)
        .map(String)
        .at(-1);
      if (sourceId) {
        setSelectedSourceId(sourceId);
        setSelectedSourceBlockId(undefined);
        setLastImportedSourceId(sourceId);
      }
      if (results.length > 0) setSourceDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["voice-audio-assets"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  function savePastedSourceFromShortcut(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
    if (!paste.trim() || importText.isPending) return;
    event.preventDefault();
    importText.mutate();
  }
  const extract = useMutation({
    mutationFn: () => vaultRequest("sources.extract", { sourceId: selected!.id }),
    onSuccess: () => queryClient.invalidateQueries()
  });
  const rechunk = useMutation({
    mutationFn: () => vaultRequest("sources.rechunk", { sourceId: selected!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source-blocks", selected?.id] });
      queryClient.invalidateQueries({ queryKey: ["source-pipeline", selected?.id] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  });
  const reindex = useMutation({
    mutationFn: () => vaultRequest("ai.embeddings.reindex", { source_ids: selected ? [selected.id] : [], auto_start: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source-pipeline", selected?.id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    }
  });
  const createNoteFromBlock = useMutation<Note, Error, SourceBlock>({
    mutationFn: (block) => {
      if (!selected) throw new Error("Select a source before creating an evidence note.");
      const noteTitle = sourceBlockNoteTitle(selected, block);
      return vaultRequest<Note>("notes.create", {
        title: noteTitle,
        content_markdown: sourceBlockNoteMarkdown(selected, block),
        content_json: sourceBlockNoteContent(selected, block, noteTitle),
        origin: "user_written"
      });
    },
    onSuccess: (note) => {
      setSelectedNoteId(note.id);
      setSurface("notes");
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  });
async function copyBlock(block: SourceBlock) {
    await copyTextToClipboard(block.text);
    setCopiedBlockId(block.id);
    window.setTimeout(() => setCopiedBlockId((id) => (id === block.id ? "" : id)), 1600);
  }
  function runPipelineAction(stage: SourcePipelineStage) {
    if (stage.action_route === "review") {
      setSurface("review");
      return;
    }
    if (stage.action_route === "graph") {
      setSurface("graph");
      return;
    }
    if (stage.action_route === "sources.extract") {
      extract.mutate();
      return;
    }
    if (stage.action_route === "sources.rechunk") {
      rechunk.mutate();
      return;
    }
    if (stage.action_route === "ai.embeddings.reindex") {
      reindex.mutate();
    }
  }
  const linkedNoteId = noteIdFromSource(selected);
  function openLinkedNote() {
    if (!linkedNoteId) return;
    setSelectedNoteId(linkedNoteId);
    setSurface("notes");
  }
  const sourceCount = sourceRows.length;
  const blockCount = blocks.data?.length ?? 0;
  const pipelineBusy = extract.isPending || rechunk.isPending || reindex.isPending;
  const firstSourceBlock = (blocks.data ?? [])[0];
  const showImportFollowup = Boolean(selected?.id && selected.id === lastImportedSourceId);
  return (
    <div className="surface split-view storage-view">
      <Panel className="list-pane">
        <SectionHeader
          title="Storage"
          actions={
            <Button icon={<Plus size={16} />} onClick={() => setSourceDialogOpen(true)}>
              Add source
            </Button>
          }
        />
        <div className="source-list-tools">
          <label className="source-list-search">
            <Search size={15} />
            <input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Search Storage" aria-label="Search Storage sources" />
          </label>
          <small>
            {filteredSources.length}/{sourceCount} shown
          </small>
        </div>
        <div className="entity-list">
          {sources.isLoading && <div className="entity-list-empty">Loading Storage...</div>}
          {!sources.isLoading && sourceRows.length === 0 && (
            <div className="entity-list-empty">
              <HardDrive size={18} />
              <strong>No sources</strong>
            </div>
          )}
          {!sources.isLoading && sourceRows.length > 0 && filteredSources.length === 0 && (
            <div className="entity-list-empty">
              <Search size={18} />
              <strong>No matching sources</strong>
              <span>Try another search.</span>
            </div>
          )}
          {filteredSources.map((source) => (
            <button
              key={source.id}
              className={selected?.id === source.id ? "active" : ""}
              title={source.title}
              onClick={() => {
                setSelectedSourceId(source.id);
                setSelectedSourceBlockId(undefined);
              }}
            >
              <strong>{source.title}</strong>
              <span>
                {source.type} source
                {source.created_at ? ` - ${formatTimestamp(source.created_at)}` : ""}
              </span>
            </button>
          ))}
        </div>
      </Panel>
      <Panel className="source-detail">
        <SectionHeader
          title={selected?.title ?? "Select a source"}
          eyebrow={selected?.type}
          actions={
            selected ? (
              <>
              {linkedNoteId && (
                <Button icon={<NotebookPen size={16} />} variant="quiet" onClick={openLinkedNote}>
                  Open note
                </Button>
              )}
              <TaskCreateButton targetType="source" targetId={selected.id} targetTitle={selected.title} />
              <CapsuleAttachButton targetType="source" targetId={selected.id} targetTitle={selected.title} defaultRole="primary_source" showExportPolicy />
              <Button icon={<Sparkles size={16} />} disabled={!selected} onClick={() => extract.mutate()}>
                Find claims
              </Button>
              </>
            ) : undefined
          }
        />
        {selected ? (
          <>
            <div className="source-meta-strip" aria-label="Selected source metadata">
              <Badge tone="info">{selected.type}</Badge>
              <span>{blockCount} block{blockCount === 1 ? "" : "s"}</span>
              {selected.content_hash && <small title={selected.content_hash}>{middleTruncate(selected.content_hash, 36)}</small>}
              {selected.raw_path && <small title={selected.raw_path}>{middleTruncate(selected.raw_path, 56)}</small>}
            </div>
            {showImportFollowup && (
              <div className="source-import-followup" aria-label="Storage import next actions" title={selected.title}>
                <div>
                  <Badge tone="good">Saved to Storage</Badge>
                  <strong>Source saved.</strong>
                </div>
                <div>
                  <Button
                    icon={<NotebookPen size={15} />}
                    variant="primary"
                    disabled={!firstSourceBlock || createNoteFromBlock.isPending}
                    onClick={() => firstSourceBlock && createNoteFromBlock.mutate(firstSourceBlock)}
                  >
                    Start cited note
                  </Button>
                  <Button icon={<Sparkles size={15} />} variant="secondary" disabled={pipelineBusy} onClick={() => extract.mutate()}>
                    Find claims
                  </Button>
                </div>
              </div>
            )}
            <SourcePipelinePanel pipeline={pipeline.data} loading={pipeline.isLoading} busy={pipelineBusy} onStageAction={runPipelineAction} />
            <div className="workflow-toolbar">
              <CapabilityStatus capability="extract_claims" />
              <CapabilityStatus capability="extract_objects" />
              {Boolean(extract.data) && (
                <div className="workflow-result inline">
                  <Badge tone={(extract.data as any).quarantined_items ? "warn" : "good"}>Extraction</Badge>
                  <span>{String((extract.data as any).created_review_items ?? 0)} proposals</span>
                  <small>{String((extract.data as any).quarantined_items ?? 0)} held for review</small>
                </div>
              )}
            </div>
            {rechunk.error && <small className="model-test-error">{rechunk.error.message}</small>}
            {reindex.error && <small className="model-test-error">{reindex.error.message}</small>}
            <div className="source-block-layout">
              <section className="source-block-column" aria-label="Source blocks">
                <div className="source-block-tools">
                  <label className="source-block-search">
                    <Search size={15} />
                    <input value={blockQuery} onChange={(event) => setBlockQuery(event.target.value)} placeholder="Filter blocks" aria-label="Filter source blocks" />
                  </label>
                  <small>
                    {filteredBlocks.length}/{blockCount} shown
                  </small>
                </div>
                <div className="block-list">
                  {filteredBlocks.length === 0 && <p className="empty-copy">No source blocks match this filter.</p>}
                  {filteredBlocks.map((block) => (
                    <button key={block.id} className={block.id === selectedBlock?.id ? "active" : ""} onClick={() => setSelectedSourceBlockId(block.id)}>
                      <span>
                        <Badge>{sourceBlockLocator(block)}</Badge>
                        {block.heading_path && <small>{block.heading_path}</small>}
                      </span>
                      <p>{block.text}</p>
                    </button>
                  ))}
                </div>
              </section>
              <aside className="source-block-inspector" aria-label="Selected source block">
                {selectedBlock ? (
                  <>
                    <div>
                      <Badge tone="good">{sourceBlockLocator(selectedBlock)}</Badge>
                      <strong>Selected evidence</strong>
                      <span>{selected.title}</span>
                    </div>
                    <blockquote>
                      <span>Exact source text</span>
                      {selectedBlock.text}
                    </blockquote>
                    <div className="source-block-actions">
                      <Button
                        icon={<BookOpen size={15} />}
                        variant="primary"
                        disabled={createNoteFromBlock.isPending}
                        onClick={() => createNoteFromBlock.mutate(selectedBlock)}
                      >
                        New note from block
                      </Button>
                      <Button icon={<Copy size={15} />} variant="quiet" onClick={() => void copyBlock(selectedBlock)}>
                        {copiedBlockId === selectedBlock.id ? "Copied" : "Copy quote"}
                      </Button>
                      <TaskCreateButton
                        targetType="source_block"
                        targetId={selectedBlock.id}
                        targetTitle={`${selected.title} ${sourceBlockLocator(selectedBlock)}`}
                        exactQuote={selectedBlock.text}
                        locator={sourceBlockLocator(selectedBlock)}
                      />
                      <CapsuleAttachButton
                        targetType="source_block"
                        targetId={selectedBlock.id}
                        targetTitle={`${selected.title} ${sourceBlockLocator(selectedBlock)}`}
                        defaultRole="evidence"
                        showExportPolicy
                      />
                    </div>
                    {createNoteFromBlock.error && <small className="model-test-error">{createNoteFromBlock.error.message}</small>}
                  </>
                ) : (
                  <p className="empty-copy">Select a block.</p>
                )}
              </aside>
            </div>
          </>
        ) : (
          <div className="surface-empty-state">
            <HardDrive size={20} />
            <strong>No source selected</strong>
          </div>
        )}
      </Panel>
      <Dialog.Root open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content source-intake-dialog" aria-describedby={undefined}>
            <div className="dialog-header">
              <div>
                <Dialog.Title>Add source</Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <Button icon={<X size={15} />} size="icon" variant="quiet" aria-label="Close add source" />
              </Dialog.Close>
            </div>
            <Tabs value={sourceIntakeMode} onValueChange={setSourceIntakeMode} className="source-intake-tabs">
              <TabsList className="source-intake-tab-list" aria-label="Source import method">
                <TabsTrigger value="paste" onClick={() => setSourceIntakeMode("paste")}>
                  <FileText size={15} />
                  <span>
                    <strong>Paste text</strong>
                  </span>
                </TabsTrigger>
                <TabsTrigger value="files" onClick={() => setSourceIntakeMode("files")}>
                  <FolderOpen size={15} />
                  <span>
                    <strong>Files</strong>
                  </span>
                </TabsTrigger>
                <TabsTrigger value="audio" onClick={() => setSourceIntakeMode("audio")}>
                  <Mic size={15} />
                  <span>
                    <strong>Audio</strong>
                  </span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="paste" className="source-intake-panel paste-intake-panel">
                <label className="field source-title-field">
                  <span className="visually-hidden">Source title</span>
                  <Input aria-label="Source title" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label className="field field-fill source-text-field">
                  <span className="visually-hidden">Source text</span>
                  <Textarea aria-label="Source text" placeholder="Paste source material..." value={paste} onChange={(event) => setPaste(event.target.value)} onKeyDown={savePastedSourceFromShortcut} />
                </label>
                {importText.error && <small className="model-test-error">{importText.error.message}</small>}
                <div className="source-intake-actions">
                  <small>{paste.trim().length} characters · ⌘↵</small>
                  <Button icon={<Import size={16} />} variant="primary" disabled={!paste.trim() || importText.isPending} onClick={() => importText.mutate()}>
                    {importText.isPending ? "Saving" : "Save"}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="files" className="source-intake-panel files-intake-panel">
                <div className="file-intake-drop">
                  <FolderOpen size={22} />
                  <Button icon={<FolderOpen size={16} />} variant="primary" disabled={importFiles.isPending} onClick={() => importFiles.mutate()}>
                    {importFiles.isPending ? "Importing" : "Choose files"}
                  </Button>
                </div>
                {importFiles.error && <small className="model-test-error">{importFiles.error.message}</small>}
              </TabsContent>
              <TabsContent value="audio" className="source-intake-panel files-intake-panel">
                <div className="file-intake-drop">
                  <Mic size={22} />
                  <Button icon={<Mic size={16} />} variant="primary" disabled={transcribeAudioFiles.isPending} onClick={() => transcribeAudioFiles.mutate()}>
                    {transcribeAudioFiles.isPending ? "Transcribing" : "Choose audio"}
                  </Button>
                </div>
                {transcribeAudioFiles.error && <small className="model-test-error">{transcribeAudioFiles.error.message}</small>}
              </TabsContent>
            </Tabs>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function SourcePipelinePanel({
  pipeline,
  loading,
  busy,
  onStageAction
}: {
  pipeline?: SourcePipeline;
  loading: boolean;
  busy: boolean;
  onStageAction: (stage: SourcePipelineStage) => void;
}) {
  if (loading) {
    return (
      <section className="source-pipeline-panel" aria-label="Source pipeline">
        <div className="source-pipeline-header">
          <div>
            <strong>Source status</strong>
            <span>Checking Storage state...</span>
          </div>
          <Badge tone="info">loading</Badge>
        </div>
      </section>
    );
  }
  if (!pipeline || !Array.isArray(pipeline.stages)) return null;
  const openWork = pipeline.pending_review_items + pipeline.needs_edit_review_items;
  const shouldOpen = openWork > 0 || pipeline.stages.some((stage) => stage.status === "ready" || stage.status === "blocked");
  return (
    <details className="source-pipeline-panel" aria-label="Source pipeline" open={shouldOpen}>
      <summary className="source-pipeline-header">
        <div>
          <strong>Source status</strong>
          <span>{pipeline.source_type} / {pipeline.source_status}</span>
        </div>
        <div>
          <Badge tone="info">{pipeline.block_count} blocks</Badge>
          <Badge tone={openWork ? "warn" : "neutral"}>{openWork} review</Badge>
          <Badge tone={pipeline.approved_claims ? "good" : "neutral"}>{pipeline.approved_claims} claims</Badge>
        </div>
      </summary>
      <div className="source-pipeline-steps" aria-label="Source status steps">
        {pipeline.stages.map((stage) => (
          <article key={stage.id} className={stage.status}>
            <div>
              <Badge tone={sourcePipelineTone(stage.status)}>{sourcePipelineLabel(stage.status)}</Badge>
              <strong>{stage.label}</strong>
            </div>
            <p>{sourcePipelineDetail(stage, pipeline)}</p>
            {stage.action_label && (
              <Button size="sm" variant={stage.status === "ready" ? "primary" : "quiet"} disabled={busy} onClick={() => onStageAction(stage)}>
                {busy ? "Working" : stage.action_label}
              </Button>
            )}
          </article>
        ))}
      </div>
      {pipeline.latest_extraction_job && (
        <small className="source-pipeline-footnote">
          Latest extraction {pipeline.latest_extraction_job.status} / {pipeline.latest_extraction_job.created_review_items} proposals
          {pipeline.latest_extraction_job.quarantined_items ? ` / ${pipeline.latest_extraction_job.quarantined_items} held for review` : ""}
        </small>
      )}
    </details>
  );
}

function sourcePipelineTone(status: SourcePipelineStage["status"]): "neutral" | "good" | "warn" | "bad" | "info" {
  if (status === "done") return "good";
  if (status === "ready") return "warn";
  if (status === "blocked") return "bad";
  return "neutral";
}

function sourcePipelineLabel(status: SourcePipelineStage["status"]): string {
  if (status === "done") return "done";
  if (status === "ready") return "ready";
  if (status === "blocked") return "blocked";
  return "pending";
}

function sourcePipelineDetail(stage: SourcePipelineStage, pipeline: SourcePipeline): string {
  if (stage.id === "indexed") {
    const blocks = pipeline.block_count;
    const indexed = pipeline.embedded_block_count;
    const exactLabel = `${blocks} source block${blocks === 1 ? "" : "s"} searchable`;
    const smartLabel = `${indexed}/${blocks} ready for smart search`;
    return `${exactLabel}; ${smartLabel}.`;
  }
  return stage.detail;
}

function sourceTitleFromText(text: string): string {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const title = firstLine || "Pasted source";
  return title.length > 80 ? `${title.slice(0, 77)}...` : title;
}

function sourceTitleFromPath(filePath: string): string {
  const filename = filePath.split(/[\\/]/).pop() ?? "Audio source";
  const title = filename.replace(/\.[^.]+$/, "").trim() || "Audio source";
  return title.length > 80 ? `${title.slice(0, 77)}...` : title;
}

function middleTruncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 7) return `${value.slice(0, Math.max(1, maxLength - 3))}...`;
  const edge = Math.floor((maxLength - 3) / 2);
  const start = value.slice(0, edge);
  const end = value.slice(value.length - (maxLength - 3 - edge));
  return `${start}...${end}`;
}

function sourceBlockLocator(block: SourceBlock): string {
  return block.locator || `Block ${block.block_index + 1}`;
}

function noteIdFromSource(source?: Source): string {
  if (!source || source.type !== "note") return "";
  const noteId = source.metadata?.note_id;
  return typeof noteId === "string" ? noteId.trim() : "";
}

function sourceMatchesFilter(source: Source, query: string): boolean {
  const metadata = source.metadata ? Object.values(source.metadata).map((value) => String(value)) : [];
  return [source.title, source.type, source.raw_path, source.content_hash, ...metadata]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function sourceBlockMatches(block: SourceBlock, query: string): boolean {
  return [block.text, block.locator, block.heading_path, String(block.block_index + 1)]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function sourceBlockNoteTitle(source: Source, block: SourceBlock): string {
  const suffix = sourceBlockLocator(block);
  const title = `${source.title} - ${suffix}`;
  return title.length > 90 ? `${title.slice(0, 87)}...` : title;
}

function sourceBlockNoteMarkdown(source: Source, block: SourceBlock): string {
  return `${sourceBlockNoteTitle(source, block)}\n\n${block.text}\n\nNotes:\n`;
}

function sourceBlockNoteContent(source: Source, block: SourceBlock, title: string): Record<string, unknown> {
  return {
    capture_mode: "source_block_note",
    source_ids: [source.id],
    source_block_ids: [block.id],
    citations: [
      {
        source_id: source.id,
        source_block_id: block.id,
        title: source.title,
        locator: sourceBlockLocator(block),
        source_quote: block.text
      }
    ],
    editor_doc: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: title }]
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: block.text }]
            }
          ]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Notes:" }]
        },
        { type: "paragraph" }
      ]
    }
  };
}

function reviewItemTone(itemType: string): "good" | "warn" | "bad" | "info" | "neutral" {
  if (itemType === "extraction_quarantine") return "warn";
  if (itemType === "new_claim") return "info";
  if (itemType.startsWith("capsule_import_")) return "info";
  if (itemType === "assistant_missing_evidence") return "bad";
  if (itemType === "learning_deck") return "good";
  return "neutral";
}

function reviewItemLabel(itemType: string): string {
  if (itemType.startsWith("capsule_import_")) return "Import";
  return itemType.replace(/_/g, " ");
}

function reviewDecisionPrompt(item: ReviewItem): string {
  if (item.item_type === "new_claim") return "Approve only if the exact quote supports the claim.";
  if (item.item_type === "new_object" || item.item_type === "new_concept") return "Approve if this object should become active graph knowledge.";
  if (item.item_type.startsWith("capsule_import_")) return "Approve to merge this imported item into the workspace. Imported claims stay weak until evidence is reviewed.";
  if (item.item_type === "assistant_missing_evidence") return "Reject after you have handled the missing-evidence follow-up, or leave pending.";
  if (item.item_type === "learning_deck") return "Approve to add these learning items.";
  return item.status === "pending" ? "Record why this proposal is accepted or rejected." : "Decision already recorded.";
}

function reviewEvidenceTarget(item?: ReviewItem): { sourceId?: string; sourceBlockId?: string; claimId?: string } {
  const payload = item?.payload ?? {};
  const sourceIds = stringList(payload.source_ids);
  const sourceRefs = stringList(payload.source_refs);
  const citations = Array.isArray(payload.citations) ? payload.citations : [];
  const firstCitation = citations.find((citation) => Boolean(citation?.source_id || citation?.source_block_id));
  return {
    sourceId: String(payload.source_id ?? firstCitation?.source_id ?? sourceIds[0] ?? sourceRefs[0] ?? ""),
    sourceBlockId: String(payload.source_block_id ?? payload.source_block_id_target ?? firstCitation?.source_block_id ?? ""),
    claimId: String(payload.claim_id ?? firstCitation?.claim_id ?? "")
  };
}

function reviewItemSearchText(item: ReviewItem): string {
  const payload = item.payload ?? {};
  const citations = Array.isArray(payload.citations) ? payload.citations : [];
  return [
    item.id,
    item.title,
    item.summary,
    item.item_type,
    item.status,
    item.created_by_job_id,
    payload.source_id,
    payload.source_block_id,
    payload.claim_id,
    payload.ai_run_id,
    payload.model_id,
    payload.provider_id,
    payload.merge_action_preview,
    payload.merge_summary,
    ...stringList(payload.source_ids),
    ...stringList(payload.source_refs),
    ...stringList(payload.tags),
    ...citations.flatMap((citation) => [citation?.source_id, citation?.source_block_id, citation?.claim_id])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function reviewScopeLabel(item: ReviewItem): string {
  const payload = item.payload ?? {};
  const sourceId = String(payload.source_id ?? stringList(payload.source_ids)[0] ?? stringList(payload.source_refs)[0] ?? "");
  const claimId = String(payload.claim_id ?? "");
  if (item.created_by_job_id) return `job ${shortIdentifier(item.created_by_job_id)}`;
  if (payload.capsule_import_id) return `import ${shortIdentifier(String(payload.capsule_import_id))}`;
  if (sourceId) return `source ${shortIdentifier(sourceId)}`;
  if (claimId) return `claim ${shortIdentifier(claimId)}`;
  return "manual";
}

function reviewPayloadModelLabel(payload: Record<string, unknown>): string {
  if (!payload.model_id && !payload.provider_id) return "";
  return payload.sent_off_device === true ? "Off-device model" : "Local model";
}

function reviewPayloadBlockLabel(payload: Record<string, unknown>): string {
  return payload.source_block_id ? "Source block" : "";
}

function capsuleImportMergePreview(payload: Record<string, unknown>): Record<string, unknown> | null {
  if (payload.type !== "capsule_import") return null;
  return payload.merge_preview && typeof payload.merge_preview === "object"
    ? (payload.merge_preview as Record<string, unknown>)
    : null;
}

function capsuleImportMergeActionLabel(action: unknown): string {
  const value = String(action || "");
  if (value === "linked_existing") return "Link existing";
  if (value === "created_disabled") return "Create disabled tool";
  if (value === "created") return "Create new";
  return value ? capsuleOptionLabel(value) : "Review first";
}

function capsuleImportMergeTone(action: unknown): "good" | "warn" | "bad" | "info" | "neutral" {
  const value = String(action || "");
  if (value === "linked_existing") return "good";
  if (value === "created_disabled") return "warn";
  if (value === "created") return "info";
  return "neutral";
}

function capsuleImportChangedFields(preview: Record<string, unknown> | null): Array<Record<string, unknown>> {
  const comparison = preview?.comparison;
  return Array.isArray(comparison) ? comparison.filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).changed === true) as Array<Record<string, unknown>> : [];
}

function shortIdentifier(value: string): string {
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function claimStatusTone(status?: string): "good" | "warn" | "bad" | "info" | "neutral" {
  if (!status) return "neutral";
  if (["supported", "verified", "user_confirmed"].includes(status)) return "good";
  if (["contradicted", "rejected"].includes(status)) return "bad";
  if (["weakly_supported", "needs_review"].includes(status)) return "warn";
  return "info";
}

function percentLabel(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return "0%";
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function claimMatches(claim: Claim, query: string): boolean {
  return [claim.title, claim.normalized_text, claim.status, claim.id]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function ReviewPayloadSummary({ item }: { item: ReviewItem }) {
  const payload = item.payload ?? {};
  const confidence = payload.confidence == null ? null : Number(payload.confidence);
  const tags = stringList(payload.tags);
  const actions = stringList(payload.actions);
  const cards = Array.isArray(payload.cards) ? payload.cards : [];
  const learningItems = Array.isArray(payload.items) ? payload.items : [];
  const importMergePreview = capsuleImportMergePreview(payload);
  const changedImportFields = capsuleImportChangedFields(importMergePreview);
  return (
    <div className="review-proposal">
      <div className="review-proposal-header">
        <Badge tone={reviewItemTone(item.item_type)}>{reviewItemLabel(item.item_type)}</Badge>
        {payload.type && <Badge>{String(payload.type)}</Badge>}
        {payload.language && <Badge>{String(payload.language)}</Badge>}
        {confidence != null && Number.isFinite(confidence) && <Badge tone={confidence >= 0.75 ? "good" : confidence >= 0.45 ? "warn" : "bad"}>{Math.round(confidence * 100)}%</Badge>}
      </div>
      {importMergePreview && (
        <section className="review-import-merge" aria-label="Capsule import merge preview">
          <span>Merge preview</span>
          <div className="review-import-merge-line">
            <Badge tone={capsuleImportMergeTone(importMergePreview.action)}>{capsuleImportMergeActionLabel(importMergePreview.action)}</Badge>
            <p>{String(importMergePreview.summary || payload.merge_summary || "Review before merging this imported item.")}</p>
          </div>
          <div className="review-meta-row">
            {payload.import_target_type && <small>{capsuleOptionLabel(String(payload.import_target_type))}</small>}
            {payload.import_target_id && <small title={String(payload.import_target_id)}>import {shortIdentifier(String(payload.import_target_id))}</small>}
            {importMergePreview.canonical_target_id && <small title={String(importMergePreview.canonical_target_id)}>local {shortIdentifier(String(importMergePreview.canonical_target_id))}</small>}
          </div>
          {changedImportFields.length > 0 && (
            <div className="review-import-diff" aria-label="Capsule import conflict comparison">
              {changedImportFields.slice(0, 4).map((field) => (
                <div key={String(field.field || field.label)}>
                  <span>{String(field.label || field.field)}</span>
                  <p title={String(field.imported || "")}>{String(field.imported || "Empty")}</p>
                  <p title={String(field.local || "")}>{String(field.local || "Empty")}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {payload.body && (
        <section>
          <span>Proposal</span>
          <p>{String(payload.body)}</p>
        </section>
      )}
      {payload.question && (
        <section>
          <span>Question</span>
          <p>{String(payload.question)}</p>
        </section>
      )}
      {payload.answer_preview && (
        <section>
          <span>Answer preview</span>
          <p>{String(payload.answer_preview)}</p>
        </section>
      )}
      {payload.reason && (
        <section>
          <span>Reason</span>
          <p>{String(payload.reason).replace(/_/g, " ")}</p>
        </section>
      )}
      {payload.suggested_status && (
        <section>
          <span>Status change</span>
          <p>
            {String(payload.current_status ?? "current").replace(/_/g, " ")} to {String(payload.suggested_status).replace(/_/g, " ")}
          </p>
        </section>
      )}
      {Array.isArray(payload.node_ids) && payload.node_ids.length > 0 && (
        <section>
          <span>Graph nodes</span>
          <p>{payload.node_ids.length} node{payload.node_ids.length === 1 ? "" : "s"} need comparison before any merge.</p>
        </section>
      )}
      {payload.validation_error && (
        <section className="review-validation">
          <Badge tone="warn">validation</Badge>
          <p>{String(payload.validation_error)}</p>
        </section>
      )}
      {payload.suggested_source_quote && (
        <blockquote>
          <span>Nearest source text</span>
          {String(payload.suggested_source_quote)}
        </blockquote>
      )}
      {payload.source_quote && (
        <blockquote>
          <span>Exact quote</span>
          {String(payload.source_quote)}
        </blockquote>
      )}
      {(learningItems.length > 0 || cards.length > 0) && (
        <section>
          <span>Learning items</span>
          <p>{learningItems.length || cards.length} item{(learningItems.length || cards.length) === 1 ? "" : "s"} proposed.</p>
        </section>
      )}
      {actions.length > 0 && (
        <section>
          <span>Next actions</span>
          <ul>
            {actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </section>
      )}
      {tags.length > 0 && (
        <div className="review-tag-row">
          {tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
      )}
      <div className="review-meta-row">
        {payload.source_block_id && <small title={String(payload.source_block_id)}>{reviewPayloadBlockLabel(payload)}</small>}
        {payload.ai_run_id && <small title={String(payload.ai_run_id)}>{generatedRunLabel(payload.ai_run_id)}</small>}
        {(payload.model_id || payload.provider_id) && (
          <small title={[payload.provider_id, payload.model_id].filter(Boolean).map(String).join(" / ")}>{reviewPayloadModelLabel(payload)}</small>
        )}
      </div>
    </div>
  );
}

function ReviewView() {
  const queryClient = useQueryClient();
  const setSurface = useUIStore((state) => state.setSurface);
  const selectedReviewItemId = useUIStore((state) => state.selectedReviewItemId);
  const setSelectedReviewItemId = useUIStore((state) => state.setSelectedReviewItemId);
  const setSelectedSourceId = useUIStore((state) => state.setSelectedSourceId);
  const setSelectedSourceBlockId = useUIStore((state) => state.setSelectedSourceBlockId);
  const setSelectedClaimId = useUIStore((state) => state.setSelectedClaimId);
  const [statusFilter, setStatusFilter] = useState<"pending" | "dismissed">("pending");
  const [typeFilter, setTypeFilter] = useState("all");
  const [scopeQuery, setScopeQuery] = useState("");
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  const [decisionNote, setDecisionNote] = useState("");
  const [bulkDecisionNote, setBulkDecisionNote] = useState("");
  const [reviewCapsuleId, setReviewCapsuleId] = useState("none");
  function selectReviewStatus(status: "pending" | "dismissed") {
    setStatusFilter(status);
    setSelectedReviewItemId(undefined);
  }
  const review = useQuery({
    queryKey: ["review", statusFilter],
    queryFn: () => vaultRequest<ReviewItem[]>("review.list", { status: statusFilter })
  });
  const capsules = useQuery({
    queryKey: ["capsules", "review"],
    queryFn: () => vaultRequest<CapsuleListResponse>("capsules.list", { limit: 100 }),
    enabled: statusFilter === "pending"
  });
  const reviewItems = useMemo(() => review.data ?? [], [review.data]);
  const itemTypes = useMemo(() => Array.from(new Set(reviewItems.map((reviewItem) => reviewItem.item_type))).sort(), [reviewItems]);
  const visibleReviewItems = useMemo(() => {
    const query = scopeQuery.trim().toLowerCase();
    return reviewItems.filter((reviewItem) => {
      const typeMatches = typeFilter === "all" || reviewItem.item_type === typeFilter;
      const queryMatches = !query || reviewItemSearchText(reviewItem).includes(query);
      return typeMatches && queryMatches;
    });
  }, [reviewItems, scopeQuery, typeFilter]);
  const item = visibleReviewItems.find((reviewItem) => reviewItem.id === selectedReviewItemId) ?? visibleReviewItems[0];
  const pendingVisibleItems = visibleReviewItems.filter((reviewItem) => reviewItem.status === "pending");
  const selectedPendingItems = pendingVisibleItems.filter((reviewItem) => selectedReviewIds.includes(reviewItem.id));
  const allVisibleSelected = pendingVisibleItems.length > 0 && pendingVisibleItems.every((reviewItem) => selectedReviewIds.includes(reviewItem.id));
  const pendingCount = reviewItems.filter((reviewItem) => reviewItem.status === "pending").length;
  useEffect(() => {
    setDecisionNote("");
    setReviewCapsuleId("none");
  }, [item?.id]);
  useEffect(() => {
    setSelectedReviewIds([]);
    setBulkDecisionNote("");
    setScopeQuery("");
    setTypeFilter("all");
  }, [statusFilter]);
  useEffect(() => {
    const pendingIds = new Set(reviewItems.filter((reviewItem) => reviewItem.status === "pending").map((reviewItem) => reviewItem.id));
    setSelectedReviewIds((ids) => ids.filter((id) => pendingIds.has(id)));
  }, [reviewItems]);
  const approve = useMutation({
    mutationFn: async (reviewItem: ReviewItem) => {
      const result: any = await vaultRequest("review.approve", { itemId: reviewItem.id, data: { decision_note: decisionNote.trim() || "Approved after evidence review" } });
      const claimId = result?.created?.claim_id ? String(result.created.claim_id) : "";
      if (claimId && reviewCapsuleId !== "none") {
        await vaultRequest("capsules.addItems", {
          capsuleId: reviewCapsuleId,
          items: [
            {
              target_type: "claim",
              target_id: claimId,
              role: "core",
              include_mode: "reference",
              auto_include_evidence: true
            }
          ]
        });
      }
      return result;
    },
    onSuccess: () => {
      setDecisionNote("");
      setReviewCapsuleId("none");
      queryClient.invalidateQueries();
    }
  });
  const reject = useMutation({
    mutationFn: (reviewItem: ReviewItem) =>
      vaultRequest("review.reject", { itemId: reviewItem.id, data: { decision_note: decisionNote.trim() || "Rejected after evidence review" } }),
    onSuccess: () => {
      setDecisionNote("");
      queryClient.invalidateQueries();
    }
  });
  const bulkReview = useMutation({
    mutationFn: (action: "approve" | "reject") =>
      vaultRequest("review.bulk", {
        action,
        item_ids: selectedPendingItems.map((reviewItem) => reviewItem.id),
        decision_note: bulkDecisionNote.trim() || `Bulk ${action} after evidence review`
      }),
    onSuccess: () => {
      setSelectedReviewIds([]);
      setBulkDecisionNote("");
      setDecisionNote("");
      queryClient.invalidateQueries();
    }
  });
  const target = reviewEvidenceTarget(item);
  function toggleReviewSelection(reviewItemId: string, checked: boolean) {
    setSelectedReviewIds((ids) => (checked ? Array.from(new Set([...ids, reviewItemId])) : ids.filter((id) => id !== reviewItemId)));
  }
  function selectVisibleReviewItems() {
    setSelectedReviewIds(pendingVisibleItems.map((reviewItem) => reviewItem.id));
  }
  function openReviewEvidence() {
    if (target.sourceId) {
      setSelectedSourceId(target.sourceId);
      setSelectedSourceBlockId(target.sourceBlockId || undefined);
      setSurface("sources");
    } else if (target.claimId) {
      setSelectedClaimId(target.claimId);
      setSurface("graph");
    }
  }
  return (
    <div className="surface review-layout">
      <Panel className="review-list">
        <SectionHeader title="Review" />
        <Tabs value={statusFilter} onValueChange={(value) => selectReviewStatus(value as "pending" | "dismissed")} className="review-tabs">
          <TabsList aria-label="Review status">
            <TabsTrigger value="pending" onClick={() => selectReviewStatus("pending")}>
              To decide
            </TabsTrigger>
            <TabsTrigger value="dismissed" onClick={() => selectReviewStatus("dismissed")}>
              Rejected
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="review-decision-summary" aria-label="Review decision summary">
          <Badge tone={pendingCount ? "warn" : "good"}>{pendingCount ? `${pendingCount} to decide` : "clear"}</Badge>
          <div>
            <span>
              {selectedPendingItems.length
                ? `${selectedPendingItems.length} selected for one shared decision.`
                : `${visibleReviewItems.length} visible proposal${visibleReviewItems.length === 1 ? "" : "s"}.`}
            </span>
          </div>
        </div>
        <div className="review-filter-bar">
          <label className="field">
            <span>Kind</span>
            <SelectRoot value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger aria-label="Proposal kind">
                <SelectValue placeholder="All proposals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All proposals</SelectItem>
                {itemTypes.map((itemType) => (
                  <SelectItem key={itemType} value={itemType}>
                    {reviewItemLabel(itemType)}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
          </label>
          <label className="field">
            <span>Find</span>
            <Input aria-label="Find review proposals" value={scopeQuery} placeholder="Title, source, quote, model" onChange={(event) => setScopeQuery(event.target.value)} />
          </label>
        </div>
        {statusFilter === "pending" && pendingVisibleItems.length > 0 && (
          <div className="review-bulk-panel" aria-label="Shared decision actions">
            <div className="review-bulk-summary">
              <strong>{selectedPendingItems.length} selected</strong>
              <span>{pendingVisibleItems.length} visible to decide</span>
              <div>
                <button type="button" onClick={allVisibleSelected ? () => setSelectedReviewIds([]) : selectVisibleReviewItems}>
                  {allVisibleSelected ? "Clear selection" : "Select visible"}
                </button>
              </div>
            </div>
            {selectedPendingItems.length > 0 && (
              <>
                <Textarea
                  aria-label="Bulk decision note"
                  value={bulkDecisionNote}
                  placeholder="Why these proposals should share one decision."
                  onChange={(event) => setBulkDecisionNote(event.target.value)}
                />
                <div className="review-bulk-actions">
                <div>
                  <Button variant="primary" disabled={bulkReview.isPending} onClick={() => bulkReview.mutate("approve")}>
                      Approve selected
                    </Button>
                    <Button variant="danger" disabled={bulkReview.isPending} onClick={() => bulkReview.mutate("reject")}>
                      Reject selected
                    </Button>
                  </div>
                </div>
                {bulkReview.error && <small className="model-test-error">{bulkReview.error.message}</small>}
              </>
            )}
          </div>
        )}
        {reviewItems.length === 0 && <p className="empty-copy">Review is clear.</p>}
        {reviewItems.length > 0 && visibleReviewItems.length === 0 && <p className="empty-copy">No review items match these filters.</p>}
        {visibleReviewItems.map((reviewItem) => {
          const selectable = statusFilter === "pending" && reviewItem.status === "pending";
          const selected = selectedReviewIds.includes(reviewItem.id);
          const cardClassName = ["review-card", item?.id === reviewItem.id ? "active" : "", selectable ? "selectable" : ""].filter(Boolean).join(" ");
          return (
            <article key={reviewItem.id} className={cardClassName}>
              {selectable && (
                <label className="review-select-control">
                  <Checkbox
                    aria-label={`Select ${reviewItem.title}`}
                    checked={selected}
                    onCheckedChange={(checked) => toggleReviewSelection(reviewItem.id, checked === true)}
                  />
                </label>
              )}
              <button type="button" className="review-card-main" onClick={() => setSelectedReviewItemId(reviewItem.id)}>
                <Badge tone={reviewItemTone(reviewItem.item_type)}>{reviewItemLabel(reviewItem.item_type)}</Badge>
                <strong title={reviewItem.title}>{reviewItem.title}</strong>
                <span title={reviewItem.summary}>{reviewItem.summary}</span>
                <div className="review-list-meta">
                  <small title={reviewItem.payload?.model_id ? String(reviewItem.payload.model_id) : undefined}>
                    {reviewItem.payload?.model_id ? `${reviewPayloadModelLabel(reviewItem.payload)} - ` : ""}
                    {formatTimestamp(reviewItem.created_at)}
                  </small>
                  <small>{reviewScopeLabel(reviewItem)}</small>
                </div>
              </button>
            </article>
          );
        })}
      </Panel>
      <Panel className="review-detail">
        {item ? (
          <>
            <SectionHeader
              title={item.title}
              eyebrow={reviewItemLabel(item.item_type)}
              actions={
                item ? (
                  <>
                    {(target.sourceId || target.claimId) && (
                      <Button icon={<Link2 size={16} />} variant="quiet" onClick={openReviewEvidence}>
                        Open evidence
                      </Button>
                    )}
                    <TaskCreateButton targetType="review_item" targetId={item.id} targetTitle={item.title} />
                    {item.status === "pending" && (
                      <>
                        <Button icon={<Check size={16} />} variant="primary" disabled={approve.isPending || reject.isPending} onClick={() => approve.mutate(item)}>
                          {approve.isPending ? "Approving" : "Approve"}
                        </Button>
                        <Button icon={<X size={16} />} variant="danger" disabled={approve.isPending || reject.isPending} onClick={() => reject.mutate(item)}>
                          {reject.isPending ? "Rejecting" : "Reject"}
                        </Button>
                      </>
                    )}
                  </>
                ) : undefined
              }
            />
            {item.item_type === "extraction_quarantine" && (
              <div className="workflow-result">
                <Badge tone="warn">Held for review</Badge>
                <span>{item.payload?.validation_error ?? "Invalid model output"}</span>
                <small>{item.payload?.ai_run_id}</small>
              </div>
            )}
            <p className="detail-summary">{item.summary}</p>
            <ReviewPayloadSummary item={item} />
            {item.status === "pending" && (
              <div className="review-decision-panel">
                {item.item_type === "new_claim" && (capsules.data?.items?.length ?? 0) > 0 && (
                  <label className="field">
                    <span>Capsule</span>
                    <SelectRoot value={reviewCapsuleId} onValueChange={setReviewCapsuleId}>
                      <SelectTrigger aria-label="Add approved claim to capsule">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {(capsules.data?.items ?? []).map((capsule) => (
                          <SelectItem key={capsule.id} value={capsule.id}>
                            {capsule.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </SelectRoot>
                  </label>
                )}
                <label className="field">
                  <span>Why this decision?</span>
                  <Textarea
                    aria-label="Decision reason"
                    value={decisionNote}
                    placeholder={reviewDecisionPrompt(item)}
                    onChange={(event) => setDecisionNote(event.target.value)}
                  />
                </label>
                <small>{reviewDecisionPrompt(item)}</small>
                {approve.error && <small className="model-test-error">{approve.error.message}</small>}
                {reject.error && <small className="model-test-error">{reject.error.message}</small>}
              </div>
            )}
            <details className="payload-view">
              <summary>Technical details</summary>
              <pre>{JSON.stringify(item.payload, null, 2)}</pre>
            </details>
          </>
        ) : (
          <p className="empty-copy">Review is clear.</p>
        )}
      </Panel>
    </div>
  );
}

type CapsuleAddTargetType = "note" | "source" | "source_block" | "claim" | "kg_node" | "learning_item" | "tool";
type TaskContextTargetType =
  | "note"
  | "source"
  | "source_block"
  | "claim"
  | "kg_node"
  | "review_item"
  | "capsule"
  | "learning_item"
  | "tool"
  | "lab_job"
  | "assistant_answer";

type TaskCreateButtonProps = {
  targetType: TaskContextTargetType;
  targetId: string;
  targetTitle: string;
  defaultTitle?: string;
  relation?: string;
  exactQuote?: string | null;
  locator?: string | null;
  metadata?: Record<string, unknown>;
  buttonLabel?: string;
  buttonAriaLabel?: string;
  buttonTitle?: string;
  buttonSize?: "default" | "sm" | "icon";
  buttonVariant?: "primary" | "secondary" | "quiet" | "danger";
};

function TaskCreateButton({
  targetType,
  targetId,
  targetTitle,
  defaultTitle,
  relation = "follow_up",
  exactQuote,
  locator,
  metadata,
  buttonLabel = "Task",
  buttonAriaLabel,
  buttonTitle,
  buttonSize = "default",
  buttonVariant = "quiet"
}: TaskCreateButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(defaultTitle ?? taskDefaultTitle(targetType, targetTitle));
  useEffect(() => {
    if (open) setText(defaultTitle ?? taskDefaultTitle(targetType, targetTitle));
  }, [defaultTitle, open, targetId, targetTitle, targetType]);
  const createTask = useMutation({
    mutationFn: () =>
      vaultRequest<TodoItem>("todos.create", {
        text: text.trim(),
        provenance: { created_from: targetType },
        context_links: [
          {
            target_type: targetType,
            target_id: targetId,
            target_title: targetTitle,
            relation,
            exact_quote: exactQuote || undefined,
            locator: locator || undefined,
            metadata: metadata ?? {}
          }
        ]
      }),
    onSuccess: () => {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          icon={<List size={15} />}
          variant={buttonVariant}
          size={buttonSize}
          aria-label={buttonAriaLabel ?? buttonLabel}
          title={buttonTitle ?? buttonAriaLabel ?? buttonLabel}
        >
          {buttonSize === "icon" ? undefined : buttonLabel}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content task-context-dialog" aria-describedby={undefined}>
          <div className="dialog-header">
            <div>
              <Dialog.Title>New task</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="dialog-close" aria-label="Close task dialog">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <div className="task-context-target">
            <Badge>{capsuleOptionLabel(targetType)}</Badge>
            <strong title={targetTitle}>{targetTitle}</strong>
          </div>
          <form
            className="task-context-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (text.trim() && !createTask.isPending) createTask.mutate();
            }}
          >
            <Input aria-label="Task title" value={text} placeholder="Task" onChange={(event) => setText(event.target.value)} />
            {createTask.error && <small className="model-test-error">{createTask.error.message}</small>}
            <div className="task-context-actions">
              <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!text.trim() || createTask.isPending}>
                {createTask.isPending ? "Saving" : "Save"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function taskDefaultTitle(targetType: TaskContextTargetType, targetTitle: string): string {
  const title = targetTitle.trim();
  if (targetType === "review_item") return `Review ${title}`;
  if (targetType === "source" || targetType === "source_block") return `Check ${title}`;
  if (targetType === "assistant_answer") return `Follow up on ${title}`;
  return `Follow up: ${title}`;
}

type CapsuleAttachButtonProps = {
  targetType: CapsuleAddTargetType;
  targetId: string;
  targetTitle: string;
  buttonLabel?: string;
  defaultRole?: string;
  showExportPolicy?: boolean;
  autoIncludeEvidence?: boolean;
};

const capsuleAttachRoles = ["core", "supporting", "context", "primary_source", "evidence", "reference"];
const capsuleSourcePolicies = ["reference_only", "metadata_and_quotes", "extracted_text_only", "full_sources_private"];

function CapsuleAttachButton({
  targetType,
  targetId,
  targetTitle,
  buttonLabel = "Capsule",
  defaultRole = "supporting",
  showExportPolicy = false,
  autoIncludeEvidence = targetType === "claim"
}: CapsuleAttachButtonProps) {
  const queryClient = useQueryClient();
  const setSurface = useUIStore((state) => state.setSurface);
  const [open, setOpen] = useState(false);
  const [capsuleId, setCapsuleId] = useState("none");
  const [role, setRole] = useState(defaultRole);
  const [exportPolicy, setExportPolicy] = useState("reference_only");
  const [includeEvidence, setIncludeEvidence] = useState(autoIncludeEvidence);
  const capsules = useQuery({
    queryKey: ["capsules", "attach"],
    queryFn: () => vaultRequest<CapsuleListResponse>("capsules.list", { limit: 100 }),
    enabled: open
  });
  const rows = capsules.data?.items ?? [];

  useEffect(() => {
    if (!open) return;
    setRole(defaultRole);
    setExportPolicy("reference_only");
    setIncludeEvidence(autoIncludeEvidence);
  }, [autoIncludeEvidence, defaultRole, open, targetId]);

  useEffect(() => {
    if (!open) return;
    if (capsuleId === "none" && rows[0]?.id) setCapsuleId(rows[0].id);
    if (capsuleId !== "none" && rows.length > 0 && !rows.some((capsule) => capsule.id === capsuleId)) setCapsuleId(rows[0].id);
  }, [capsuleId, open, rows]);

  const addItem = useMutation({
    mutationFn: () =>
      vaultRequest("capsules.addItems", {
        capsuleId,
        items: [
          {
            target_type: targetType,
            target_id: targetId,
            role,
            include_mode: "reference",
            export_policy: showExportPolicy ? exportPolicy : undefined,
            auto_include_evidence: targetType === "claim" && includeEvidence
          }
        ]
      }),
    onSuccess: () => {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["capsules"] });
      queryClient.invalidateQueries({ queryKey: ["capsule"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  });

  function openCapsulesSurface() {
    setOpen(false);
    setSurface("capsules");
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" icon={<Archive size={15} />} variant="quiet">
          {buttonLabel}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content capsule-attach-dialog" aria-describedby={undefined}>
          <div className="dialog-header">
            <div>
              <Dialog.Title>Add to capsule</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="dialog-close" aria-label="Close capsule dialog">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <div className="capsule-attach-target">
            <Badge>{capsuleOptionLabel(targetType)}</Badge>
            <strong title={targetTitle}>{targetTitle}</strong>
          </div>
          {capsules.isLoading ? (
            <p className="empty-copy">Loading capsules...</p>
          ) : rows.length === 0 ? (
            <div className="capsule-attach-empty">
              <strong>No capsules</strong>
              <Button type="button" size="sm" icon={<Archive size={14} />} onClick={openCapsulesSurface}>
                Open Capsules
              </Button>
            </div>
          ) : (
            <div className="capsule-attach-form">
              <label className="field">
                <span>Capsule</span>
                <SelectRoot value={capsuleId} onValueChange={setCapsuleId}>
                  <SelectTrigger aria-label="Capsule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rows.map((capsule) => (
                      <SelectItem key={capsule.id} value={capsule.id}>
                        {capsule.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
              </label>
              <label className="field">
                <span>Role</span>
                <SelectRoot value={role} onValueChange={setRole}>
                  <SelectTrigger aria-label="Capsule role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {capsuleAttachRoles.map((value) => (
                      <SelectItem key={value} value={value}>
                        {capsuleOptionLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
              </label>
              {showExportPolicy && (
                <label className="field">
                  <span>Export</span>
                  <SelectRoot value={exportPolicy} onValueChange={setExportPolicy}>
                    <SelectTrigger aria-label="Capsule source export policy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {capsuleSourcePolicies.map((value) => (
                        <SelectItem key={value} value={value}>
                          {capsuleOptionLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                </label>
              )}
              {targetType === "claim" && (
                <label className="capsule-check">
                  <Checkbox checked={includeEvidence} onCheckedChange={(checked) => setIncludeEvidence(checked === true)} />
                  <span>Evidence</span>
                </label>
              )}
              {addItem.error && <small className="model-test-error">{addItem.error.message}</small>}
              <div className="capsule-attach-actions">
                <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="primary" disabled={capsuleId === "none" || addItem.isPending} onClick={() => addItem.mutate()}>
                  {addItem.isPending ? "Adding" : "Add"}
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CapsulesView() {
  const queryClient = useQueryClient();
  const selectedCapsuleId = useUIStore((state) => state.selectedCapsuleId);
  const setSelectedCapsuleId = useUIStore((state) => state.setSelectedCapsuleId);
  const setSurface = useUIStore((state) => state.setSurface);
  const setSelectedNoteId = useUIStore((state) => state.setSelectedNoteId);
  const setSelectedSourceId = useUIStore((state) => state.setSelectedSourceId);
  const setSelectedClaimId = useUIStore((state) => state.setSelectedClaimId);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importResult, setImportResult] = useState<CapsuleImportResult | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    purpose: "",
    domains: "",
    tags: "",
    language: "en",
    capsule_type: "domain",
    epistemic_strictness: "balanced",
    default_source_policy: "reference_only"
  });
  const capsules = useQuery({
    queryKey: ["capsules", query],
    queryFn: () => vaultRequest<CapsuleListResponse>("capsules.list", { query, limit: 100 })
  });
  const capsuleImports = useQuery({
    queryKey: ["capsule-imports"],
    queryFn: () => vaultRequest<CapsuleImportListResponse>("capsules.imports", { limit: 6, offset: 0 })
  });
  const rows = capsules.data?.items ?? [];
  const selected = rows.find((capsule) => capsule.id === selectedCapsuleId) ?? rows[0];
  const detail = useQuery({
    queryKey: ["capsule", selected?.id],
    queryFn: () => vaultRequest<Capsule>("capsules.get", { capsuleId: selected!.id }),
    enabled: Boolean(selected?.id)
  });
  useEffect(() => {
    if (!selectedCapsuleId && selected?.id) setSelectedCapsuleId(selected.id);
    if (selectedCapsuleId && selected?.id && !rows.some((capsule) => capsule.id === selectedCapsuleId)) setSelectedCapsuleId(selected.id);
  }, [rows, selected?.id, selectedCapsuleId, setSelectedCapsuleId]);
  const createCapsule = useMutation({
    mutationFn: () =>
      vaultRequest<Capsule>("capsules.create", {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        purpose: draft.purpose.trim() || null,
        capsule_type: draft.capsule_type,
        language: draft.language.trim() || null,
        domains: parseCsv(draft.domains),
        tags: parseCsv(draft.tags),
        epistemic_strictness: draft.epistemic_strictness,
        default_source_policy: draft.default_source_policy
      }),
    onSuccess: (capsule) => {
      setSelectedCapsuleId(capsule.id);
      setCreateOpen(false);
      setDraft({
        name: "",
        description: "",
        purpose: "",
        domains: "",
        tags: "",
        language: "en",
        capsule_type: "domain",
        epistemic_strictness: "balanced",
        default_source_policy: "reference_only"
      });
      queryClient.invalidateQueries({ queryKey: ["capsules"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  });
  const importCapsule = useMutation({
    mutationFn: async () => {
      const files = await selectFiles();
      if (!files[0]) return null;
      return vaultRequest<CapsuleImportResult>("capsules.import", { file_path: files[0] });
    },
    onSuccess: (result) => {
      if (!result) return;
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["capsule-imports"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const openImportDetail = useMutation({
    mutationFn: (importId: string) => vaultRequest<CapsuleImportResult>("capsules.import.get", { importId }),
    onSuccess: (result) => setImportResult(result)
  });
  function openCapsuleTarget(item: CapsuleItem) {
    if (item.target_type === "note") {
      setSelectedNoteId(item.target_id);
      setSurface("notes");
    } else if (item.target_type === "source" || item.target_type === "source_block") {
      setSelectedSourceId(item.target?.type === "source" ? item.target_id : undefined);
      setSurface("sources");
    } else if (item.target_type === "claim") {
      setSelectedClaimId(item.target_id);
      setSurface("graph");
    } else if (item.target_type === "kg_node") {
      setSurface("graph");
    } else if (item.target_type === "learning_item") {
      setSurface("learning");
    } else if (item.target_type === "tool") {
      setSurface("tools");
    }
  }
  return (
    <div className="surface split-view capsules-view">
      <Panel className="list-pane">
        <SectionHeader
          title="Capsules"
          actions={
            <>
              <Button icon={<Import size={16} />} variant="quiet" disabled={importCapsule.isPending} onClick={() => importCapsule.mutate()}>
                Import
              </Button>
              <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
                New
              </Button>
            </>
          }
        />
        <label className="source-list-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find capsules" aria-label="Find capsules" />
        </label>
        <div className="entity-list capsules-list">
          {capsules.isLoading && <div className="entity-list-empty">Loading capsules...</div>}
          {!capsules.isLoading && rows.length === 0 && (
            <div className="entity-list-empty">
              <Archive size={18} />
              <strong>No capsules</strong>
              <Button type="button" size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
                New
              </Button>
            </div>
          )}
          {rows.map((capsule) => (
            <button key={capsule.id} className={selected?.id === capsule.id ? "active" : ""} onClick={() => setSelectedCapsuleId(capsule.id)}>
              <span className="note-list-title">
                <strong>{capsule.name}</strong>
                <Badge tone={capsuleHealthTone(capsule.health?.status)}>{capsuleHealthLabel(capsule.health?.status)}</Badge>
              </span>
              <span className="note-list-preview">{capsuleCountsLine(capsule.counts)}</span>
              <small className="note-list-meta">
                <Clock3 size={12} />
                {capsule.version} · {compactDate(capsule.updated_at)}
              </small>
            </button>
          ))}
        </div>
        <CapsuleImportHistory
          imports={capsuleImports.data?.items ?? []}
          total={capsuleImports.data?.total ?? 0}
          loading={capsuleImports.isLoading}
          selectedImportId={importResult?.import_id}
          onOpen={(importId) => openImportDetail.mutate(importId)}
        />
        {openImportDetail.error && <small className="model-test-error">{openImportDetail.error.message}</small>}
      </Panel>
      <Panel className="capsule-detail detail-pane">
        {importResult ? (
          <CapsuleImportDetail result={importResult} onClose={() => setImportResult(null)} />
        ) : detail.data ? (
          <CapsuleDetail capsule={detail.data} onOpenTarget={openCapsuleTarget} />
        ) : (
          <CapsuleEmptyDetail onCreate={() => setCreateOpen(true)} />
        )}
      </Panel>
      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="source-dialog capsule-create-dialog" aria-describedby={undefined}>
            <Dialog.Title>New capsule</Dialog.Title>
            <button className="dialog-close" aria-label="Close capsule dialog" onClick={() => setCreateOpen(false)}>
              <X size={16} />
            </button>
            <form
              className="capsule-create-form"
              onSubmit={(event) => {
                event.preventDefault();
                createCapsule.mutate();
              }}
            >
              <div className="capsule-create-primary">
                <Input aria-label="Capsule name" value={draft.name} placeholder="Name" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                <label className="field">
                  <span>Type</span>
                  <SelectRoot value={draft.capsule_type} onValueChange={(value) => setDraft((current) => ({ ...current, capsule_type: value }))}>
                    <SelectTrigger aria-label="Capsule type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["domain", "project", "research_question", "course", "toolkit", "archive", "publication_pack", "personal_learning"].map((type) => (
                        <SelectItem key={type} value={type}>
                          {capsuleOptionLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                </label>
              </div>
              <details className="capsule-create-more">
                <summary>Details</summary>
                <Textarea
                  aria-label="Capsule purpose"
                  value={draft.purpose}
                  placeholder="Purpose"
                  onChange={(event) => setDraft((current) => ({ ...current, purpose: event.target.value }))}
                />
                <Input
                  aria-label="Capsule description"
                  value={draft.description}
                  placeholder="Description"
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                />
                <div className="capsule-create-grid">
                  <label className="field">
                    <span>Strictness</span>
                    <SelectRoot value={draft.epistemic_strictness} onValueChange={(value) => setDraft((current) => ({ ...current, epistemic_strictness: value }))}>
                      <SelectTrigger aria-label="Capsule epistemic strictness">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["strict_evidence", "balanced", "exploratory", "creative_speculative"].map((strictness) => (
                          <SelectItem key={strictness} value={strictness}>
                            {capsuleOptionLabel(strictness)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </SelectRoot>
                  </label>
                  <label className="field">
                    <span>Source policy</span>
                    <SelectRoot value={draft.default_source_policy} onValueChange={(value) => setDraft((current) => ({ ...current, default_source_policy: value }))}>
                      <SelectTrigger aria-label="Capsule default source export policy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["reference_only", "metadata_and_quotes", "extracted_text_only", "full_sources_private"].map((policy) => (
                          <SelectItem key={policy} value={policy}>
                            {capsuleOptionLabel(policy)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </SelectRoot>
                  </label>
                </div>
                <div className="capsule-create-grid two">
                  <Input aria-label="Capsule domains" value={draft.domains} placeholder="Domains" onChange={(event) => setDraft((current) => ({ ...current, domains: event.target.value }))} />
                  <Input aria-label="Capsule tags" value={draft.tags} placeholder="Tags" onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} />
                </div>
              </details>
              {createCapsule.error && <small className="model-test-error">{createCapsule.error.message}</small>}
              <div className="source-dialog-actions">
                <small>{draft.name.trim() ? "Draft" : ""}</small>
                <Button type="submit" disabled={!draft.name.trim() || createCapsule.isPending}>
                  {createCapsule.isPending ? "Creating" : "Create"}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function CapsuleImportHistory({
  imports,
  total,
  loading,
  selectedImportId,
  onOpen
}: {
  imports: CapsuleImportResult[];
  total: number;
  loading: boolean;
  selectedImportId?: string;
  onOpen: (importId: string) => void;
}) {
  if (loading) {
    return (
      <section className="capsule-import-history" aria-label="Capsule import history">
        <strong>Imports</strong>
        <span>Loading</span>
      </section>
    );
  }
  if (imports.length === 0) return null;
  return (
    <section className="capsule-import-history" aria-label="Capsule import history">
      <div className="capsule-import-history-head">
        <strong>Imports</strong>
        {total > imports.length && <small>{imports.length}/{total}</small>}
      </div>
      {imports.map((item) => {
        const importId = item.import_id || String((item as any).id || "");
        const capsule = item.manifest?.capsule ?? {};
        const name = String(capsule.name || item.merge_plan?.capsule_name || "Imported capsule");
        return (
          <button key={importId} type="button" className={selectedImportId === importId ? "active" : ""} disabled={!importId} onClick={() => onOpen(importId)}>
            <span>
              <strong title={name}>{name}</strong>
              <Badge tone={item.status === "invalid" ? "bad" : item.status === "review_ready" ? "good" : "warn"}>{capsuleOptionLabel(item.status)}</Badge>
            </span>
            <small>{compactDate(item.created_at)}</small>
          </button>
        );
      })}
    </section>
  );
}

function CapsuleEmptyDetail({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="source-empty-state">
      <Archive size={20} />
      <strong>No capsule selected</strong>
      <Button type="button" size="sm" icon={<Plus size={14} />} onClick={onCreate}>
        New
      </Button>
    </div>
  );
}

function CapsuleImportDetail({ result, onClose }: { result: CapsuleImportResult; onClose: () => void }) {
  const queryClient = useQueryClient();
  const setSurface = useUIStore((state) => state.setSurface);
  const capsule = result.manifest?.capsule ?? {};
  const mergePlan = result.merge_plan ?? {};
  const counts = (mergePlan.object_counts ?? {}) as Record<string, number>;
  const actions = Array.isArray(mergePlan.actions) ? mergePlan.actions : [];
  const validation = result.validation_report ?? {};
  const checksumResults = Array.isArray(validation.checksum_results) ? validation.checksum_results : [];
  const validationErrors = Array.isArray(validation.errors) ? validation.errors.map((item) => String(item)).filter(Boolean) : [];
  const validationWarnings = Array.isArray(validation.warnings) ? validation.warnings : [];
  const isInvalid = result.status === "invalid" || validation.status === "invalid";
  const createReviewItems = useMutation({
    mutationFn: () => vaultRequest<CapsuleImportReviewItemsResult>("capsules.import.reviewItems", { importId: result.import_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const reviewResult = createReviewItems.data;
  return (
    <>
      <SectionHeader
        title={capsule.name ?? "Imported capsule"}
        eyebrow="quarantine"
        actions={
          <TooltipProvider delayDuration={250}>
            <div className="capsule-header-actions" aria-label="Capsule import actions">
              {reviewResult ? (
                <Button icon={<Link2 size={15} />} variant="secondary" onClick={() => setSurface("review")}>
                  Open Review
                </Button>
              ) : (
                <Button icon={<Check size={15} />} variant="secondary" disabled={isInvalid || createReviewItems.isPending} onClick={() => createReviewItems.mutate()}>
                  {createReviewItems.isPending ? "Creating" : "Review items"}
                </Button>
              )}
              <CapsuleHeaderAction label="Close import" icon={<X size={15} />} onClick={onClose} />
            </div>
          </TooltipProvider>
        }
      />
      <div className="capsule-import-summary" aria-label="Capsule import quarantine">
        <Badge tone={isInvalid ? "bad" : result.status === "quarantined" ? "warn" : "good"}>{result.status}</Badge>
        <span title={result.source_file_path}>{fileNameFromPath(result.source_file_path)}</span>
      </div>
      {isInvalid && (
        <section className="capsule-import-diagnostics" aria-label="Capsule import validation errors">
          <div>
            <Badge tone="bad">invalid</Badge>
            <strong>Review blocked</strong>
          </div>
          {validationErrors.length === 0 ? (
            <span>No validation details were reported.</span>
          ) : (
            validationErrors.map((error) => <span key={error}>{error}</span>)
          )}
        </section>
      )}
      <div className="capsule-export-grid" aria-label="Imported capsule counts">
        <span><strong>{counts.claims ?? 0}</strong> claims</span>
        <span><strong>{counts.sources ?? 0}</strong> sources</span>
        <span><strong>{counts.notes ?? 0}</strong> notes</span>
        <span><strong>{counts.tools ?? 0}</strong> tools</span>
      </div>
      <section className="capsule-import-plan" aria-label="Capsule import merge plan">
        {actions.length === 0 && <p className="empty-copy">No merge actions.</p>}
        {actions.map((action: any) => (
          <article key={`${action.target_type}-${action.action}`}>
            <strong>{capsuleOptionLabel(action.target_type)}</strong>
            <span>{action.count} · {capsuleOptionLabel(action.action)}</span>
          </article>
        ))}
      </section>
      <details className="capsule-import-details">
        <summary>Import details</summary>
        <div className="capsule-import-summary secondary" aria-label="Capsule import validation">
          <span>{checksumResults.filter((item: any) => item.status === "pass").length}/{checksumResults.length} checksums</span>
          <span>{String(validation.file_count ?? 0)} files</span>
          <span>{formatBytes(Number(validation.unpacked_bytes ?? 0))}</span>
          <span title={result.quarantine_path}>{middleTruncate(result.quarantine_path, 64)}</span>
        </div>
      </details>
      {validationWarnings.length > 0 && (
        <div className="capsule-export-list" aria-label="Capsule import validation warnings">
          {validationWarnings.map((warning: any, index: number) => (
            <span key={warning?.code ?? index}>{typeof warning === "string" ? warning : warning.message}</span>
          ))}
        </div>
      )}
      {reviewResult && (
        <div className="capsule-import-review-result" aria-label="Capsule import review items">
          <Badge tone="good">review</Badge>
          <span>{reviewResult.created_review_items} created</span>
          <small>{reviewResult.skipped_duplicates} skipped</small>
        </div>
      )}
      {createReviewItems.error && <small className="model-test-error">{createReviewItems.error.message}</small>}
      {Array.isArray(result.warnings) && result.warnings.length > 0 && (
        <div className="capsule-export-list" aria-label="Capsule import warnings">
          {result.warnings.map((warning, index) => (
            <span key={typeof warning === "string" ? warning : warning.code ?? index}>{typeof warning === "string" ? warning : warning.message}</span>
          ))}
        </div>
      )}
    </>
  );
}

function CapsuleDetail({ capsule, onOpenTarget }: { capsule: Capsule; onOpenTarget: (item: CapsuleItem) => void }) {
  const queryClient = useQueryClient();
  const setSurface = useUIStore((state) => state.setSurface);
  const setSelectedNoteId = useUIStore((state) => state.setSelectedNoteId);
  const setSelectedCapsuleId = useUIStore((state) => state.setSelectedCapsuleId);
  const notes = useQuery({ queryKey: ["notes"], queryFn: () => vaultRequest<Note[]>("notes.list") });
  const sources = useQuery({ queryKey: ["sources"], queryFn: () => vaultRequest<Source[]>("sources.list") });
  const claims = useQuery({ queryKey: ["claims"], queryFn: () => vaultRequest<Claim[]>("claims.list") });
  const concepts = useQuery({ queryKey: ["graph-nodes"], queryFn: () => vaultRequest<KnowledgeNode[]>("graph.nodes", { limit: 100 }) });
  const learningItems = useQuery({ queryKey: ["learning"], queryFn: () => vaultRequest<LearningItem[]>("learning.items") });
  const tools = useQuery({ queryKey: ["tools"], queryFn: () => vaultRequest<Tool[]>("tools.list") });
  const [targetType, setTargetType] = useState<CapsuleAddTargetType>("note");
  const [targetId, setTargetId] = useState("");
  const [role, setRole] = useState("core");
  const [autoIncludeEvidence, setAutoIncludeEvidence] = useState(true);
  const [snapshotVersion, setSnapshotVersion] = useState(nextCapsulePatchVersion(capsule.version));
  const [exportOpen, setExportOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const versions = capsule.versions ?? [];
  const targetOptions = capsuleTargetOptions(targetType, {
    notes: notes.data ?? [],
    sources: sources.data ?? [],
    claims: claims.data ?? [],
    concepts: concepts.data ?? [],
    learningItems: learningItems.data ?? [],
    tools: tools.data ?? []
  });
  useEffect(() => {
    setTargetId("");
    setRole(defaultCapsuleRoleForTarget(targetType));
  }, [targetType]);
  useEffect(() => {
    setSnapshotVersion(nextCapsulePatchVersion(capsule.version));
  }, [capsule.version]);
  useEffect(() => {
    if (!actionsOpen) return;
    function closeActions(event: MouseEvent) {
      if (event.target instanceof Node && !actionsMenuRef.current?.contains(event.target)) setActionsOpen(false);
    }
    function closeActionsOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setActionsOpen(false);
    }
    document.addEventListener("mousedown", closeActions);
    document.addEventListener("keydown", closeActionsOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeActions);
      document.removeEventListener("keydown", closeActionsOnEscape);
    };
  }, [actionsOpen]);
  const addItem = useMutation({
    mutationFn: () =>
      vaultRequest("capsules.addItems", {
        capsuleId: capsule.id,
        items: [
          {
            target_type: targetType,
            target_id: targetId,
            role,
            include_mode: "reference",
            auto_include_evidence: targetType === "claim" && autoIncludeEvidence
          }
        ]
      }),
    onSuccess: () => {
      setTargetId("");
      queryClient.invalidateQueries({ queryKey: ["capsules"] });
      queryClient.invalidateQueries({ queryKey: ["capsule", capsule.id] });
    }
  });
  const removeItem = useMutation({
    mutationFn: (itemId: string) => vaultRequest("capsules.removeItem", { capsuleId: capsule.id, itemId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capsules"] });
      queryClient.invalidateQueries({ queryKey: ["capsule", capsule.id] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  });
  const runHealth = useMutation({
    mutationFn: () => vaultRequest("capsules.health.run", { capsuleId: capsule.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capsules"] });
      queryClient.invalidateQueries({ queryKey: ["capsule", capsule.id] });
    }
  });
  const forkCapsule = useMutation({
    mutationFn: () =>
      vaultRequest<Capsule>("capsules.fork", {
        capsuleId: capsule.id,
        data: { name: `${capsule.name} Fork`, capsule_type: "project" }
      }),
    onSuccess: (forked) => {
      queryClient.setQueryData(["capsule", forked.id], forked);
      queryClient.setQueriesData<CapsuleListResponse>({ queryKey: ["capsules"] }, (current) => {
        if (!current) return current;
        const items = current.items.some((item) => item.id === forked.id)
          ? current.items.map((item) => (item.id === forked.id ? forked : item))
          : [forked, ...current.items];
        return { ...current, items, total: Math.max(current.total ?? 0, items.length) };
      });
      setSelectedCapsuleId(forked.id);
      queryClient.invalidateQueries({ queryKey: ["capsules"] });
      queryClient.invalidateQueries({ queryKey: ["capsule", forked.id] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  });
  const generateOverview = useMutation({
    mutationFn: () => vaultRequest<CapsuleOverviewNoteResult>("capsules.overviewNote", { capsuleId: capsule.id }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["capsules"] });
      queryClient.invalidateQueries({ queryKey: ["capsule", capsule.id] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setSelectedNoteId(result.note_id);
      setSurface("notes");
    }
  });
  const generateLearning = useMutation({
    mutationFn: () =>
      vaultRequest<CapsuleLearningGenerateResult>("capsules.learning.generate", {
        capsuleId: capsule.id,
        data: { source_policy: "reviewed_claims_only", difficulty: "beginner", duration: "7_days", include_flashcards: true, include_quiz: true }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setSurface("review");
    }
  });
  const versionDiff = useMutation({
    mutationFn: ({ fromVersionId, toVersionId }: { fromVersionId: string; toVersionId: string }) =>
      vaultRequest<CapsuleVersionDiff>("capsules.versionDiff", { capsuleId: capsule.id, fromVersionId, toVersionId })
  });
  const snapshot = useMutation({
    mutationFn: () =>
      vaultRequest("capsules.snapshot", {
        capsuleId: capsule.id,
        data: { version: snapshotVersion, title: `${capsule.name} ${snapshotVersion}`, changelog: "Manual capsule snapshot." }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capsules"] });
      queryClient.invalidateQueries({ queryKey: ["capsule", capsule.id] });
      versionDiff.reset();
    }
  });
  function compareLatestVersions() {
    if (versions.length < 2) return;
    versionDiff.mutate({ fromVersionId: versions[1].id, toVersionId: versions[0].id });
  }
  const capsuleSummary = [capsule.purpose, capsule.description].map((value) => value?.trim()).filter(Boolean).join(" · ");
  return (
    <>
      <SectionHeader
        title={capsule.name}
        actions={
          <TooltipProvider delayDuration={250}>
            <div className="capsule-header-actions" aria-label="Capsule actions">
              <CapsuleHeaderAction
                label="Generate overview"
                icon={<Sparkles size={15} />}
                disabled={generateOverview.isPending}
                onClick={() => generateOverview.mutate()}
              />
              <CapsuleHeaderAction label="Export capsule" icon={<Download size={15} />} onClick={() => setExportOpen(true)} />
              <div className="capsule-more-actions" ref={actionsMenuRef}>
                <CapsuleHeaderAction label="More capsule actions" icon={<MoreHorizontal size={16} />} onClick={() => setActionsOpen((open) => !open)} />
                {actionsOpen && (
                  <div className="capsule-action-menu" role="menu" aria-label="More capsule actions">
                    <Button
                      type="button"
                      variant="quiet"
                      icon={<RefreshCw size={14} />}
                      disabled={runHealth.isPending}
                      onClick={() => {
                        setActionsOpen(false);
                        runHealth.mutate();
                      }}
                    >
                      Run health
                    </Button>
                    <Button
                      type="button"
                      variant="quiet"
                      icon={<Brain size={14} />}
                      disabled={generateLearning.isPending}
                      onClick={() => {
                        setActionsOpen(false);
                        generateLearning.mutate();
                      }}
                    >
                      Generate practice
                    </Button>
                    <Button
                      type="button"
                      variant="quiet"
                      icon={<GitBranch size={14} />}
                      disabled={forkCapsule.isPending}
                      onClick={() => {
                        setActionsOpen(false);
                        forkCapsule.mutate();
                      }}
                    >
                      Fork
                    </Button>
                    <TaskCreateButton targetType="capsule" targetId={capsule.id} targetTitle={capsule.name} buttonLabel="Create task" buttonVariant="quiet" />
                  </div>
                )}
              </div>
            </div>
          </TooltipProvider>
        }
      />
      <div className="capsule-title-meta">
        <Badge tone={capsuleHealthTone(capsule.health?.status)}>{capsuleHealthLabel(capsule.health?.status)}</Badge>
        <span>{capsuleOptionLabel(capsule.capsule_type)}</span>
        <span>{capsule.version}</span>
        <span>{Math.round((capsule.health?.score ?? 0) * 100)}%</span>
        <span aria-label="Capsule counts">{capsuleCountsLine(capsule.counts)}</span>
        {capsuleForkParent(capsule) && <span>Fork of {capsuleForkParent(capsule)}</span>}
        {capsuleSummary && <span className="capsule-title-note" title={capsuleSummary}>{capsuleSummary}</span>}
      </div>
      <div className="capsule-workbench">
        <section className="capsule-add-panel" aria-label="Add to capsule">
          <SelectRoot value={targetType} onValueChange={(value) => setTargetType(value as CapsuleAddTargetType)}>
            <SelectTrigger aria-label="Capsule target type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="note">Note</SelectItem>
              <SelectItem value="source">Source</SelectItem>
              <SelectItem value="claim">Claim</SelectItem>
              <SelectItem value="kg_node">Concept</SelectItem>
              <SelectItem value="learning_item">Practice</SelectItem>
              <SelectItem value="tool">Tool</SelectItem>
            </SelectContent>
          </SelectRoot>
          <SelectRoot value={targetId || undefined} onValueChange={setTargetId}>
            <SelectTrigger aria-label="Capsule target">
              <SelectValue placeholder={targetOptions.length ? `Choose ${capsuleTargetNoun(targetType)}` : `No ${capsuleTargetPlural(targetType)}`} />
            </SelectTrigger>
            <SelectContent>
              {targetOptions.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {targetOptionLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
          <SelectRoot value={role} onValueChange={setRole}>
            <SelectTrigger aria-label="Capsule item role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["core", "supporting", "context", "primary_source", "evidence", "learning", "reference"].map((value) => (
                <SelectItem key={value} value={value}>
                  {capsuleOptionLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
          {targetType === "claim" && (
            <label className="capsule-check">
              <Checkbox checked={autoIncludeEvidence} onCheckedChange={(checked) => setAutoIncludeEvidence(checked === true)} />
              <span>Include evidence</span>
            </label>
          )}
          <Button size="sm" disabled={!targetId || addItem.isPending} onClick={() => addItem.mutate()}>
            Add {capsuleTargetNoun(targetType)}
          </Button>
        </section>
      </div>
      {(addItem.error || removeItem.error || runHealth.error || forkCapsule.error || generateOverview.error || generateLearning.error || snapshot.error || versionDiff.error) && (
        <small className="model-test-error">
          {addItem.error?.message ||
            removeItem.error?.message ||
            runHealth.error?.message ||
            forkCapsule.error?.message ||
            generateOverview.error?.message ||
            generateLearning.error?.message ||
            snapshot.error?.message ||
            versionDiff.error?.message}
        </small>
      )}
      <div className="capsule-health-row">
        {visibleCapsuleWarnings(capsule).slice(0, 3).map((warning) => (
          <Badge key={warning} tone="warn">
            {warning}
          </Badge>
        ))}
        {visibleCapsuleWarnings(capsule).length === 0 && (capsule.items ?? []).length > 0 && <Badge tone="good">clean</Badge>}
      </div>
      <section className="capsule-items" aria-label="Capsule items">
        {(capsule.items ?? []).length === 0 && <p className="empty-copy">No items</p>}
        {(capsule.items ?? []).map((item) => (
          <article key={item.id}>
            <button type="button" onClick={() => onOpenTarget(item)}>
              <strong>{item.target?.title ?? item.target_id}</strong>
              <span>{capsuleOptionLabel(item.target_type)} · {capsuleOptionLabel(item.role)}</span>
            </button>
            <button
              type="button"
              className="capsule-item-remove"
              aria-label={`Remove ${item.target?.title ?? item.target_id}`}
              title="Remove from capsule"
              disabled={removeItem.isPending}
              onClick={() => removeItem.mutate(item.id)}
            >
              <X size={14} />
            </button>
          </article>
        ))}
      </section>
      {versions.length > 0 && (
        <details className="capsule-history">
          <summary>Versions</summary>
          <section className="capsule-versions" aria-label="Capsule versions">
            {versions.slice(0, 4).map((version) => (
              <span key={version.id}>{version.version} · {compactDate(version.created_at)}</span>
            ))}
            {versions.length >= 2 && (
              <Button size="sm" variant="quiet" disabled={versionDiff.isPending} onClick={compareLatestVersions}>
                Diff
              </Button>
            )}
          </section>
          <section className="capsule-snapshot-panel" aria-label="Snapshot version">
            <span className="capsule-action-label">Snapshot</span>
            <Input aria-label="Snapshot version" value={snapshotVersion} onChange={(event) => setSnapshotVersion(event.target.value)} />
            <Button size="sm" icon={<Save size={14} />} variant="quiet" disabled={!snapshotVersion.trim() || snapshot.isPending} onClick={() => snapshot.mutate()}>
              Save
            </Button>
          </section>
          {versionDiff.data && <CapsuleVersionDiffSummary diff={versionDiff.data} />}
        </details>
      )}
      <CapsuleExportDialog capsule={capsule} open={exportOpen} onOpenChange={setExportOpen} />
    </>
  );
}

function CapsuleHeaderAction({
  label,
  icon,
  disabled,
  onClick
}: {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" size="icon" icon={icon} variant="quiet" aria-label={label} title={label} disabled={disabled} onClick={onClick} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CapsuleVersionDiffSummary({ diff }: { diff: CapsuleVersionDiff }) {
  return (
    <section className="capsule-version-diff" aria-label="Capsule version diff">
      <div className="capsule-version-diff-head">
        <span>{diff.from.version} to {diff.to.version}</span>
        <span>{diff.counts.added} added</span>
        <span>{diff.counts.removed} removed</span>
        <span>{diff.counts.changed} changed</span>
      </div>
      <CapsuleVersionDiffList label="Added" items={diff.added.map((item) => capsuleVersionDiffItemLabel(item))} />
      <CapsuleVersionDiffList label="Removed" items={diff.removed.map((item) => capsuleVersionDiffItemLabel(item))} />
      <CapsuleVersionDiffList
        label="Changed"
        items={diff.changed.map((item) => `${capsuleVersionDiffItemLabel(item.after)} · ${Object.keys(item.changes).map(capsuleOptionLabel).join(", ")}`)}
      />
      {diff.counts.added + diff.counts.removed + diff.counts.changed === 0 && <p className="empty-copy">No changes</p>}
    </section>
  );
}

function CapsuleVersionDiffList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="capsule-version-diff-list">
      <strong>{label}</strong>
      {items.slice(0, 6).map((item) => (
        <span key={item} title={item}>{item}</span>
      ))}
      {items.length > 6 && <small>{items.length - 6} more</small>}
    </div>
  );
}

function capsuleVersionDiffItemLabel(item: CapsuleVersionDiff["added"][number]): string {
  return `${capsuleOptionLabel(item.target_type)} · ${middleTruncate(String(item.target_id ?? ""), 18)} · ${capsuleOptionLabel(item.role)}`;
}

function CapsuleExportDialog({ capsule, open, onOpenChange }: { capsule: Capsule; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [exportMode, setExportMode] = useState("reference_only");
  const [exportVersionId, setExportVersionId] = useState("live");
  const versions = capsule.versions ?? [];
  const exportData = useMemo(
    () => ({ export_mode: exportMode, ...(exportVersionId !== "live" ? { version_id: exportVersionId } : {}) }),
    [exportMode, exportVersionId]
  );
  useEffect(() => {
    if (exportVersionId !== "live" && !versions.some((version) => version.id === exportVersionId)) {
      setExportVersionId("live");
    }
  }, [exportVersionId, versions]);
  const preview = useQuery({
    queryKey: ["capsule-export-preview", capsule.id, exportMode, exportVersionId],
    queryFn: () => vaultRequest<CapsuleExportPreview>("capsules.exportPreview", { capsuleId: capsule.id, data: exportData }),
    enabled: open
  });
  const exports = useQuery({
    queryKey: ["capsule-exports", capsule.id],
    queryFn: () => vaultRequest<CapsuleExportListResponse>("capsules.exports", { capsuleId: capsule.id, limit: 6, offset: 0 }),
    enabled: open
  });
  const exportCapsule = useMutation({
    mutationFn: () => vaultRequest<CapsuleExportResult>("capsules.export", { capsuleId: capsule.id, data: exportData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capsule", capsule.id] });
      queryClient.invalidateQueries({ queryKey: ["capsules"] });
      queryClient.invalidateQueries({ queryKey: ["capsule-exports", capsule.id] });
    }
  });
  const report = preview.data?.privacy_report;
  const blocked = preview.data?.status === "blocked";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content capsule-export-dialog" aria-describedby={undefined}>
          <div className="dialog-header">
            <div>
              <Dialog.Title>Export capsule</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="dialog-close" aria-label="Close export dialog">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <div className="capsule-export-head">
            <strong title={capsule.name}>{capsule.name}</strong>
            <Badge tone={blocked ? "bad" : preview.data ? "good" : "neutral"}>{blocked ? "blocked" : preview.data ? "ready" : "checking"}</Badge>
          </div>
          <label className="field">
            <span>Mode</span>
            <SelectRoot
              value={exportMode}
              onValueChange={(value) => {
                setExportMode(value);
                exportCapsule.reset();
              }}
            >
              <SelectTrigger aria-label="Capsule export mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["reference_only", "sanitized", "private_full", "learning", "tool", "public"].map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {capsuleOptionLabel(mode)}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
          </label>
          {versions.length > 0 && (
            <label className="field">
              <span>Version</span>
              <SelectRoot
                value={exportVersionId}
                onValueChange={(value) => {
                  setExportVersionId(value);
                  exportCapsule.reset();
                }}
              >
                <SelectTrigger aria-label="Capsule export version">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live</SelectItem>
                  {versions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      {version.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            </label>
          )}
          {report && (
            <div className="capsule-export-grid" aria-label="Capsule export preview">
              <span><strong>{report.private_item_count}</strong> private</span>
              <span><strong>{report.unsupported_claim_count}</strong> weak claims</span>
              <span><strong>{report.exact_quote_count}</strong> quotes</span>
              <span><strong>{report.estimated_record_count}</strong> records</span>
            </div>
          )}
          {(report?.blockers.length ?? 0) > 0 && (
            <div className="capsule-export-list blocked" aria-label="Export blockers">
              {report?.blockers.map((item) => <span key={item.code}>{item.message}</span>)}
            </div>
          )}
          {(report?.warnings.length ?? 0) > 0 && (
            <div className="capsule-export-list" aria-label="Export warnings">
              {report?.warnings.map((item) => <span key={item.code}>{item.message}</span>)}
            </div>
          )}
          {exportCapsule.data && (
            <div className="capsule-export-result" aria-label="Capsule export result">
              <Badge tone="good">saved</Badge>
              <span title={exportCapsule.data.file_path}>{exportCapsule.data.filename}</span>
              <small>{formatBytes(exportCapsule.data.size_bytes)} · {middleTruncate(exportCapsule.data.sha256, 18)}</small>
            </div>
          )}
          <CapsuleExportHistory exports={exports.data?.items ?? []} loading={exports.isLoading} />
          {(preview.error || exportCapsule.error) && <small className="model-test-error">{preview.error?.message || exportCapsule.error?.message}</small>}
          <div className="capsule-attach-actions">
            <Button type="button" variant="primary" disabled={!preview.data || blocked || exportCapsule.isPending} onClick={() => exportCapsule.mutate()}>
              {exportCapsule.isPending ? "Exporting" : "Export"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CapsuleExportHistory({ exports, loading }: { exports: CapsuleExportHistoryItem[]; loading: boolean }) {
  if (loading) {
    return (
      <section className="capsule-export-history" aria-label="Capsule export history">
        <strong>History</strong>
        <span>Loading</span>
      </section>
    );
  }
  if (exports.length === 0) return null;
  return (
    <section className="capsule-export-history" aria-label="Capsule export history">
      <strong>History</strong>
      {exports.map((item) => {
        const blocked = item.status === "blocked";
        const label = item.filename || (item.file_path ? item.file_path.split("/").at(-1) : `${capsuleOptionLabel(item.export_mode)} export`);
        return (
          <article key={item.id}>
            <div>
              <Badge tone={blocked ? "bad" : item.status === "completed" ? "good" : "neutral"}>{capsuleOptionLabel(item.status)}</Badge>
              <span title={label}>{label}</span>
            </div>
            <small>
              {capsuleOptionLabel(item.export_mode)} · {capsuleExportScopeLabel(item.manifest)} · {compactDate(item.created_at)}
              {(item.size_bytes ?? item.file_size_bytes ?? 0) > 0 ? ` · ${formatBytes(Number(item.size_bytes ?? item.file_size_bytes))}` : ""}
            </small>
            {item.error && <small>{item.error}</small>}
          </article>
        );
      })}
    </section>
  );
}

function capsuleExportScopeLabel(manifest: Record<string, any> | undefined): string {
  const scope = manifest?.export_scope;
  if (scope?.type === "version" && scope.version) return `v${scope.version}`;
  return "Live";
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || path;
}

function parseCsv(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function capsuleCountsLine(counts?: Capsule["counts"]): string {
  const safe = counts ?? { sources: 0, notes: 0, claims: 0, concepts: 0, tools: 0 };
  return `${safe.claims} claims · ${safe.sources} sources · ${safe.notes} notes`;
}

function capsuleHealthTone(status?: string): "neutral" | "good" | "warn" | "bad" | "info" {
  if (status === "healthy") return "good";
  if (status === "privacy_risk" || status === "weak_evidence" || status === "needs_review") return "warn";
  if (status === "unsafe_tools" || status === "export_blocked" || status === "contradictions_found") return "bad";
  return "neutral";
}

function capsuleHealthLabel(status?: string): string {
  return capsuleOptionLabel(status || "needs_review");
}

function visibleCapsuleWarnings(capsule: Capsule): string[] {
  return (capsule.health?.warnings ?? []).filter((warning) => warning !== "No capsule items yet.");
}

function capsuleForkParent(capsule: Capsule): string {
  const dependency = (capsule.dependencies ?? []).find((item) => item.dependency_type === "forked_from");
  return String(dependency?.target_capsule_name || dependency?.target_capsule_slug || dependency?.target_capsule_id || "");
}

function capsuleOptionLabel(value?: string): string {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

type CapsuleTargetOption = Note | Source | Claim | KnowledgeNode | LearningItem | Tool;

function capsuleTargetOptions(
  targetType: CapsuleAddTargetType,
  options: {
    notes: Note[];
    sources: Source[];
    claims: Claim[];
    concepts: KnowledgeNode[];
    learningItems: LearningItem[];
    tools: Tool[];
  }
): CapsuleTargetOption[] {
  if (targetType === "note") return options.notes;
  if (targetType === "source") return options.sources;
  if (targetType === "claim") return options.claims;
  if (targetType === "kg_node") return options.concepts;
  if (targetType === "learning_item") return options.learningItems;
  if (targetType === "tool") return options.tools;
  return [];
}

function capsuleTargetNoun(targetType: CapsuleAddTargetType): string {
  if (targetType === "source" || targetType === "source_block") return "source";
  if (targetType === "claim") return "claim";
  if (targetType === "kg_node") return "concept";
  if (targetType === "learning_item") return "practice";
  if (targetType === "tool") return "tool";
  return "note";
}

function capsuleTargetPlural(targetType: CapsuleAddTargetType): string {
  if (targetType === "kg_node") return "concepts";
  if (targetType === "learning_item") return "practice items";
  return `${capsuleTargetNoun(targetType)}s`;
}

function defaultCapsuleRoleForTarget(targetType: CapsuleAddTargetType): string {
  if (targetType === "source" || targetType === "source_block") return "primary_source";
  if (targetType === "learning_item") return "learning";
  if (targetType === "tool") return "reference";
  return "core";
}

function targetOptionLabel(item: CapsuleTargetOption): string {
  if ("normalized_text" in item) return item.normalized_text;
  if ("name" in item) return item.name;
  if ("canonical_text" in item && item.canonical_text) return item.canonical_text;
  return item.title;
}

function nextCapsulePatchVersion(version: string): string {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return "0.1.1";
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function GraphView() {
  const claims = useQuery({ queryKey: ["claims"], queryFn: () => vaultRequest<Claim[]>("claims.list") });
  const setSurface = useUIStore((state) => state.setSurface);
  const setSelectedSourceId = useUIStore((state) => state.setSelectedSourceId);
  const setSelectedSourceBlockId = useUIStore((state) => state.setSelectedSourceBlockId);
  const selectedClaimId = useUIStore((state) => state.selectedClaimId);
  const setSelectedClaimId = useUIStore((state) => state.setSelectedClaimId);
  const [claimQuery, setClaimQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const claimStatusFilters = ["all", "supported", "weakly_supported"];
  const filteredClaims = useMemo(() => {
    const query = claimQuery.trim().toLowerCase();
    return (claims.data ?? []).filter((claim) => {
      const statusMatches = statusFilter === "all" || claim.status === statusFilter;
      const queryMatches = !query || claimMatches(claim, query);
      return statusMatches && queryMatches;
    });
  }, [claims.data, claimQuery, statusFilter]);
  const selected = filteredClaims.find((claim) => claim.id === selectedClaimId) ?? claims.data?.find((claim) => claim.id === selectedClaimId) ?? filteredClaims[0] ?? claims.data?.[0];
  const evidence = useQuery({
    queryKey: ["claim-evidence", selected?.id],
    queryFn: () => vaultRequest<ClaimEvidenceLink[]>("claims.evidence", { claimId: selected!.id }),
    enabled: Boolean(selected?.id)
  });
  const supportedCount = (claims.data ?? []).filter((claim) => ["supported", "verified", "user_confirmed"].includes(claim.status)).length;
  const weakCount = (claims.data ?? []).filter((claim) => ["weakly_supported", "needs_review"].includes(claim.status)).length;
  function openEvidence(link: ClaimEvidenceLink) {
    if (!link.source_id) return;
    setSelectedSourceId(link.source_id);
    setSelectedSourceBlockId(link.source_block_id);
    setSurface("sources");
  }
  return (
    <div className="surface graph-layout">
      <Panel className="graph-canvas">
        <SectionHeader
          title="Evidence graph"
          eyebrow="claims and source blocks"
          description="A working map of approved claims, their strength, and the exact source blocks behind them."
        />
        <div className="graph-context-strip" aria-label="Evidence graph context">
          <span>{claims.data?.length ?? 0} claims</span>
          <span>{supportedCount} supported</span>
          <span>{weakCount} need care</span>
        </div>
        <div className="graph-filters">
          <label className="source-block-search">
            <Search size={15} />
            <input value={claimQuery} onChange={(event) => setClaimQuery(event.target.value)} placeholder="Find claims" aria-label="Find claims" />
          </label>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="review-tabs graph-status-tabs">
            <TabsList aria-label="Claim status filter">
              {claimStatusFilters.map((status) => (
                <TabsTrigger key={status} value={status} onClick={() => setStatusFilter(status)}>
                  {status.replace(/_/g, " ")}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="claim-list" aria-label="Claims">
          {filteredClaims.length === 0 && <p className="empty-copy">No claims match this filter.</p>}
          {filteredClaims.map((claim) => (
            <button key={claim.id} className={selected?.id === claim.id ? "active" : ""} onClick={() => setSelectedClaimId(claim.id)}>
              <span>
                <Badge tone={claimStatusTone(claim.status)}>{claim.status.replace(/_/g, " ")}</Badge>
                <small>{percentLabel(claim.evidence_strength)} evidence</small>
              </span>
              <strong>{claim.title}</strong>
              <p>{claim.normalized_text}</p>
              <div className="claim-strength-track" aria-label={`Evidence strength ${percentLabel(claim.evidence_strength)}`}>
                <i style={{ width: percentLabel(claim.evidence_strength) }} />
              </div>
            </button>
          ))}
        </div>
      </Panel>
      <Panel className="detail-pane">
        <SectionHeader
          title={selected?.title ?? "Claim detail"}
          eyebrow={selected?.status?.replace(/_/g, " ")}
          actions={
            selected ? (
              <>
                <TaskCreateButton targetType="claim" targetId={selected.id} targetTitle={selected.title} />
                <CapsuleAttachButton targetType="claim" targetId={selected.id} targetTitle={selected.title} defaultRole="core" autoIncludeEvidence />
              </>
            ) : undefined
          }
        />
        {selected ? (
          <>
            <div className="claim-detail-card">
              <Badge tone={claimStatusTone(selected.status)}>{selected.status.replace(/_/g, " ")}</Badge>
              <p>{selected.normalized_text}</p>
              <div className="claim-detail-context" aria-label="Claim strength">
                <span>{percentLabel(selected.confidence)} confidence</span>
                <span>{percentLabel(selected.evidence_strength)} evidence</span>
              </div>
            </div>
            <div className="claim-evidence-list" aria-label="Claim evidence">
              {(evidence.data ?? []).length === 0 && <p className="empty-copy">No evidence links are attached to this claim yet.</p>}
              {(evidence.data ?? []).map((link) => (
                <article key={link.id}>
                  <div>
                    <Badge tone={link.support_type === "supports" ? "good" : "warn"}>{link.support_type}</Badge>
                    {link.locator && <Badge>{link.locator}</Badge>}
                    {link.strength != null && <Badge tone="info">{percentLabel(link.strength)} strength</Badge>}
                  </div>
                  <blockquote>
                    <span>Exact quote</span>
                    {link.exact_quote}
                  </blockquote>
                  <footer>
                    <small>{link.source_title ?? link.source_block_id}</small>
                    <Button icon={<Link2 size={14} />} variant="quiet" disabled={!link.source_id} onClick={() => openEvidence(link)}>
                      Open source
                    </Button>
                  </footer>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="empty-copy">Approve a claim in Review to start building the graph.</p>
        )}
      </Panel>
    </div>
  );
}

function AssistantView() {
  const queryClient = useQueryClient();
  const selectedCapsuleId = useUIStore((state) => state.selectedCapsuleId);
  const setSurface = useUIStore((state) => state.setSurface);
  const setSelectedNoteId = useUIStore((state) => state.setSelectedNoteId);
  const setSelectedSourceId = useUIStore((state) => state.setSelectedSourceId);
  const setSelectedSourceBlockId = useUIStore((state) => state.setSelectedSourceBlockId);
  const setSelectedReviewItemId = useUIStore((state) => state.setSelectedReviewItemId);
  const setSelectedClaimId = useUIStore((state) => state.setSelectedClaimId);
  const [question, setQuestion] = useState("");
  const [evidenceMode, setEvidenceMode] = useState<AssistantEvidenceMode>("approved_claims");
  const [submittedEvidenceMode, setSubmittedEvidenceMode] = useState<AssistantEvidenceMode>("approved_claims");
  const [assistantContextId, setAssistantContextId] = useState(selectedCapsuleId ?? "vault");
  const [submittedContextId, setSubmittedContextId] = useState(selectedCapsuleId ?? "vault");
  const [answer, setAnswer] = useState<any>();
  const [voiceQuestionResult, setVoiceQuestionResult] = useState<any | null>(null);
  const [voiceQuestionRecordingState, setVoiceQuestionRecordingState] = useState<RecordingState>("idle");
  const [voiceQuestionRecordingError, setVoiceQuestionRecordingError] = useState("");
  const voiceQuestionMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceQuestionRecordingStreamRef = useRef<MediaStream | null>(null);
  const voiceQuestionRecordingChunksRef = useRef<BlobPart[]>([]);
  const voiceQuestionRecordingStateRef = useRef<RecordingState>(voiceQuestionRecordingState);
  const capsules = useQuery({
    queryKey: ["capsules", "assistant-context"],
    queryFn: () => vaultRequest<CapsuleListResponse>("capsules.list", { limit: 50 })
  });
  const ask = useMutation<any, Error, AssistantAskInput>({
    mutationFn: ({ question: questionText, mode, contextId }) =>
      vaultRequest("assistant.ask", {
        question: questionText,
        scope: assistantScopeFor(mode, contextId),
        answer_style: "concise_research_memo",
        require_citations: true
    }),
    onSuccess: setAnswer
  });
  const saveAssistantAnswer = useMutation<Note, Error>({
    mutationFn: async () => {
      if (!answer?.answer_markdown) throw new Error("Ask a question before saving an answer.");
      const sourceQuestion = question.trim() || "Assistant answer";
      const title = assistantAnswerNoteTitle(sourceQuestion);
      const markdown = assistantAnswerNoteMarkdown(title, sourceQuestion, answer);
      const contentJson = assistantAnswerNoteContent(sourceQuestion, answer, submittedEvidenceMode, markdown);
      const created = await vaultRequest<Note>("notes.create", {
        title,
        content_markdown: markdown,
        content_json: contentJson,
        origin: "ai_generated"
      });
      return vaultRequest<Note>("notes.update", {
        noteId: created.id,
        data: {
          title,
          content_markdown: markdown,
          content_json: contentJson,
          status: "generated_pending_review"
        }
      });
    },
    onSuccess: (note) => {
      setSelectedNoteId(note.id);
      setSurface("notes");
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
    }
  });
  const citations = answer?.citations ?? [];
  const uncertainties = answer?.uncertainties ?? [];
  const assistantCapsules = capsules.data?.items ?? [];
  const activeCapsule = assistantCapsules.find((capsule) => capsule.id === assistantContextId);
  const submittedCapsule = answer?.capsule ?? assistantCapsules.find((capsule) => capsule.id === submittedContextId);
  const activeEvidencePolicy = assistantEvidencePolicies[evidenceMode];
  const answerEvidencePolicy = assistantEvidencePolicies[answer ? submittedEvidenceMode : evidenceMode];
  const ActiveEvidencePolicyIcon = activeEvidencePolicy.icon;
  const AnswerEvidencePolicyIcon = answerEvidencePolicy.icon;
  const validationStatus = answer?.citation_validation?.status ? citationValidationLabel(String(answer.citation_validation.status)) : undefined;
  const groundingTitle = assistantGroundingTitle(answer, answerEvidencePolicy, ask.isPending);
  const groundingDetail = assistantGroundingDetail(answer, answerEvidencePolicy, citations.length);
  const localityLabel = assistantLocalityLabel(answer);
  const modelLabel = assistantModelLabel(answer, ask.isPending);
  const contextLabel = assistantContextLabel(answer, submittedContextId, submittedCapsule);

  useEffect(() => {
    if (selectedCapsuleId && assistantContextId === "vault") {
      setAssistantContextId(selectedCapsuleId);
      setSubmittedContextId(selectedCapsuleId);
    }
  }, [assistantContextId, selectedCapsuleId]);

  useEffect(
    () => () => {
      const recorder = voiceQuestionMediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      stopVoiceQuestionRecordingTracks();
    },
    []
  );

  useEffect(() => {
    voiceQuestionRecordingStateRef.current = voiceQuestionRecordingState;
  }, [voiceQuestionRecordingState]);

  function openCitationSource(citation: any) {
    if (!citation?.source_id) return;
    setSelectedSourceId(String(citation.source_id));
    setSelectedSourceBlockId(citation.source_block_id ? String(citation.source_block_id) : undefined);
    setSurface("sources");
  }
  function openCitationClaim(citation: any) {
    if (!citation?.claim_id) return;
    setSelectedClaimId(String(citation.claim_id));
    setSurface("graph");
  }
  function openReviewFollowUp() {
    if (answer?.review_item_id) setSelectedReviewItemId(String(answer.review_item_id));
    setSurface("review");
  }
  function askQuestion(questionOverride?: string, modeOverride: AssistantEvidenceMode = evidenceMode) {
    const nextQuestion = String(questionOverride ?? question).trim();
    if (!nextQuestion) return;
    setSubmittedEvidenceMode(modeOverride);
    setSubmittedContextId(assistantContextId);
    ask.mutate({ question: nextQuestion, mode: modeOverride, contextId: assistantContextId });
  }
  function runStarter(starter: AssistantPromptStarter) {
    setQuestion(starter.question);
    setEvidenceMode(starter.mode);
    askQuestion(starter.question, starter.mode);
  }
  async function startVoiceQuestionRecording() {
    if (voiceQuestionRecordingStateRef.current !== "idle") return;
    voiceQuestionRecordingStateRef.current = "processing";
    setVoiceQuestionRecordingError("");
    setVoiceQuestionResult(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceQuestionRecordingError("Microphone recording is not available in this environment.");
      voiceQuestionRecordingStateRef.current = "idle";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = supportedRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      voiceQuestionRecordingStreamRef.current = stream;
      voiceQuestionMediaRecorderRef.current = recorder;
      voiceQuestionRecordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceQuestionRecordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setVoiceQuestionRecordingError("Microphone recording failed.");
      };
      recorder.onstop = () => {
        void finishVoiceQuestionRecording(recorder);
      };
      recorder.start();
      voiceQuestionRecordingStateRef.current = "recording";
      setVoiceQuestionRecordingState("recording");
    } catch (error) {
      setVoiceQuestionRecordingError(error instanceof Error ? error.message : "Could not start microphone recording.");
      stopVoiceQuestionRecordingTracks();
      voiceQuestionRecordingStateRef.current = "idle";
      setVoiceQuestionRecordingState("idle");
    }
  }

  function stopVoiceQuestionRecording() {
    const recorder = voiceQuestionMediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    voiceQuestionRecordingStateRef.current = "processing";
    setVoiceQuestionRecordingState("processing");
    recorder.stop();
  }

  async function finishVoiceQuestionRecording(recorder: MediaRecorder) {
    try {
      const mimeType = recorder.mimeType || supportedRecordingMimeType() || "audio/webm";
      const blob = new Blob(voiceQuestionRecordingChunksRef.current, { type: mimeType });
      const saved = await saveAudioRecording(await blobToArrayBuffer(blob), mimeType);
      const result = await vaultRequest<any>("voice.transcribe", {
        audio_path: saved.filePath,
        title: "Assistant voice question",
        create_source: false,
        local_only: true,
        metadata: {
          import_mode: "assistant_question_microphone",
          mime_type: saved.mimeType,
          size_bytes: saved.sizeBytes
        }
      });
      setVoiceQuestionResult(result);
      const transcript = transcriptTextFromResult(result);
      if (!transcript) {
        setVoiceQuestionRecordingError("No speech was transcribed.");
        return;
      }
      setQuestion(transcript);
      askQuestion(transcript);
    } catch (error) {
      setVoiceQuestionRecordingError(error instanceof Error ? error.message : "Could not transcribe the voice question.");
    } finally {
      stopVoiceQuestionRecordingTracks();
      voiceQuestionMediaRecorderRef.current = null;
      voiceQuestionRecordingChunksRef.current = [];
      voiceQuestionRecordingStateRef.current = "idle";
      setVoiceQuestionRecordingState("idle");
    }
  }

  function stopVoiceQuestionRecordingTracks() {
    voiceQuestionRecordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceQuestionRecordingStreamRef.current = null;
  }

  return (
    <div className="surface assistant-layout">
      <Panel className="assistant-chat-panel">
        <div className="assistant-thread" aria-label="Assistant conversation">
          {!answer && !ask.isPending ? (
            <div className="assistant-welcome">
              <MessageSquareText size={22} />
              <h2>Ask the local assistant</h2>
              <div className="assistant-starter-row" aria-label="Assistant question starters">
                {assistantPromptStarters.map((starter) => {
                  const StarterIcon = starter.icon;
                  return (
                    <button key={starter.id} type="button" disabled={ask.isPending} title={`${starter.description} ${starter.question}`} onClick={() => runStarter(starter)}>
                      <StarterIcon size={14} />
                      {starter.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {question.trim() && (
                <article className="assistant-message assistant-message-user">
                  <p>{question.trim()}</p>
                </article>
              )}
              <article className="assistant-message assistant-message-answer">
                <div className="assistant-answer-header">
                  <div>
                    <Badge tone={evidenceQualityTone(answer?.evidence_quality)}>
                      {evidenceQualityLabel(answer?.evidence_quality)}
                    </Badge>
                    {answer?.provider && <Badge tone={answer.sent_off_device ? "bad" : "good"}>{localityLabel}</Badge>}
                    {validationStatus && <Badge tone={answer?.citation_validation?.status === "valid" ? "good" : "warn"}>{validationStatus}</Badge>}
                  </div>
                  <div className="assistant-answer-actions">
                    {answer?.review_item_id && (
                      <Button icon={<GitBranch size={15} />} variant="quiet" onClick={openReviewFollowUp}>
                        Review follow-up
                      </Button>
                    )}
                    {answer?.ai_run_id && (
                      <TaskCreateButton
                        targetType="assistant_answer"
                        targetId={String(answer.ai_run_id)}
                        targetTitle={question.trim() || "Assistant answer"}
                        defaultTitle={`Follow up on ${assistantAnswerNoteTitle(question.trim() || "Assistant answer")}`}
                      />
                    )}
                    {answer?.answer_markdown && (
                      <Button icon={<FilePlus2 size={15} />} variant="secondary" disabled={saveAssistantAnswer.isPending} onClick={() => saveAssistantAnswer.mutate()}>
                        {saveAssistantAnswer.isPending ? "Saving" : "Save as note"}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="markdown-output">
                  {ask.isPending ? "Working locally..." : answer?.answer_markdown}
                </div>
                <div className="assistant-grounding-panel" aria-label="Assistant answer grounding">
                  <div>
                    <Badge tone={answerEvidencePolicy.tone}>
                      <AnswerEvidencePolicyIcon size={12} />
                      Evidence
                    </Badge>
                    <strong>{groundingTitle}</strong>
                    <span>{groundingDetail}</span>
                  </div>
                  <div className="assistant-grounding-meta" aria-label="Answer context">
                    <span>{answerEvidencePolicy.label}</span>
                    <span>{contextLabel}</span>
                    <span>{assistantCitationCountLabel(citations.length)}</span>
                    <span>{localityLabel}</span>
                    <span title={String(answer?.model_id ?? "")}>{modelLabel}</span>
                  </div>
                </div>
                {saveAssistantAnswer.error && <small className="model-test-error">{saveAssistantAnswer.error.message}</small>}
                {uncertainties.length > 0 && (
                  <div className="assistant-uncertainties" aria-label="Assistant uncertainties">
                    {uncertainties.map((uncertainty: string) => (
                      <article key={uncertainty}>
                        <Badge tone="warn">uncertain</Badge>
                        <span>{uncertainty}</span>
                      </article>
                    ))}
                  </div>
                )}
                {citations.length > 0 && (
                  <div className="citation-row" aria-label="Assistant citations">
                    {citations.map((citation: any) => (
                      <article key={`${citation.marker}-${citation.source_block_id}-${citation.claim_id ?? "source"}`}>
                        <div>
                          <Badge tone={citation.evidence_kind === "approved_claim_evidence" ? "good" : "info"}>{citation.marker}</Badge>
                          <Badge tone={citation.evidence_kind === "approved_claim_evidence" ? "good" : "warn"}>
                            {citationEvidenceLabel(citation.evidence_kind)}
                          </Badge>
                        </div>
                        <strong title={citation.title ?? citation.source_block_id}>{citation.title ?? citation.source_block_id}</strong>
                        <span title={citation.exact_quote}>{citation.exact_quote}</span>
                        <div className="citation-record-footer">
                          <small title={citation.claim_id ? `claim ${citation.claim_id}` : citation.source_block_id}>
                            {citation.claim_id ? `claim ${citation.claim_id}` : citation.source_block_id}
                          </small>
                          <div className="assistant-citation-actions">
                            <Button icon={<Network size={14} />} variant="quiet" disabled={!citation.claim_id} onClick={() => openCitationClaim(citation)}>
                              Open claim
                            </Button>
                            <Button icon={<Link2 size={14} />} variant="quiet" disabled={!citation.source_id} onClick={() => openCitationSource(citation)}>
                              Open source
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            </>
          )}
        </div>
        <div className="assistant-composer">
          <div className="assistant-composer-top">
            <Tabs value={evidenceMode} onValueChange={(value) => setEvidenceMode(value as AssistantEvidenceMode)} className="assistant-scope-tabs">
              <TabsList aria-label="Answer evidence scope">
                {(Object.keys(assistantEvidencePolicies) as AssistantEvidenceMode[]).map((mode) => {
                  const policy = assistantEvidencePolicies[mode];
                  const PolicyIcon = policy.icon;
                  return (
                    <TabsTrigger
                      key={mode}
                      value={mode}
                      onClick={() => setEvidenceMode(mode)}
                    >
                      <PolicyIcon size={14} />
                      {policy.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
            <div className="assistant-scope-summary">
              <Badge tone={activeEvidencePolicy.tone}>
                <ActiveEvidencePolicyIcon size={12} />
                Evidence
              </Badge>
              <strong>{activeEvidencePolicy.label}</strong>
              <span>{activeCapsule?.name ?? (assistantContextId === "vault" ? "Vault" : "Capsule")}</span>
            </div>
            {assistantCapsules.length > 0 && (
              <SelectRoot value={assistantContextId} onValueChange={setAssistantContextId}>
                <SelectTrigger className="assistant-context-select" aria-label="Assistant context">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vault">Vault</SelectItem>
                  {assistantCapsules.map((capsule) => (
                    <SelectItem key={capsule.id} value={capsule.id}>
                      {capsule.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            )}
          </div>
          <Textarea
            aria-label="Assistant question"
            value={question}
            placeholder="Ask anything in this workspace."
            onChange={(event) => setQuestion(event.target.value)}
          />
          <div className="assistant-compose-actions">
            <CapabilityStatus capability="transcribe_audio" compact />
            <div>
              <Button
                icon={voiceQuestionRecordingState === "recording" ? <Pause size={16} /> : <Mic size={16} />}
                variant={voiceQuestionRecordingState === "recording" ? "primary" : "quiet"}
                disabled={voiceQuestionRecordingState === "processing" || ask.isPending}
                onClick={() => (voiceQuestionRecordingState === "recording" ? stopVoiceQuestionRecording() : void startVoiceQuestionRecording())}
              >
                {voiceQuestionRecordingState === "recording" ? "Stop question" : voiceQuestionRecordingState === "processing" ? "Saving" : "Voice question"}
              </Button>
              <Button icon={<MessageSquareText size={16} />} variant="primary" disabled={ask.isPending || !question.trim()} onClick={() => askQuestion()}>
                {ask.isPending ? "Asking" : "Ask"}
              </Button>
            </div>
          </div>
          {voiceQuestionResult && (
            <div className="workflow-result">
              <Badge tone={voiceQuestionResult.sent_off_device ? "bad" : "good"}>Voice question</Badge>
              <span title={String(voiceQuestionResult.model_id ?? "mock-local-stt")}>{speechAssetPrivacyLabel(voiceQuestionResult)}</span>
              <small>{transcriptTextFromResult(voiceQuestionResult)}</small>
            </div>
          )}
          {voiceQuestionRecordingError && <small className="model-test-error">{voiceQuestionRecordingError}</small>}
          {ask.error && <small className="model-test-error">{ask.error.message}</small>}
        </div>
      </Panel>
    </div>
  );
}

function evidenceQualityTone(value?: string): "neutral" | "good" | "warn" | "bad" | "info" {
  if (value === "approved_claims") return "good";
  if (value === "source_blocks") return "warn";
  if (value === "missing") return "bad";
  return "neutral";
}

function evidenceQualityLabel(value?: string): string {
  if (value === "approved_claims") return "approved evidence";
  if (value === "source_blocks") return "source evidence";
  if (value === "missing") return "missing evidence";
  return "not asked";
}

function assistantGroundingTitle(answer: any, policy: (typeof assistantEvidencePolicies)[AssistantEvidenceMode], pending: boolean): string {
  if (pending) return "Looking through local knowledge";
  if (!answer) return "Local answer";
  if (answer.evidence_quality === "approved_claims") return "Answered from approved claims";
  if (answer.evidence_quality === "source_blocks") return "Answered with Storage evidence";
  if (answer.evidence_quality === "missing") return "Not enough approved evidence";
  return `Answered with ${policy.label.toLowerCase()}`;
}

function assistantGroundingDetail(answer: any, policy: (typeof assistantEvidencePolicies)[AssistantEvidenceMode], citationCount: number): string {
  if (!answer) return `${policy.caption} Ask a question to see citations and review needs.`;
  if (answer.evidence_quality === "missing") return "The assistant did not find enough reviewed evidence to state this as fact.";
  if (answer.review_item_id) return "A follow-up review item is waiting because the answer needs stronger evidence.";
  if (citationCount === 0) return "No citations were returned. Treat this as provisional.";
  return `${policy.caption} ${assistantCitationCountLabel(citationCount)} attached.`;
}

function assistantCitationCountLabel(count: number): string {
  if (count === 0) return "none";
  if (count === 1) return "1 citation";
  return `${count} citations`;
}

function assistantLocalityLabel(answer: any): string {
  if (!answer) return "local by default";
  return answer.sent_off_device ? "off device" : "on device";
}

function assistantModelLabel(answer: any, pending: boolean): string {
  if (pending) return "working";
  if (!answer) return "waiting";
  if (answer.sent_off_device) return "Off-device model";
  return "Local model";
}

function assistantContextLabel(answer: any, contextId: string, capsule?: Partial<Capsule> | null): string {
  if (answer?.scope_context === "capsule") return String(answer?.capsule?.name || capsule?.name || "Capsule");
  if (contextId && contextId !== "vault") return String(capsule?.name || "Capsule");
  return "Vault";
}

function modelRunProviderLabel(run: Pick<AIModelRun, "provider" | "sent_off_device">): string {
  if (run.sent_off_device) return "Off-device model";
  return "Local model";
}

function modelRunStatusLabel(status: string): string {
  if (status === "succeeded") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "running") return "Running";
  if (status === "queued") return "Queued";
  return searchModeLabel(status);
}

function routeTestPrivacyLabel(sentOffDevice?: boolean): string {
  return sentOffDevice ? "Left this device" : "Stayed on this device";
}

function citationEvidenceLabel(value?: string): string {
  if (value === "approved_claim_evidence") return "approved claim";
  if (value === "source_block") return "source block";
  return value?.replace(/_/g, " ") || "evidence";
}

function citationValidationLabel(value: string): string {
  if (value === "valid") return "citations valid";
  if (value === "missing_citations_repaired") return "citations repaired";
  if (value === "invalid_citations_repaired") return "citations repaired";
  return value.replace(/_/g, " ");
}

function assistantAnswerNoteTitle(questionText: string): string {
  const firstLine = questionText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const base = firstLine || "Assistant answer";
  const title = `Assistant answer: ${base}`;
  return title.length > 88 ? `${title.slice(0, 85)}...` : title;
}

function assistantAnswerNoteMarkdown(title: string, questionText: string, answer: any): string {
  const evidenceLines = assistantCitationLines(answer?.citations ?? []);
  const uncertaintyLines = Array.isArray(answer?.uncertainties)
    ? answer.uncertainties.map((uncertainty: unknown) => `- ${String(uncertainty).trim()}`).filter((line: string) => line !== "-")
    : [];
  const sections = [
    `# ${title}`,
    "",
    "> Question",
    ...blockquoteLines(questionText),
    "",
    String(answer?.answer_markdown ?? "").trim()
  ];
  if (evidenceLines.length > 0) {
    sections.push("", "## Evidence", ...evidenceLines);
  }
  if (uncertaintyLines.length > 0) {
    sections.push("", "## Uncertainties", ...uncertaintyLines);
  }
  return `${sections.join("\n").trim()}\n`;
}

function assistantAnswerNoteContent(questionText: string, answer: any, mode: AssistantEvidenceMode, markdown: string): Record<string, unknown> {
  const citations = normalizeAssistantCitations(answer?.citations ?? []);
  const policy = assistantEvidencePolicies[mode];
  return {
    generation_status: "draft",
    requires_review: true,
    capture_mode: "assistant_answer",
    assistant_question: questionText,
    evidence_mode: mode,
    scope_context: answer?.scope_context ?? "vault",
    capsule_id: answer?.capsule?.id,
    capsule_name: answer?.capsule?.name,
    evidence_policy: policy.scope,
    evidence_quality: answer?.evidence_quality ?? "missing",
    generated_by: answer?.provider ?? "assistant",
    model_id: answer?.model_id ?? "unknown model",
    capability: answer?.capability ?? "grounded_answer",
    ai_run_id: answer?.ai_run_id,
    sent_off_device: Boolean(answer?.sent_off_device),
    source_ids: uniqueStrings(citations.map((citation) => citation.source_id)),
    claim_ids: uniqueStrings(citations.map((citation) => citation.claim_id)),
    citations,
    citation_validation: answer?.citation_validation,
    review_item_id: answer?.review_item_id,
    editor_engine: "tiptap",
    editor_doc: plainTextToTiptapDoc(markdown)
  };
}

function assistantCitationLines(citations: any[]): string[] {
  return normalizeAssistantCitations(citations).map((citation) => {
    const marker = citation.marker ? `${citation.marker} ` : "";
    const locator = citation.locator ? ` (${citation.locator})` : "";
    const quote = citation.exact_quote ? ` — ${citation.exact_quote}` : "";
    return `- ${marker}${citation.title || citation.source_block_id || "Evidence"}${locator}${quote}`;
  });
}

function normalizeAssistantCitations(citations: any[]): Array<Record<string, string>> {
  if (!Array.isArray(citations)) return [];
  return citations.map((citation) => ({
    marker: String(citation?.marker ?? ""),
    title: String(citation?.title ?? ""),
    locator: String(citation?.locator ?? ""),
    source_id: String(citation?.source_id ?? ""),
    source_block_id: String(citation?.source_block_id ?? ""),
    claim_id: String(citation?.claim_id ?? ""),
    exact_quote: String(citation?.exact_quote ?? ""),
    evidence_kind: String(citation?.evidence_kind ?? "")
  }));
}

function blockquoteLines(value: string): string[] {
  const lines = value.split(/\r?\n/).map((line) => line.trim());
  return (lines.length ? lines : [""]).map((line) => `> ${line || " "}`);
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "")).filter(Boolean)));
}

function microphonePermissionTone(status: MicrophonePermissionStatus): "neutral" | "good" | "warn" | "bad" | "info" {
  if (status === "ready" || status === "granted") return "good";
  if (status === "prompt" || status === "checking") return "warn";
  if (status === "unsupported" || status === "denied" || status === "error") return "bad";
  return "neutral";
}

function microphonePermissionLabel(status: MicrophonePermissionStatus): string {
  if (status === "ready") return "ready";
  if (status === "granted") return "granted";
  if (status === "prompt") return "needs test";
  if (status === "denied") return "blocked";
  if (status === "unsupported") return "unavailable";
  if (status === "error") return "failed";
  return "checking";
}

function microphonePermissionDetailForStatus(status: "granted" | "prompt" | "denied"): string {
  if (status === "granted") return "Permission granted. Run a microphone test before recording.";
  if (status === "denied") return "Permission denied by the system or browser.";
  return "Permission will be requested when the microphone is tested.";
}

function LearningView() {
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("Claim graphs");
  const [selectedLearningItemId, setSelectedLearningItemId] = useState("");
  const [speechResult, setSpeechResult] = useState<any | null>(null);
  const [speechAudioUrl, setSpeechAudioUrl] = useState("");
  const [speechError, setSpeechError] = useState("");
  const [learningAnswerResult, setLearningAnswerResult] = useState<any | null>(null);
  const [learningAnswerTranscript, setLearningAnswerTranscript] = useState("");
  const [learningAnswerSession, setLearningAnswerSession] = useState<any | null>(null);
  const [learningAnswerError, setLearningAnswerError] = useState("");
  const [learningAnswerRecordingState, setLearningAnswerRecordingState] = useState<RecordingState>("idle");
  const learningAnswerMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const learningAnswerRecordingStreamRef = useRef<MediaStream | null>(null);
  const learningAnswerRecordingChunksRef = useRef<BlobPart[]>([]);
  const learningAnswerRecordingStateRef = useRef<RecordingState>(learningAnswerRecordingState);
  const items = useQuery({ queryKey: ["learning"], queryFn: () => vaultRequest<LearningItem[]>("learning.items") });
  const learningItems = useMemo(() => items.data ?? [], [items.data]);
  const selectedLearningItem = learningItems.find((item) => item.id === selectedLearningItemId) ?? learningItems[0];
  const generate = useMutation({
    mutationFn: () => vaultRequest("learning.generateDeck", { topic, deck_size: 6 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["learning"] });
    }
  });
  const speakItem = useMutation<any | null, Error, LearningItem>({
    mutationFn: async (item) => {
      const text = learningItemSpeechText(item);
      if (!text) return null;
      return vaultRequest("voice.synthesize", {
        text,
        voice_id: "mock-local-voice",
        format: "wav",
        local_only: true,
        cache: true
      });
    },
    onSuccess: async (result) => {
      if (!result) return;
      setSpeechResult(result);
      setSpeechAudioUrl("");
      setSpeechError("");
      if (result.speech_asset_id) {
        try {
          const audio = await vaultRequest<any>("voice.speechAssetAudio", { speechAssetId: result.speech_asset_id });
          setSpeechAudioUrl(String(audio.data_url ?? ""));
        } catch (error) {
          setSpeechError(error instanceof Error ? error.message : "Could not load generated lesson audio.");
        }
      }
      queryClient.invalidateQueries({ queryKey: ["voice-speech-assets"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });

  useEffect(() => {
    if (!learningItems.length) {
      if (selectedLearningItemId) setSelectedLearningItemId("");
      return;
    }
    if (!selectedLearningItemId || !learningItems.some((item) => item.id === selectedLearningItemId)) {
      setSelectedLearningItemId(learningItems[0].id);
    }
  }, [learningItems, selectedLearningItemId]);

  useEffect(
    () => () => {
      const recorder = learningAnswerMediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      stopLearningAnswerRecordingTracks();
    },
    []
  );

  useEffect(() => {
    learningAnswerRecordingStateRef.current = learningAnswerRecordingState;
  }, [learningAnswerRecordingState]);

  async function startLearningAnswerRecording() {
    const item = selectedLearningItem;
    if (!item || learningAnswerRecordingStateRef.current !== "idle") return;
    learningAnswerRecordingStateRef.current = "processing";
    setLearningAnswerError("");
    setLearningAnswerResult(null);
    setLearningAnswerTranscript("");
    setLearningAnswerSession(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setLearningAnswerError("Microphone recording is not available in this environment.");
      learningAnswerRecordingStateRef.current = "idle";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = supportedRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      learningAnswerRecordingStreamRef.current = stream;
      learningAnswerMediaRecorderRef.current = recorder;
      learningAnswerRecordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) learningAnswerRecordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setLearningAnswerError("Microphone recording failed.");
      };
      recorder.onstop = () => {
        void finishLearningAnswerRecording(recorder, item);
      };
      recorder.start();
      learningAnswerRecordingStateRef.current = "recording";
      setLearningAnswerRecordingState("recording");
    } catch (error) {
      setLearningAnswerError(error instanceof Error ? error.message : "Could not start microphone recording.");
      stopLearningAnswerRecordingTracks();
      learningAnswerRecordingStateRef.current = "idle";
      setLearningAnswerRecordingState("idle");
    }
  }

  function stopLearningAnswerRecording() {
    const recorder = learningAnswerMediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    learningAnswerRecordingStateRef.current = "processing";
    setLearningAnswerRecordingState("processing");
    recorder.stop();
  }

  async function finishLearningAnswerRecording(recorder: MediaRecorder, item: LearningItem) {
    try {
      const mimeType = recorder.mimeType || supportedRecordingMimeType() || "audio/webm";
      const blob = new Blob(learningAnswerRecordingChunksRef.current, { type: mimeType });
      const saved = await saveAudioRecording(await blobToArrayBuffer(blob), mimeType);
      const result = await vaultRequest<any>("voice.transcribe", {
        audio_path: saved.filePath,
        title: "Learning answer",
        create_source: false,
        local_only: true,
        metadata: {
          import_mode: "learning_answer_microphone",
          learning_item_id: item.id,
          mime_type: saved.mimeType,
          size_bytes: saved.sizeBytes
        }
      });
      const transcript = transcriptTextFromResult(result);
      setLearningAnswerResult(result);
      setLearningAnswerTranscript(transcript);
      if (!transcript) {
        setLearningAnswerError("No speech was transcribed.");
        return;
      }
      const session = await vaultRequest<any>("learning.session.start", { item_ids: [item.id] });
      const answered = await vaultRequest<any>("learning.session.answer", {
        sessionId: session.session_id,
        data: {
          item_id: item.id,
          answer_text: transcript,
          rating: "good",
          transcribed: true,
          audio_run_id: result?.run_id ?? null
        }
      });
      setLearningAnswerSession(answered);
      queryClient.invalidateQueries({ queryKey: ["learning"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    } catch (error) {
      setLearningAnswerError(error instanceof Error ? error.message : "Could not save the spoken answer.");
    } finally {
      stopLearningAnswerRecordingTracks();
      learningAnswerMediaRecorderRef.current = null;
      learningAnswerRecordingChunksRef.current = [];
      learningAnswerRecordingStateRef.current = "idle";
      setLearningAnswerRecordingState("idle");
    }
  }

  function stopLearningAnswerRecordingTracks() {
    learningAnswerRecordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    learningAnswerRecordingStreamRef.current = null;
  }

  return (
    <div className="surface learning-layout">
      <Panel>
        <SectionHeader
          title="Practice"
          description="Cards created from approved knowledge. New cards wait in Review before practice."
          actions={
            <Button icon={<Sparkles size={16} />} disabled={generate.isPending} onClick={() => generate.mutate()}>
              {generate.isPending ? "Creating" : "Create deck"}
            </Button>
          }
        />
        <label className="learning-topic-field">
          <span>New deck topic</span>
          <Input value={topic} onChange={(event) => setTopic(event.target.value)} />
        </label>
        <div className="entity-list learning-card-list">
          {items.isLoading && <div className="entity-list-empty">Loading practice...</div>}
          {!items.isLoading && (items.data ?? []).length === 0 && (
            <div className="entity-list-empty">
              <Brain size={18} />
              <strong>No practice items</strong>
              <span>Create a deck from approved knowledge. New items wait in Review before practice.</span>
            </div>
          )}
          {learningItems.map((item) => {
            const isSelected = selectedLearningItem?.id === item.id;
            return (
              <article key={item.id} className={isSelected ? "learning-card active" : "learning-card"}>
                <div>
                  <Badge tone={item.status === "active" ? "good" : "neutral"}>{item.status}</Badge>
                  <Badge tone="info">{item.type}</Badge>
                  {learningItemPhaseLabel(item) && <Badge tone="neutral">{learningItemPhaseLabel(item)}</Badge>}
                </div>
                <strong>{item.title}</strong>
                {learningItemPrompt(item) && <p>{learningItemPrompt(item)}</p>}
                {learningItemAnswer(item) && <small>{learningItemAnswer(item)}</small>}
                <div className="learning-card-actions">
                  <Button icon={<Play size={15} />} variant={isSelected ? "primary" : "quiet"} onClick={() => setSelectedLearningItemId(item.id)}>
                    Practice
                  </Button>
                  <Button
                    icon={<Volume2 size={15} />}
                    variant="quiet"
                    disabled={speakItem.isPending || !learningItemSpeechText(item)}
                    onClick={() => {
                      setSelectedLearningItemId(item.id);
                      speakItem.mutate(item);
                    }}
                  >
                    Read aloud
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
      <Panel className="wide-panel">
        <SectionHeader
          title="Current card"
          description="Practice one card at a time. Voice answers stay local."
          actions={
            selectedLearningItem ? (
              <Button
                icon={learningAnswerRecordingState === "recording" ? <Pause size={16} /> : <Mic size={16} />}
                variant={learningAnswerRecordingState === "recording" ? "primary" : "quiet"}
                disabled={learningAnswerRecordingState === "processing"}
                onClick={() => (learningAnswerRecordingState === "recording" ? stopLearningAnswerRecording() : void startLearningAnswerRecording())}
              >
                {learningAnswerRecordingState === "recording" ? "Stop answer" : learningAnswerRecordingState === "processing" ? "Saving" : "Answer by voice"}
              </Button>
            ) : undefined
          }
        />
        <div className="learning-voice-context" aria-label="Practice voice privacy">
          <Badge tone="good">local voice</Badge>
          <span>Read aloud and spoken answers stay local.</span>
        </div>
        <div className="learning-review-schedule">
          <Badge tone="warn">again: tomorrow</Badge>
          <Badge tone="info">good: 3 days</Badge>
          <Badge tone="good">easy: 7 days</Badge>
        </div>
        {selectedLearningItem && (
          <div className="learning-practice-card">
            <div className="learning-path-meta">
              <Badge tone="info">Selected card</Badge>
              {learningItemPhaseLabel(selectedLearningItem) && <Badge tone="neutral">{learningItemPhaseLabel(selectedLearningItem)}</Badge>}
              {learningItemScoreLabel(selectedLearningItem) && <Badge tone="good">{learningItemScoreLabel(selectedLearningItem)}</Badge>}
            </div>
            <strong>{selectedLearningItem.title}</strong>
            {learningItemPrompt(selectedLearningItem) && <p>{learningItemPrompt(selectedLearningItem)}</p>}
            {learningItemAnswer(selectedLearningItem) && <small>{learningItemAnswer(selectedLearningItem)}</small>}
          </div>
        )}
        {learningAnswerResult && (
          <div className="workflow-result">
            <Badge tone={learningAnswerResult.sent_off_device ? "bad" : "good"}>Spoken answer</Badge>
            <span title={String(learningAnswerResult.model_id ?? "mock-local-stt")}>{speechAssetPrivacyLabel(learningAnswerResult)}</span>
            <small>{learningAnswerTranscript}</small>
            {learningAnswerSession?.next_review && <small>Next review: {String(learningAnswerSession.next_review)}</small>}
          </div>
        )}
        {learningAnswerError && <small className="model-test-error">{learningAnswerError}</small>}
        {speechResult && (
          <div className="workflow-result">
            <Badge tone={speechResult.sent_off_device ? "bad" : "good"}>{speechResult.cached ? "Audio ready" : "Audio saved"}</Badge>
            <span title={String(speechResult.model_id ?? "")}>{speechAssetPrivacyLabel(speechResult)}</span>
            <small title={String(speechResult.speech_asset_id ?? "")}>Ready to play</small>
            {speechAudioUrl && <audio className="speech-player" src={speechAudioUrl} controls />}
          </div>
        )}
        {speakItem.error && <small className="model-test-error">{speakItem.error.message}</small>}
        {speechError && <small className="model-test-error">{speechError}</small>}
      </Panel>
    </div>
  );
}

function learningItemPrompt(item: LearningItem): string {
  return String(item.body?.front ?? item.body?.prompt ?? item.body?.sections?.[0]?.summary ?? item.body?.questions?.[0]?.question ?? item.title ?? "").trim();
}

function learningItemAnswer(item: LearningItem): string {
  return String(item.body?.back ?? item.body?.answer ?? item.body?.questions?.[0]?.answer ?? "").trim();
}

function learningItemPhaseLabel(item: LearningItem): string {
  const learning = item.body?.capsule_learning;
  const sequence = Number(learning?.sequence ?? item.body?.path?.[0]?.sequence ?? item.body?.questions?.[0]?.sequence ?? 0);
  const phase = String(learning?.phase ?? item.body?.path?.[0]?.phase ?? item.body?.questions?.[0]?.phase ?? "").trim();
  if (!phase && !sequence) return "";
  return [phase, sequence ? String(sequence) : ""].filter(Boolean).join(" ");
}

function learningItemScoreLabel(item: LearningItem): string {
  const scoring = item.body?.scoring;
  const passing = Number(scoring?.passing_score ?? 0);
  const max = Number(scoring?.max_score ?? 0);
  if (!passing || !max) return "";
  return `pass ${passing}/${max}`;
}

function learningItemSpeechText(item: LearningItem): string {
  const prompt = learningItemPrompt(item);
  const answer = learningItemAnswer(item);
  return [prompt && `Prompt: ${prompt}`, answer && `Answer: ${answer}`].filter(Boolean).join("\n\n");
}

function ToolsView() {
  const queryClient = useQueryClient();
  const setSurface = useUIStore((state) => state.setSurface);
  const tools = useQuery({ queryKey: ["tools"], queryFn: () => vaultRequest<Tool[]>("tools.list") });
  const [selectedToolId, setSelectedToolId] = useState<string>();
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [runInput, setRunInput] = useState("{\n  \"claim_ids\": []\n}");
  const [runInputError, setRunInputError] = useState("");
  const selected = tools.data?.find((tool) => tool.id === selectedToolId) ?? tools.data?.[0];
  const runs = useQuery({
    queryKey: ["tool-runs", selected?.id],
    queryFn: () => vaultRequest<ToolRunRecord[]>("tools.runs", { toolId: selected!.id }),
    enabled: Boolean(selected?.id)
  });
  const selectedRun = runs.data?.find((toolRun) => toolRun.id === selectedRunId) ?? runs.data?.[0];
  const run = useMutation({
    mutationFn: ({ tool, input }: { tool: Tool; input: Record<string, unknown> }) => vaultRequest<ToolRunRecord>("tools.run", { toolId: tool.id, data: { input } }),
    onSuccess: (result: any) => {
      setSelectedRunId(String(result.run_id ?? ""));
      queryClient.invalidateQueries({ queryKey: ["tool-runs"] });
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const test = useMutation({
    mutationFn: (tool: Tool) => vaultRequest("tools.runTests", { toolId: tool.id }),
    onSuccess: (result: any) => {
      setSelectedRunId(String(result.run_id ?? ""));
      queryClient.invalidateQueries({ queryKey: ["tool-runs"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const enableTool = useMutation({
    mutationFn: (tool: Tool) => vaultRequest("tools.enable", { toolId: tool.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const manifest = selected?.manifest ?? {};
  const importedToolNeedsEnable = selected?.status === "disabled" && manifest.imported_from_capsule === true && manifest.import_review_required === true;
  const permissions = Object.entries((manifest.permissions ?? {}) as Record<string, unknown>);
  const output = selectedRun?.output ?? {};
  function runSelectedTool() {
    if (!selected) return;
    try {
      const parsed = JSON.parse(runInput);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setRunInputError("Run input must be a JSON object.");
        return;
      }
      setRunInputError("");
      run.mutate({ tool: selected, input: parsed as Record<string, unknown> });
    } catch (error) {
      setRunInputError(error instanceof Error ? error.message : "Run input is not valid JSON.");
    }
  }
  return (
    <div className="surface split-view tool-studio-view">
      <Panel className="list-pane">
        <SectionHeader
          title="Local tools"
          eyebrow="Sandboxed helpers"
          description="Run approved local helpers against notes and Storage. Their output can create Review work, but cannot change trusted knowledge directly."
        />
        <div className="entity-list">
          {(tools.data ?? []).map((tool) => (
            <button key={tool.id} className={selected?.id === tool.id ? "active" : ""} onClick={() => setSelectedToolId(tool.id)}>
              <strong>{tool.name}</strong>
              <span>{tool.status} · {tool.version}</span>
            </button>
          ))}
        </div>
      </Panel>
      <Panel className="detail-pane">
        <SectionHeader
          title={selected?.name ?? "No tools installed yet."}
          eyebrow={selected?.status}
          actions={
            selected && (
              <>
                {importedToolNeedsEnable && (
                  <Button icon={<Check size={16} />} variant="secondary" disabled={enableTool.isPending} onClick={() => enableTool.mutate(selected)}>
                    {enableTool.isPending ? "Enabling" : "Enable"}
                  </Button>
                )}
                <Button icon={<Play size={16} />} disabled={run.isPending || selected.status !== "installed"} onClick={runSelectedTool}>
                  {run.isPending ? "Running" : "Run"}
                </Button>
                <Button icon={<Check size={16} />} variant="quiet" disabled={test.isPending || selected.status !== "installed"} onClick={() => test.mutate(selected)}>
                  {test.isPending ? "Testing" : "Test"}
                </Button>
              </>
            )
          }
        />
        {selected ? (
          <div className="tool-studio-grid">
            <section className="tool-contract-panel">
              <div className="tool-contract-header">
                <div>
                  <Badge tone={selected.status === "installed" ? "good" : "warn"}>{selected.status}</Badge>
                  {manifest.imported_from_capsule === true && <Badge tone="warn">imported</Badge>}
                  <Badge tone="info">{String(manifest.runtime ?? "runtime")}</Badge>
                  <Badge>{Number(manifest.timeout_ms ?? 0) / 1000}s timeout</Badge>
                </div>
                <small>{String(manifest.description ?? "No description supplied.")}</small>
              </div>
              <div className="tool-permission-grid" aria-label="Tool permissions">
                {permissions.map(([key, value]) => (
                  <article key={key}>
                    <Badge tone={value ? (key === "write_canonical_graph" || key === "network" || key === "shell" ? "bad" : "warn") : "good"}>
                      {value ? "allowed" : "blocked"}
                    </Badge>
                    <span>{key.replace(/_/g, " ")}</span>
                  </article>
                ))}
              </div>
              <details className="payload-view">
                <summary>Manifest</summary>
                <pre>{JSON.stringify(manifest, null, 2)}</pre>
              </details>
            </section>
            <section className="tool-run-panel">
              <label>
                <span>Input</span>
                <Textarea value={runInput} onChange={(event) => setRunInput(event.target.value)} />
              </label>
              <small>Input is prepared locally before the helper starts.</small>
              {runInputError && <small className="model-test-error">{runInputError}</small>}
              {run.error && <small className="model-test-error">{run.error.message}</small>}
              {test.error && <small className="model-test-error">{test.error.message}</small>}
            </section>
            <section className="tool-run-history">
              <div className="tool-run-history-header">
                <h3>History</h3>
                <Button icon={<Check size={15} />} variant="quiet" disabled={!toolRunReviewCount(selectedRun)} onClick={() => setSurface("review")}>
                  Review output
                </Button>
              </div>
              <div className="tool-run-list" aria-label="Tool runs">
                {(runs.data ?? []).length === 0 && <p className="empty-copy">No runs yet.</p>}
                {(runs.data ?? []).map((toolRun) => (
                  <button key={toolRun.id} className={selectedRun?.id === toolRun.id ? "active" : ""} onClick={() => setSelectedRunId(toolRun.id)}>
                    <Badge tone={toolRun.status === "completed" ? "good" : toolRun.status === "failed" ? "bad" : "warn"} title={toolRun.status}>
                      {toolRunStatusLabel(toolRun.status)}
                    </Badge>
                    <strong>{toolRunFindingLabel(toolRun)}</strong>
                    <small>{toolRun.error ?? toolRun.finished_at ?? toolRun.started_at}</small>
                  </button>
                ))}
              </div>
            </section>
            <section className="tool-run-detail" aria-label="Helper result">
              {selectedRun ? (
                <>
                  <div className="tool-run-summary" aria-label="Helper result summary">
                    <Badge tone={selectedRun.status === "completed" ? "good" : selectedRun.status === "failed" ? "bad" : "warn"} title={selectedRun.status}>
                      {toolRunStatusLabel(selectedRun.status)}
                    </Badge>
                    <span>{toolRunFindingLabel(selectedRun)}</span>
                    <span>{toolRunReviewLabel(selectedRun)}</span>
                  </div>
                  {selectedRun.error && <small className="model-test-error">{selectedRun.error}</small>}
                  <details className="payload-view" open>
                    <summary>Result JSON</summary>
                    <pre>{JSON.stringify(output, null, 2)}</pre>
                  </details>
                  <details className="payload-view">
                    <summary>Stdout</summary>
                    <pre>{selectedRun.stdout || "No stdout."}</pre>
                  </details>
                  <details className="payload-view">
                    <summary>Stderr</summary>
                    <pre>{selectedRun.stderr || "No stderr."}</pre>
                  </details>
                </>
              ) : (
                <p className="empty-copy">Run or test this helper to see its result.</p>
              )}
            </section>
          </div>
        ) : (
          <p className="empty-copy">No local helpers are installed yet.</p>
        )}
      </Panel>
    </div>
  );
}

function toolRunFindingCount(run?: ToolRunRecord): number {
  const findings = run?.output?.findings;
  return Array.isArray(findings) ? findings.length : 0;
}

function toolRunReviewCount(run?: ToolRunRecord): number {
  const output = run?.output;
  const created = Number(output?._review_items_created);
  if (Number.isFinite(created) && created > 0) return created;
  const reviewItems = output?.review_items;
  return Array.isArray(reviewItems) ? reviewItems.length : 0;
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function toolRunFindingLabel(run?: ToolRunRecord): string {
  return countLabel(toolRunFindingCount(run), "finding");
}

function toolRunReviewLabel(run?: ToolRunRecord): string {
  return countLabel(toolRunReviewCount(run), "review item");
}

function toolRunStatusLabel(status?: string): string {
  if (!status) return "Waiting";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "running") return "Running";
  if (status === "queued") return "Queued";
  return searchModeLabel(status);
}

function SettingsView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"ai" | "routing" | "voice" | "privacy" | "export" | "raw">("ai");
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [embeddingProviderId, setEmbeddingProviderId] = useState("mock_embedding");
  const [embeddingModelId, setEmbeddingModelId] = useState("mock-local-embedding");
  const [embeddingEndpoint, setEmbeddingEndpoint] = useState("");
  const [embeddingModelPath, setEmbeddingModelPath] = useState("");
  const [embeddingServerPort, setEmbeddingServerPort] = useState("8767");
  const [embeddingDimensions, setEmbeddingDimensions] = useState("32");
  const [embeddingTimeout, setEmbeddingTimeout] = useState("15");
  const [rerankerProviderId, setRerankerProviderId] = useState("mock_reranker");
  const [rerankerModelId, setRerankerModelId] = useState("mock-local-reranker");
  const [rerankerEndpoint, setRerankerEndpoint] = useState("");
  const [rerankerModelPath, setRerankerModelPath] = useState("");
  const [rerankerTimeout, setRerankerTimeout] = useState("15");
  const [sttProviderId, setSttProviderId] = useState("mock_stt");
  const [sttModelId, setSttModelId] = useState("mock-local-stt");
  const [sttManagedModelId, setSttManagedModelId] = useState("");
  const [sttBinaryPath, setSttBinaryPath] = useState("");
  const [sttModelPath, setSttModelPath] = useState("");
  const [sttLanguage, setSttLanguage] = useState("");
  const [sttTimeout, setSttTimeout] = useState("120");
  const [sttCloudConsent, setSttCloudConsent] = useState(false);
  const [ttsProviderId, setTtsProviderId] = useState("mock_tts");
  const [ttsModelId, setTtsModelId] = useState("mock-local-tts");
  const [ttsVoiceId, setTtsVoiceId] = useState("mock-local-voice");
  const [ttsBinaryPath, setTtsBinaryPath] = useState("");
  const [ttsModelPath, setTtsModelPath] = useState("");
  const [ttsConfigPath, setTtsConfigPath] = useState("");
  const [ttsTimeout, setTtsTimeout] = useState("60");
  const [ttsCloudConsent, setTtsCloudConsent] = useState(false);
  const [settingsSpeechAudio, setSettingsSpeechAudio] = useState<{ assetId: string; dataUrl: string } | null>(null);
  const [microphonePermissionStatus, setMicrophonePermissionStatus] = useState<MicrophonePermissionStatus>("checking");
  const [microphonePermissionDetail, setMicrophonePermissionDetail] = useState("Checking microphone access.");
  const [microphonePreflightBusy, setMicrophonePreflightBusy] = useState(false);
  const [readinessExportStatus, setReadinessExportStatus] = useState<string | null>(null);
  const [approvalTemplateExportStatus, setApprovalTemplateExportStatus] = useState<string | null>(null);
  const [registryReleaseExportStatus, setRegistryReleaseExportStatus] = useState<string | null>(null);
  const [workspaceExportStatus, setWorkspaceExportStatus] = useState<string | null>(null);
  const [candidateReleasePlan, setCandidateReleasePlan] = useState<AIRegistryReleasePlanExport | null>(null);
  const [candidateReleasePayload, setCandidateReleasePayload] = useState<AIRegistryReleasePlanEvaluateInput | null>(null);
  const [candidateMetadataHydration, setCandidateMetadataHydration] = useState<AIRegistryMetadataHydrationExport | null>(null);
  const [candidateArtifactProbe, setCandidateArtifactProbe] = useState<AIRegistryArtifactProbeExport | null>(null);
  const [candidateArtifactVerification, setCandidateArtifactVerification] = useState<AIRegistryArtifactVerificationExport | null>(null);
  const [candidateEvidenceOverlay, setCandidateEvidenceOverlay] = useState<AIRegistryEvidenceOverlayExport | null>(null);
  const [candidateReleasePacket, setCandidateReleasePacket] = useState<AIRegistryReleasePacket | null>(null);
  const [candidateReleaseStatus, setCandidateReleaseStatus] = useState<string | null>(null);
  const [candidateWorkspaceStatus, setCandidateWorkspaceStatus] = useState<string | null>(null);
  const releaseWorkspaceRestored = useRef(false);
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => vaultRequest<any>("settings.get") });
  const providers = useQuery({ queryKey: ["ai-providers"], queryFn: () => vaultRequest<AIProviderInfo[]>("ai.providers") });
  const capabilities = useQuery({ queryKey: ["ai-capabilities"], queryFn: () => vaultRequest<CapabilityBinding[]>("ai.capabilities") });
  const hardware = useQuery({ queryKey: ["ai-hardware"], queryFn: () => vaultRequest<HardwareProfile>("ai.hardware") });
  const registry = useQuery({
    queryKey: ["ai-model-registry"],
    queryFn: () => vaultRequest<{ models: AIModelInfo[] }>("ai.models.registry")
  });
  const modelPacks = useQuery({
    queryKey: ["ai-model-packs"],
    queryFn: () => vaultRequest<AIModelPackInfo[]>("ai.modelPacks")
  });
  const setupStatus = useQuery({
    queryKey: ["ai-setup-status"],
    queryFn: () => vaultRequest<AISetupStatus>("ai.setup.status")
  });
  const readinessReport = useQuery({
    queryKey: ["ai-readiness-report"],
    queryFn: () => vaultRequest<AIProductionReadinessReport>("ai.readiness.report")
  });
  const createWorkspaceExport = useMutation<WorkspaceExportResult, Error>({
    mutationFn: () => vaultRequest<WorkspaceExportResult>("export.workspace", {}),
    onSuccess: (result) => {
      const counts = result.manifest.counts ?? {};
      setWorkspaceExportStatus(
        `Created ${result.filename} (${formatBytes(result.size_bytes)}) with ${counts.notes ?? 0} notes, ${counts.sources ?? 0} sources, and ${counts.claims ?? 0} claims at ${result.file_path}.`
      );
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error) => {
      setWorkspaceExportStatus(error instanceof Error ? error.message : "Workspace export failed.");
    }
  });
  const exportReadinessReport = useMutation({
    mutationFn: async () => {
      const exported = await vaultRequest<AIProductionReadinessExport>("ai.readiness.report.export");
      const saved = await saveTextFile(exported.filename, exported.markdown, exported.mime_type);
      return { exported, saved };
    },
    onSuccess: ({ exported, saved }) => {
      setReadinessExportStatus(
        saved.saved
          ? `Saved ${exported.filename}${saved.filePath ? ` to ${saved.filePath}` : ""}.`
          : "Readiness export cancelled."
      );
    },
    onError: (error) => {
      setReadinessExportStatus(error instanceof Error ? error.message : "Readiness export failed.");
    }
  });
  const exportApprovalTemplate = useMutation({
    mutationFn: async (format: "markdown" | "evidence" = "markdown") => {
      const exported = await vaultRequest<AIApprovalTemplateExport>("ai.readiness.approvalTemplate.export");
      const filename = format === "evidence" ? exported.evidence_filename : exported.filename;
      const contents = format === "evidence" ? exported.evidence_json : exported.markdown;
      const mimeType = format === "evidence" ? exported.evidence_mime_type : exported.mime_type;
      const saved = await saveTextFile(filename, contents, mimeType);
      return { saved, filename, format };
    },
    onSuccess: ({ saved, filename, format }) => {
      setApprovalTemplateExportStatus(
        saved.saved
          ? `Saved ${filename}${saved.filePath ? ` to ${saved.filePath}` : ""}.`
          : `${format === "evidence" ? "Evidence JSON" : "Approval template"} export cancelled.`
      );
    },
    onError: (error) => {
      setApprovalTemplateExportStatus(error instanceof Error ? error.message : "Approval template export failed.");
    }
  });
  const registryValidation = useQuery({
    queryKey: ["ai-registry-validation"],
    queryFn: () => vaultRequest<AIRegistryValidationReport>("ai.registry.validation")
  });
  const registryReleasePlan = useQuery({
    queryKey: ["ai-registry-release-plan"],
    queryFn: () => vaultRequest<AIRegistryReleasePlanReport>("ai.registry.releasePlan")
  });
  const releaseWorkspace = useQuery({
    queryKey: ["ai-registry-release-workspace"],
    queryFn: () => vaultRequest<AIRegistryReleaseWorkspace>("ai.registry.releaseWorkspace")
  });
  const exportRegistryReleasePlan = useMutation({
    mutationFn: async () => {
      const exported = await vaultRequest<AIRegistryReleasePlanExport>("ai.registry.releasePlan.export");
      const saved = await saveTextFile(exported.filename, exported.markdown, exported.mime_type);
      return { exported, saved };
    },
    onSuccess: ({ exported, saved }) => {
      setRegistryReleaseExportStatus(
        saved.saved
          ? `Saved ${exported.filename}${saved.filePath ? ` to ${saved.filePath}` : ""}.`
          : "Export cancelled."
      );
    },
    onError: (error) => {
      setRegistryReleaseExportStatus(error instanceof Error ? error.message : "Release plan export failed.");
    }
  });
  const saveReleaseWorkspace = useMutation({
    mutationFn: (payload: AIRegistryReleaseWorkspaceSaveInput) =>
      vaultRequest<AIRegistryReleaseWorkspace>("ai.registry.releaseWorkspace.save", payload),
    onSuccess: (workspace) => {
      queryClient.setQueryData(["ai-registry-release-workspace"], workspace);
      setCandidateWorkspaceStatus(`Saved setup draft${workspace.updated_at ? ` at ${formatTimestamp(workspace.updated_at)}` : ""}.`);
    },
    onError: (error) => {
      setCandidateWorkspaceStatus(error instanceof Error ? error.message : "Setup draft save failed.");
    }
  });
  const clearReleaseWorkspace = useMutation({
    mutationFn: () => vaultRequest<AIRegistryReleaseWorkspace>("ai.registry.releaseWorkspace.clear"),
    onSuccess: (workspace) => {
      queryClient.setQueryData(["ai-registry-release-workspace"], workspace);
      setCandidateReleasePlan(null);
      setCandidateReleasePayload(null);
      setCandidateMetadataHydration(null);
      setCandidateArtifactProbe(null);
      setCandidateArtifactVerification(null);
      setCandidateEvidenceOverlay(null);
      setCandidateReleasePacket(null);
      setCandidateReleaseStatus(null);
      setCandidateWorkspaceStatus("Cleared saved setup draft.");
    },
    onError: (error) => {
      setCandidateWorkspaceStatus(error instanceof Error ? error.message : "Setup draft clear failed.");
    }
  });

  function buildCandidateWorkspacePayload(overrides: Partial<AIRegistryReleaseWorkspaceSaveInput> = {}): AIRegistryReleaseWorkspaceSaveInput {
    return {
      candidate_payload: candidateReleasePayload,
      candidate_release_plan: candidateReleasePlan,
      candidate_metadata_hydration: candidateMetadataHydration,
      candidate_artifact_probe: candidateArtifactProbe,
      candidate_artifact_verification: candidateArtifactVerification,
      candidate_evidence: candidateEvidenceOverlay,
      candidate_release_packet: candidateReleasePacket,
      candidate_status: candidateReleaseStatus,
      ...overrides
    };
  }

  function persistCandidateWorkspace(overrides: Partial<AIRegistryReleaseWorkspaceSaveInput> = {}) {
    const payload = buildCandidateWorkspacePayload(overrides);
    const hasCandidateState = Boolean(
      payload.candidate_payload ||
        payload.candidate_release_plan ||
        payload.candidate_metadata_hydration ||
        payload.candidate_artifact_probe ||
        payload.candidate_artifact_verification ||
        payload.candidate_evidence ||
        payload.candidate_release_packet
    );
    if (!hasCandidateState) {
      setCandidateWorkspaceStatus("Evaluate candidate files before saving a setup draft.");
      return;
    }
    saveReleaseWorkspace.mutate(payload);
  }

  const evaluateCandidateReleasePlan = useMutation({
    mutationFn: async () => {
      const files = await selectRegistryFiles();
      if (!files.length) return null;
      const candidatePayload = await parseCandidateRegistryFiles(files);
      const candidate = await vaultRequest<AIRegistryReleasePlanExport>("ai.registry.releasePlan.evaluate", candidatePayload);
      return { candidate, candidatePayload };
    },
    onMutate: () => {
      setCandidateReleaseStatus("Evaluating candidate files...");
    },
    onSuccess: (result) => {
      if (!result) {
        setCandidateReleaseStatus("Candidate evaluation cancelled.");
        return;
      }
      const { candidate, candidatePayload } = result;
      setCandidateReleasePlan(candidate);
      setCandidateReleasePayload(candidatePayload);
      setCandidateMetadataHydration(null);
      setCandidateArtifactProbe(null);
      setCandidateArtifactVerification(null);
      setCandidateEvidenceOverlay(null);
      setCandidateReleasePacket(null);
      const summary = candidate.plan.summary;
      const status =
        `Evaluated ${candidate.model_registry_label ?? "bundled model file"} + ${candidate.runtime_registry_label ?? "bundled runtime file"}: ` +
          `${summary.ready_production_pack_count}/${summary.production_pack_count} packs, ` +
          `${summary.ready_production_model_count}/${summary.production_model_count} models, ` +
          `${summary.ready_production_runtime_count}/${summary.production_runtime_count} runtimes ready to trust.`;
      setCandidateReleaseStatus(status);
      persistCandidateWorkspace({
        candidate_payload: candidatePayload,
        candidate_release_plan: candidate,
        candidate_metadata_hydration: null,
        candidate_artifact_probe: null,
        candidate_artifact_verification: null,
        candidate_evidence: null,
        candidate_release_packet: null,
        candidate_status: status
      });
    },
    onError: (error) => {
      setCandidateReleaseStatus(error instanceof Error ? error.message : "Candidate file evaluation failed.");
    }
  });
  const hydrateCandidateMetadata = useMutation({
    mutationFn: async () => {
      if (!candidateReleasePayload?.model_registry) throw new Error("Evaluate candidate files before checking source metadata.");
      const payload: AIRegistryMetadataHydrationInput = {
        model_registry: candidateReleasePayload.model_registry,
        runtime_registry: candidateReleasePayload.runtime_registry,
        model_registry_label: candidateReleasePayload.model_registry_label,
        runtime_registry_label: candidateReleasePayload.runtime_registry_label
      };
      return vaultRequest<AIRegistryMetadataHydrationExport>("ai.registry.metadata.hydrate", payload);
    },
    onMutate: () => {
      setCandidateReleaseStatus("Checking source metadata...");
    },
    onSuccess: (hydration) => {
      setCandidateMetadataHydration(hydration);
      if (hydration.status !== "hydrated" || !hydration.release_plan) {
        const status =
          `Source metadata check blocked: ${hydration.summary.error_count} errors, ${hydration.summary.warning_count} warnings.`
        setCandidateReleaseStatus(status);
        persistCandidateWorkspace({
          candidate_metadata_hydration: hydration,
          candidate_status: status
        });
        return;
      }
      const nextPayload: AIRegistryReleasePlanEvaluateInput = {
        model_registry: hydration.model_registry,
        runtime_registry: candidateReleasePayload?.runtime_registry,
        model_registry_label: hydration.model_registry_label,
        runtime_registry_label: hydration.runtime_registry_label,
        model_registry_sha256: hydration.model_registry_sha256,
        runtime_registry_sha256: candidateReleasePayload?.runtime_registry_sha256
      };
      const nextCandidate: AIRegistryReleasePlanExport = {
        generated_at: hydration.generated_at,
        filename: "candidate-ai-registry-release-plan.md",
        mime_type: "text/markdown",
        markdown: hydration.release_plan_markdown ?? "",
        plan: hydration.release_plan,
        model_registry_label: hydration.model_registry_label,
        runtime_registry_label: hydration.runtime_registry_label
      };
      setCandidateReleasePayload(nextPayload);
      setCandidateArtifactProbe(null);
      setCandidateArtifactVerification(null);
      setCandidateEvidenceOverlay(null);
      setCandidateReleasePacket(null);
      setCandidateReleasePlan(nextCandidate);
      const summary = hydration.release_plan.summary;
      const status =
        `Checked ${hydration.summary.updated_field_count} metadata fields: ` +
          `${summary.ready_production_pack_count}/${summary.production_pack_count} packs, ` +
          `${summary.ready_production_model_count}/${summary.production_model_count} models, ` +
          `${summary.ready_production_runtime_count}/${summary.production_runtime_count} runtimes ready to trust.`;
      setCandidateReleaseStatus(status);
      persistCandidateWorkspace({
        candidate_payload: nextPayload,
        candidate_release_plan: nextCandidate,
        candidate_metadata_hydration: hydration,
        candidate_artifact_probe: null,
        candidate_artifact_verification: null,
        candidate_evidence: null,
        candidate_release_packet: null,
        candidate_status: status
      });
    },
    onError: (error) => {
      setCandidateReleaseStatus(error instanceof Error ? error.message : "Candidate source metadata check failed.");
    }
  });
  const exportHydratedModelRegistry = useMutation({
    mutationFn: async () => {
      if (!candidateMetadataHydration) throw new Error("Check candidate source metadata before exporting.");
      const saved = await saveTextFile(
        candidateMetadataHydration.filename,
        candidateMetadataHydration.model_registry_json,
        candidateMetadataHydration.mime_type
      );
      return { hydration: candidateMetadataHydration, saved };
    },
    onSuccess: ({ hydration, saved }) => {
      setCandidateReleaseStatus(
        saved.saved
          ? `Saved ${hydration.filename}${saved.filePath ? ` to ${saved.filePath}` : ""}.`
          : "Checked model file export cancelled."
      );
    },
    onError: (error) => {
      setCandidateReleaseStatus(error instanceof Error ? error.message : "Checked model file export failed.");
    }
  });
  const exportCandidateReleasePlan = useMutation({
    mutationFn: async () => {
      if (!candidateReleasePlan) throw new Error("Evaluate candidate files before exporting.");
      const saved = await saveTextFile(candidateReleasePlan.filename, candidateReleasePlan.markdown, candidateReleasePlan.mime_type);
      return { exported: candidateReleasePlan, saved };
    },
    onSuccess: ({ exported, saved }) => {
      setCandidateReleaseStatus(
        saved.saved
          ? `Saved ${exported.filename}${saved.filePath ? ` to ${saved.filePath}` : ""}.`
          : "Candidate export cancelled."
      );
    },
    onError: (error) => {
      setCandidateReleaseStatus(error instanceof Error ? error.message : "Candidate release plan export failed.");
    }
  });
  const probeCandidateArtifacts = useMutation({
    mutationFn: async () => {
      if (!candidateReleasePayload) throw new Error("Evaluate candidate files before checking sources.");
      return vaultRequest<AIRegistryArtifactProbeExport>("ai.registry.artifactProbe.evaluate", candidateReleasePayload);
    },
    onMutate: () => {
      setCandidateReleaseStatus("Checking candidate sources...");
    },
    onSuccess: (probe) => {
      setCandidateArtifactProbe(probe);
      const summary = probe.report.summary;
      const status =
        `Checked candidate sources: ${summary.pass_count}/${summary.check_count} checks passed, ` +
        `${summary.blocked_count} items, ${summary.warn_count} warnings, ${summary.pending_count} pending.`;
      setCandidateReleaseStatus(status);
      persistCandidateWorkspace({
        candidate_artifact_probe: probe,
        candidate_status: status
      });
    },
    onError: (error) => {
      setCandidateReleaseStatus(error instanceof Error ? error.message : "Candidate source check failed.");
    }
  });
  const exportCandidateArtifactProbe = useMutation({
    mutationFn: async () => {
      if (!candidateArtifactProbe) throw new Error("Check candidate sources before exporting the source report.");
      const saved = await saveTextFile(candidateArtifactProbe.filename, candidateArtifactProbe.markdown, candidateArtifactProbe.mime_type);
      return { exported: candidateArtifactProbe, saved };
    },
    onSuccess: ({ exported, saved }) => {
      setCandidateReleaseStatus(
        saved.saved
          ? `Saved ${exported.filename}${saved.filePath ? ` to ${saved.filePath}` : ""}.`
          : "Candidate source check export cancelled."
      );
    },
    onError: (error) => {
      setCandidateReleaseStatus(error instanceof Error ? error.message : "Candidate source check export failed.");
    }
  });
  const verifyCandidateArtifacts = useMutation({
    mutationFn: async () => {
      if (!candidateReleasePayload) throw new Error("Evaluate candidate files before verifying files.");
      return vaultRequest<AIRegistryArtifactVerificationExport>("ai.registry.artifactVerify.evaluate", candidateReleasePayload);
    },
    onMutate: () => {
      setCandidateReleaseStatus("Verifying candidate files...");
    },
    onSuccess: (verification) => {
      setCandidateArtifactVerification(verification);
      const summary = verification.report.summary;
      const status =
        `Verified candidate files: ${summary.verified_file_count}/${summary.file_count} files, ` +
        `${summary.blocked_count} items, ${summary.evidence_model_count + summary.evidence_runtime_count} evidence entries.`;
      setCandidateReleaseStatus(status);
      persistCandidateWorkspace({
        candidate_artifact_verification: verification,
        candidate_status: status
      });
    },
    onError: (error) => {
      setCandidateReleaseStatus(error instanceof Error ? error.message : "Candidate file verification failed.");
    }
  });
  const exportCandidateArtifactVerification = useMutation({
    mutationFn: async (format: "report" | "evidence" = "report") => {
      if (!candidateArtifactVerification) throw new Error("Verify candidate files before exporting file evidence.");
      const filename = format === "evidence" ? candidateArtifactVerification.evidence_filename : candidateArtifactVerification.filename;
      const contents = format === "evidence" ? candidateArtifactVerification.evidence_json : candidateArtifactVerification.markdown;
      const mimeType = format === "evidence" ? candidateArtifactVerification.evidence_mime_type : candidateArtifactVerification.mime_type;
      const saved = await saveTextFile(filename, contents, mimeType);
      return { saved, filename, format };
    },
    onSuccess: ({ saved, filename, format }) => {
      setCandidateReleaseStatus(
        saved.saved
          ? `Saved ${filename}${saved.filePath ? ` to ${saved.filePath}` : ""}.`
          : `Candidate file ${format} export cancelled.`
      );
    },
    onError: (error) => {
      setCandidateReleaseStatus(error instanceof Error ? error.message : "Candidate file verification export failed.");
    }
  });
  const exportCandidateApprovalTemplate = useMutation({
    mutationFn: async (format: "markdown" | "evidence" = "markdown") => {
      if (!candidateReleasePayload) throw new Error("Evaluate candidate files before exporting an approval template.");
      const exported = await vaultRequest<AIApprovalTemplateExport>("ai.readiness.approvalTemplate.evaluate", candidateReleasePayload);
      const filename = format === "evidence" ? exported.evidence_filename : exported.filename;
      const contents = format === "evidence" ? exported.evidence_json : exported.markdown;
      const mimeType = format === "evidence" ? exported.evidence_mime_type : exported.mime_type;
      const saved = await saveTextFile(filename, contents, mimeType);
      return { saved, filename, format };
    },
    onMutate: () => {
      setCandidateReleaseStatus("Exporting candidate approval template...");
    },
    onSuccess: ({ saved, filename, format }) => {
      setCandidateReleaseStatus(
        saved.saved
          ? `Saved ${filename}${saved.filePath ? ` to ${saved.filePath}` : ""}.`
          : `Candidate ${format === "evidence" ? "evidence file" : "approval template"} export cancelled.`
      );
    },
    onError: (error) => {
      setCandidateReleaseStatus(error instanceof Error ? error.message : "Candidate approval template export failed.");
    }
  });
  const applyCandidateEvidence = useMutation({
    mutationFn: async () => {
      if (!candidateReleasePayload) throw new Error("Evaluate candidate files before applying evidence.");
      const files = await selectRegistryFiles();
      const evidencePayload = parseEvidenceOverlayFiles(files);
      if (!evidencePayload) return null;
      const overlay = await vaultRequest<AIRegistryEvidenceOverlayExport>("ai.registry.evidence.apply", {
        ...candidateReleasePayload,
        ...evidencePayload
      });
      const saved = await saveTextFile(overlay.filename, overlay.bundle_json, overlay.mime_type);
      return { overlay, saved };
    },
    onMutate: () => {
      setCandidateReleaseStatus("Applying candidate evidence...");
    },
    onSuccess: (result) => {
      if (!result) {
        setCandidateReleaseStatus("Candidate evidence import cancelled.");
        return;
      }
      const { overlay, saved } = result;
      setCandidateEvidenceOverlay(overlay);
      const nextPayload: AIRegistryReleasePlanEvaluateInput = {
        model_registry: overlay.model_registry,
        runtime_registry: overlay.runtime_registry,
        model_registry_label: overlay.model_registry_label,
        runtime_registry_label: overlay.runtime_registry_label
      };
      const nextCandidate: AIRegistryReleasePlanExport = {
        generated_at: overlay.generated_at,
        filename: "candidate-ai-registry-release-plan.md",
        mime_type: "text/markdown",
        markdown: overlay.release_plan_markdown,
        plan: overlay.release_plan,
        model_registry_label: overlay.model_registry_label,
        runtime_registry_label: overlay.runtime_registry_label
      };
      setCandidateReleasePayload(nextPayload);
      setCandidateArtifactProbe(null);
      setCandidateArtifactVerification(null);
      setCandidateReleasePlan(nextCandidate);
      setCandidateReleasePacket(null);
      const summary = overlay.release_plan.summary;
      const savedText = saved.saved
        ? ` Saved ${overlay.filename}${saved.filePath ? ` to ${saved.filePath}` : ""}.`
        : " Evidence bundle save cancelled.";
      const status =
        `Applied ${overlay.applied_count} evidence fields: ` +
          `${summary.ready_production_pack_count}/${summary.production_pack_count} packs, ` +
          `${summary.ready_production_model_count}/${summary.production_model_count} models, ` +
          `${summary.ready_production_runtime_count}/${summary.production_runtime_count} runtimes ready to trust.` +
          savedText;
      setCandidateReleaseStatus(status);
      persistCandidateWorkspace({
        candidate_payload: nextPayload,
        candidate_release_plan: nextCandidate,
        candidate_artifact_probe: null,
        candidate_artifact_verification: null,
        candidate_evidence: overlay,
        candidate_release_packet: null,
        candidate_status: status
      });
    },
    onError: (error) => {
      setCandidateReleaseStatus(error instanceof Error ? error.message : "Candidate evidence application failed.");
    }
  });
  const prepareCandidateReleasePacket = useMutation<AIRegistryReleasePacket, Error, { probe_sources?: boolean; verify_bytes?: boolean } | void>({
    mutationFn: async (options) => {
      const candidate_evidence = candidateEvidenceOverlay ?? releaseWorkspace.data?.candidate_evidence ?? null;
      if (!candidate_evidence) throw new Error("Apply candidate evidence before preparing a setup bundle.");
      const payload: AIRegistryReleasePacketPrepareInput = {
        candidate_evidence,
        probe_sources: Boolean(options?.probe_sources),
        verify_bytes: Boolean(options?.verify_bytes)
      };
      return vaultRequest<AIRegistryReleasePacket>("ai.registry.releasePacket.prepare", payload);
    },
    onMutate: () => {
      setCandidateReleaseStatus("Preparing candidate setup bundle...");
    },
    onSuccess: (packet) => {
      setCandidateReleasePacket(packet);
      const status = `Prepared setup bundle with ${packet.artifacts.length} files in ${packet.output_dir}.`;
      setCandidateReleaseStatus(status);
      persistCandidateWorkspace({
        candidate_release_packet: packet,
        candidate_status: status
      });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error) => {
      setCandidateReleaseStatus(error instanceof Error ? error.message : "Candidate setup bundle preparation failed.");
    }
  });
  const exportPatchedCandidateRegistry = useMutation({
    mutationFn: async (registryType: "model" | "runtime") => {
      if (!candidateEvidenceOverlay) throw new Error("Apply candidate evidence before exporting prepared model files.");
      const filename =
        registryType === "model"
          ? candidateEvidenceOverlay.model_registry_filename
          : candidateEvidenceOverlay.runtime_registry_filename;
      const contents =
        registryType === "model"
          ? candidateEvidenceOverlay.model_registry_json
          : candidateEvidenceOverlay.runtime_registry_json;
      const saved = await saveTextFile(filename, contents, candidateEvidenceOverlay.mime_type);
      return { registryType, filename, saved };
    },
    onSuccess: ({ registryType, filename, saved }) => {
      const label = registryType === "model" ? "model file" : "runtime file";
      setCandidateReleaseStatus(
        saved.saved
          ? `Saved prepared ${label} ${filename}${saved.filePath ? ` to ${saved.filePath}` : ""}.`
          : `Prepared ${label} export cancelled.`
      );
    },
    onError: (error) => {
      setCandidateReleaseStatus(error instanceof Error ? error.message : "Prepared model file export failed.");
    }
  });
  const exportAppliedEvidenceMarkdown = useMutation({
    mutationFn: async (artifactType: "releasePlan" | "approvalTemplate" | "pinHandoff") => {
      if (!candidateEvidenceOverlay) throw new Error("Apply candidate evidence before exporting applied Markdown artifacts.");
      const filename =
        artifactType === "releasePlan"
          ? candidateEvidenceOverlay.release_plan_filename
          : artifactType === "pinHandoff"
            ? candidateEvidenceOverlay.pin_handoff_filename
          : candidateEvidenceOverlay.approval_template_filename;
      const contents =
        artifactType === "releasePlan"
          ? candidateEvidenceOverlay.release_plan_markdown
          : artifactType === "pinHandoff"
            ? candidateEvidenceOverlay.pin_handoff_markdown
          : candidateEvidenceOverlay.approval_template_markdown;
      const mimeType =
        artifactType === "releasePlan"
          ? candidateEvidenceOverlay.release_plan_mime_type
          : artifactType === "pinHandoff"
            ? candidateEvidenceOverlay.pin_handoff_mime_type
          : candidateEvidenceOverlay.approval_template_mime_type;
      const saved = await saveTextFile(filename, contents, mimeType);
      return { artifactType, filename, saved };
    },
    onSuccess: ({ artifactType, filename, saved }) => {
      const label =
        artifactType === "releasePlan"
          ? "applied release plan"
          : artifactType === "pinHandoff"
            ? "review commands"
            : "applied approval checklist";
      setCandidateReleaseStatus(
        saved.saved
          ? `Saved ${label} ${filename}${saved.filePath ? ` to ${saved.filePath}` : ""}.`
          : `${label[0].toUpperCase()}${label.slice(1)} export cancelled.`
      );
    },
    onError: (error) => {
      setCandidateReleaseStatus(error instanceof Error ? error.message : "Applied Markdown export failed.");
    }
  });
  const downloads = useQuery({
    queryKey: ["ai-model-downloads"],
    queryFn: () => vaultRequest<AIModelDownload[]>("ai.models.downloads"),
    refetchInterval: 1500
  });
  const runtime = useQuery({
    queryKey: ["ai-runtime-health"],
    queryFn: () => vaultRequest<RuntimeHealth>("ai.runtime.health")
  });
  const runtimeRegistry = useQuery({
    queryKey: ["ai-runtimes"],
    queryFn: () => vaultRequest<AIRuntimeInfo[]>("ai.runtimes.registry")
  });
  const runs = useQuery({ queryKey: ["ai-runs"], queryFn: () => vaultRequest<AIModelRun[]>("ai.runs", { limit: 8 }) });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => vaultRequest<LabJob[]>("jobs.list"), refetchInterval: 1500 });
  const voices = useQuery({ queryKey: ["voice-voices"], queryFn: () => vaultRequest<any[]>("voice.voices") });
  const voiceAssets = useQuery({ queryKey: ["voice-audio-assets"], queryFn: () => vaultRequest<any[]>("voice.audioAssets") });
  const speechAssets = useQuery({ queryKey: ["voice-speech-assets"], queryFn: () => vaultRequest<any[]>("voice.speechAssets") });
  const testModel = useMutation<AIModelTestResult, Error, string>({
    mutationFn: (modelId: string) => vaultRequest<AIModelTestResult>("ai.models.test", { modelId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
    }
  });
  const downloadModel = useMutation({
    mutationFn: (modelId: string) => vaultRequest("ai.models.download", { model_id: modelId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-registry"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-packs"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-downloads"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
    }
  });
  const downloadModelPack = useMutation({
    mutationFn: (packId: string) => vaultRequest("ai.modelPacks.download", { packId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-registry"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-packs"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-downloads"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const runSetup = useMutation<AISetupRunResult, Error, AISetupRunInput>({
    mutationFn: (input) =>
      vaultRequest<AISetupRunResult>("ai.setup.run", {
        mode: input.mode,
        pack_id: input.pack_id,
        install_runtimes: true,
        download_models: true,
        activate_routes: true,
        include_optional_models: Boolean(input.include_optional_models),
        timeout_seconds: 10
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-registry"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-packs"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-downloads"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtimes"] });
      queryClient.invalidateQueries({ queryKey: ["ai-capabilities"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const installRuntime = useMutation({
    mutationFn: (runtimeId: string) => vaultRequest("ai.runtimes.install", { runtimeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-runtimes"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const verifyRuntime = useMutation({
    mutationFn: (runtimeId: string) => vaultRequest("ai.runtimes.verify", { runtimeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-runtimes"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const deleteRuntime = useMutation({
    mutationFn: (runtimeId: string) => vaultRequest("ai.runtimes.delete", { runtimeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-runtimes"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const pauseDownload = useMutation({
    mutationFn: (downloadId: string) => vaultRequest("ai.models.download.pause", { downloadId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-registry"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-packs"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-downloads"] });
    }
  });
  const resumeDownload = useMutation({
    mutationFn: (downloadId: string) => vaultRequest("ai.models.download.resume", { downloadId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-registry"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-packs"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-downloads"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
    }
  });
  const cancelDownload = useMutation({
    mutationFn: (downloadId: string) => vaultRequest("ai.models.download.cancel", { downloadId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-registry"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-packs"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-downloads"] });
    }
  });
  const importModel = useMutation<AIModelImportResult | null, Error>({
    mutationFn: async () => {
      const files = await selectModelFiles();
      if (!files[0]) return null;
      return vaultRequest<AIModelImportResult>("ai.models.importLocal", { file_path: files[0] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-registry"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-packs"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
    }
  });
  const verifyModel = useMutation({
    mutationFn: (modelId: string) => vaultRequest("ai.models.verify", { modelId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-registry"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-packs"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-downloads"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
    }
  });
  const selectModel = useMutation({
    mutationFn: (modelId: string) => vaultRequest("ai.models.select", { modelId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-capabilities"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-registry"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-packs"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
    }
  });
  const unloadModel = useMutation({
    mutationFn: (modelId: string) => vaultRequest("ai.models.unload", { modelId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-registry"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-packs"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
    }
  });
  const deleteModel = useMutation({
    mutationFn: (modelId: string) => vaultRequest("ai.models.delete", { modelId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-registry"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-packs"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["ai-capabilities"] });
      queryClient.invalidateQueries({ queryKey: ["ai-model-downloads"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
    }
  });
  const testRuntime = useMutation<{ status: string; message?: string }>({
    mutationFn: () => vaultRequest<{ status: string; message?: string }>("ai.runtime.llamaCppTest", { dry_run: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
    }
  });
  const startLlamaServer = useMutation({
    mutationFn: (modelId: string) => vaultRequest("ai.runtime.llamaServer.start", { model_id: modelId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const stopLlamaServer = useMutation({
    mutationFn: () => vaultRequest("ai.runtime.llamaServer.stop"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const updateBinding = useMutation({
    mutationFn: (input: { capability: string; data: Record<string, unknown> }) =>
      vaultRequest("ai.capability.update", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-capabilities"] });
      queryClient.invalidateQueries({ queryKey: ["ai-runtime-health"] });
      queryClient.invalidateQueries({ queryKey: ["ai-setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const testEmbeddingRoute = useMutation<
    {
      provider: string;
      model_id: string;
      dimensions: number;
      vectors: number[][];
      model_fingerprint?: string;
      sent_off_device: boolean;
    },
    Error
  >({
    mutationFn: () =>
      vaultRequest("ai.embed", {
        texts: ["Local embedding route smoke vector."],
        local_only: true
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const testRerankerRoute = useMutation<
    { provider: string; model_id: string; results: Array<Record<string, unknown>>; sent_off_device: boolean },
    Error
  >({
    mutationFn: () =>
      vaultRequest("ai.rerank", {
        query: "local reranker smoke",
        candidates: [
          { id: "a", text: "Local reranker smoke result" },
          { id: "b", text: "Unrelated candidate" }
        ],
        local_only: true
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const reindexEmbeddings = useMutation<LabJob, Error>({
    mutationFn: () => vaultRequest<LabJob>("ai.embeddings.reindex", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const cancelJob = useMutation<LabJob, Error, string>({
    mutationFn: (jobId: string) => vaultRequest<LabJob>("jobs.cancel", { jobId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const synthesize = useMutation<any, Error>({
    mutationFn: () =>
      vaultRequest("voice.synthesize", {
        text: "The Vault local voice path is wired through the core.",
        voice_id: ttsVoiceId.trim() || "mock-local-voice",
        format: "wav",
        local_only: true,
        cache: true
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
      queryClient.invalidateQueries({ queryKey: ["voice-speech-assets"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const transcribe = useMutation({
    mutationFn: () => vaultRequest("voice.transcribe", { audio_path: "mock-voice-memo.wav", local_only: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-runs"] })
  });
  const transcribeFile = useMutation<any | null, Error>({
    mutationFn: async () => {
      const files = await selectFiles();
      if (!files[0]) return null;
      const filename = files[0].split(/[\\/]/).pop() ?? "Voice memo";
      const title = filename.replace(/\.[^.]+$/, "") || "Voice memo";
      return vaultRequest("voice.transcribe", {
        audio_path: files[0],
        title,
        create_source: true,
        local_only: true,
        metadata: { import_mode: "settings_voice_tab" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
      queryClient.invalidateQueries({ queryKey: ["voice-audio-assets"] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    }
  });
  const playSpeechAsset = useMutation<any, Error, string>({
    mutationFn: (speechAssetId: string) => vaultRequest("voice.speechAssetAudio", { speechAssetId }),
    onSuccess: (audio, speechAssetId) => {
      setSettingsSpeechAudio({ assetId: speechAssetId, dataUrl: String(audio.data_url ?? "") });
    }
  });
  const providerById = new Map((providers.data ?? []).map((provider) => [provider.id, provider]));
  const embedBinding = (capabilities.data ?? []).find((binding) => binding.capability === "embed_text");
  const rerankBinding = (capabilities.data ?? []).find((binding) => binding.capability === "rerank_results");
  const sttBinding = (capabilities.data ?? []).find((binding) => binding.capability === "transcribe_audio");
  const ttsBinding = (capabilities.data ?? []).find((binding) => binding.capability === "synthesize_speech");
  const models = registry.data?.models ?? [];
  const packs = modelPacks.data ?? [];
  const productionPacks = packs.filter((pack) => pack.release_channel === "production");
  const demoPacks = packs.filter((pack) => pack.release_channel === "demo");
  const recommendedProductionPack =
    productionPacks.find((pack) => pack.id === setupStatus.data?.recommended_pack_id) ??
    productionPacks.find((pack) => pack.profile === hardware.data?.recommended_profile) ??
    productionPacks[0];
  const demoSetupPack = demoPacks.find((pack) => pack.id === setupStatus.data?.demo_pack_id) ?? demoPacks[0];
  const managedRuntimes = runtimeRegistry.data ?? [];
  const sttModels = useMemo(() => models.filter((model) => model.kind === "stt" && model.runtime === "whisper_cpp"), [models]);
  const selectedManagedSttModel = sttModels.find((model) => model.id === sttManagedModelId);
  const llamaRuntime = runtime.data?.llama_cpp;
  const voiceRuntime = runtime.data?.voice as any;
  const ttsRuntimeState = voiceRuntime?.tts?.state ?? voiceRuntime?.state;
  const ttsRuntimeWarnings = voiceRuntime?.tts?.warnings ?? [];
  const latestEmbeddingJob = useMemo(
    () => (jobs.data ?? []).find((job) => job.job_type === "embedding_reindex"),
    [jobs.data]
  );
  const embeddingJobActive = latestEmbeddingJob?.status === "queued" || latestEmbeddingJob?.status === "running";
  const downloadActionBusy = pauseDownload.isPending || resumeDownload.isPending || cancelDownload.isPending;
  const runtimeActionBusy = installRuntime.isPending || verifyRuntime.isPending || deleteRuntime.isPending;
  const llamaServerProcess = llamaRuntime?.server_process;
  const llamaServerRunning = llamaServerProcess?.state === "running";
  const runtimeTone: "good" | "warn" | "bad" =
    llamaRuntime?.state === "ready" ? "good" : llamaRuntime?.state === "degraded" ? "warn" : "bad";
  const embeddingProvider = providerById.get(embeddingProviderId);
  const embeddingEndpointOk = embeddingProviderId !== "local_embedding_http" || isLoopbackEndpoint(embeddingEndpoint);
  const embeddingModelPathOk = embeddingProviderId !== "local_embedding" || Boolean(embeddingModelPath.trim());
  const embeddingServerPortNumber = Number.parseInt(embeddingServerPort, 10);
  const embeddingServerPortOk =
    embeddingProviderId !== "llama_cpp_server_embeddings" ||
    (Number.isFinite(embeddingServerPortNumber) && embeddingServerPortNumber >= 1 && embeddingServerPortNumber <= 65535);
  const embeddingCanSave =
    Boolean(embeddingProvider) &&
    embeddingEndpointOk &&
    embeddingModelPathOk &&
    embeddingServerPortOk &&
    (embeddingProviderId !== "local_embedding_http" || Boolean(embeddingEndpoint.trim()));
  const rerankerProvider = providerById.get(rerankerProviderId);
  const rerankerEndpointOk = rerankerProviderId !== "local_reranker_http" || isLoopbackEndpoint(rerankerEndpoint);
  const rerankerCanSave =
    Boolean(rerankerProvider) &&
    rerankerEndpointOk &&
    (rerankerProviderId !== "local_reranker_http" || Boolean(rerankerEndpoint.trim())) &&
    (rerankerProviderId !== "local_cross_encoder" || Boolean(rerankerModelPath.trim()));
  const sttProvider = providerById.get(sttProviderId);
  const sttProviderCloud = sttProvider?.locality === "cloud";
  const sttCanSave =
    Boolean(sttProvider) &&
    (!sttProviderCloud || sttCloudConsent) &&
    (sttProviderId !== "whisper_cpp" || (Boolean(sttBinaryPath.trim()) && Boolean(sttModelPath.trim())));
  const ttsProvider = providerById.get(ttsProviderId);
  const ttsProviderCloud = ttsProvider?.locality === "cloud";
  const ttsCanSave =
    Boolean(ttsProvider) &&
    (!ttsProviderCloud || ttsCloudConsent) &&
    (ttsProviderId !== "piper" || (Boolean(ttsBinaryPath.trim()) && Boolean(ttsModelPath.trim())));
  const sttDownloadBusy = Boolean(
    selectedManagedSttModel && ["queued", "downloading", "paused"].includes(selectedManagedSttModel.download_state)
  );
  const setupWizardBusy = downloadModelPack.isPending || runtimeActionBusy || runSetup.isPending;

  async function refreshMicrophonePermission() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicrophonePermissionStatus("unsupported");
      setMicrophonePermissionDetail("Microphone capture is unavailable in this environment.");
      return;
    }
    const permissionsApi = (navigator as any).permissions;
    if (!permissionsApi?.query) {
      setMicrophonePermissionStatus("prompt");
      setMicrophonePermissionDetail("Permission status is unavailable until the microphone is tested.");
      return;
    }
    setMicrophonePermissionStatus("checking");
    setMicrophonePermissionDetail("Checking microphone access.");
    try {
      const permission = await permissionsApi.query({ name: "microphone" });
      const state = String(permission.state ?? "prompt") as "granted" | "prompt" | "denied";
      setMicrophonePermissionStatus(state);
      setMicrophonePermissionDetail(microphonePermissionDetailForStatus(state));
      permission.onchange = () => {
        const nextState = String(permission.state ?? "prompt") as "granted" | "prompt" | "denied";
        setMicrophonePermissionStatus(nextState);
        setMicrophonePermissionDetail(microphonePermissionDetailForStatus(nextState));
      };
    } catch {
      setMicrophonePermissionStatus("prompt");
      setMicrophonePermissionDetail("Permission status is unavailable until the microphone is tested.");
    }
  }

  async function testMicrophoneAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicrophonePermissionStatus("unsupported");
      setMicrophonePermissionDetail("Microphone capture is unavailable in this environment.");
      return;
    }
    setMicrophonePreflightBusy(true);
    setMicrophonePermissionDetail("Opening microphone.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicrophonePermissionStatus("ready");
      setMicrophonePermissionDetail("Microphone ready for local dictation and voice questions.");
    } catch (error) {
      setMicrophonePermissionStatus("error");
      setMicrophonePermissionDetail(error instanceof Error ? error.message : "Microphone access failed.");
    } finally {
      setMicrophonePreflightBusy(false);
    }
  }

  useEffect(() => {
    void refreshMicrophonePermission();
  }, []);

  useEffect(() => {
    if (!embedBinding) return;
    setEmbeddingProviderId(embedBinding.provider_id);
    setEmbeddingModelId(embedBinding.model_id ?? "mock-local-embedding");
    setEmbeddingEndpoint(String(embedBinding.settings.endpoint_url ?? ""));
    setEmbeddingModelPath(String(embedBinding.settings.model_path ?? ""));
    setEmbeddingServerPort(String(embedBinding.settings.server_port ?? 8767));
    setEmbeddingDimensions(String(embedBinding.settings.dimensions ?? 32));
    setEmbeddingTimeout(String(embedBinding.settings.timeout_seconds ?? 15));
  }, [embedBinding]);

  useEffect(() => {
    if (!rerankBinding) return;
    setRerankerProviderId(rerankBinding.provider_id);
    setRerankerModelId(rerankBinding.model_id ?? "mock-local-reranker");
    setRerankerEndpoint(String(rerankBinding.settings.endpoint_url ?? ""));
    setRerankerModelPath(String(rerankBinding.settings.model_path ?? ""));
    setRerankerTimeout(String(rerankBinding.settings.timeout_seconds ?? 15));
  }, [rerankBinding]);

  useEffect(() => {
    if (!sttBinding) return;
    setSttProviderId(sttBinding.provider_id);
    setSttModelId(sttBinding.model_id ?? "mock-local-stt");
    setSttBinaryPath(String(sttBinding.settings.binary_path ?? ""));
    setSttModelPath(String(sttBinding.settings.model_path ?? ""));
    setSttLanguage(String(sttBinding.settings.language ?? ""));
    setSttTimeout(String(sttBinding.settings.timeout_seconds ?? 120));
  }, [sttBinding]);

  useEffect(() => {
    if (!sttBinding) return;
    const savedModel = sttModels.find((model) => model.id === sttBinding.model_id);
    setSttManagedModelId(savedModel?.id ?? "");
  }, [sttBinding, sttModels]);

  useEffect(() => {
    setSttCloudConsent(false);
  }, [sttProviderId]);

  useEffect(() => {
    if (!ttsBinding) return;
    setTtsProviderId(ttsBinding.provider_id);
    setTtsModelId(ttsBinding.model_id ?? "mock-local-tts");
    setTtsVoiceId(String(ttsBinding.settings.voice_id ?? "mock-local-voice"));
    setTtsBinaryPath(String(ttsBinding.settings.binary_path ?? ""));
    setTtsModelPath(String(ttsBinding.settings.model_path ?? ""));
    setTtsConfigPath(String(ttsBinding.settings.config_path ?? ""));
    setTtsTimeout(String(ttsBinding.settings.timeout_seconds ?? 60));
  }, [ttsBinding]);

  useEffect(() => {
    setTtsCloudConsent(false);
  }, [ttsProviderId]);

  useEffect(() => {
    if (!setupStatus.data && !modelPacks.data && !runtimeRegistry.data && !capabilities.data) return;
    queryClient.invalidateQueries({ queryKey: ["ai-readiness-report"] });
    queryClient.invalidateQueries({ queryKey: ["ai-registry-validation"] });
    queryClient.invalidateQueries({ queryKey: ["ai-registry-release-plan"] });
  }, [queryClient, setupStatus.dataUpdatedAt, modelPacks.dataUpdatedAt, runtimeRegistry.dataUpdatedAt, capabilities.dataUpdatedAt]);

  useEffect(() => {
    if (releaseWorkspaceRestored.current || releaseWorkspace.isLoading) return;
    const workspace = releaseWorkspace.data;
    if (!workspace) return;
    releaseWorkspaceRestored.current = true;
    if (!workspace.has_workspace) return;
    setCandidateReleasePlan(workspace.candidate_release_plan ?? null);
    setCandidateReleasePayload(workspace.candidate_payload ?? null);
    setCandidateMetadataHydration(workspace.candidate_metadata_hydration ?? null);
    setCandidateArtifactProbe(workspace.candidate_artifact_probe ?? null);
    setCandidateArtifactVerification(workspace.candidate_artifact_verification ?? null);
    setCandidateEvidenceOverlay(workspace.candidate_evidence ?? null);
    setCandidateReleasePacket(workspace.candidate_release_packet ?? null);
    setCandidateReleaseStatus(workspace.candidate_status ?? null);
    setCandidateWorkspaceStatus(`Restored setup draft${workspace.updated_at ? ` from ${formatTimestamp(workspace.updated_at)}` : ""}.`);
  }, [releaseWorkspace.data, releaseWorkspace.isLoading]);

  function saveEmbeddingRoute() {
    const dimensions = Number.parseInt(embeddingDimensions, 10);
    const timeout = Number.parseFloat(embeddingTimeout);
    const serverPort = Number.parseInt(embeddingServerPort, 10);
    const settingsPayload =
      embeddingProviderId === "local_embedding_http"
        ? {
            endpoint_url: embeddingEndpoint.trim(),
            dimensions: Number.isFinite(dimensions) ? dimensions : 32,
            timeout_seconds: Number.isFinite(timeout) ? timeout : 15
          }
        : embeddingProviderId === "local_embedding"
          ? {
              model_path: embeddingModelPath.trim(),
              dimensions: Number.isFinite(dimensions) ? dimensions : 32
            }
        : embeddingProviderId === "llama_cpp_server_embeddings"
          ? {
              dimensions: Number.isFinite(dimensions) ? dimensions : 32,
              server_port: Number.isFinite(serverPort) ? serverPort : 8767,
              timeout_seconds: Number.isFinite(timeout) ? timeout : 15,
              startup_timeout_seconds: 20
            }
        : {
            dimensions: Number.isFinite(dimensions) ? dimensions : 32
          };
    updateBinding.mutate({
      capability: "embed_text",
      data: {
        provider_id: embeddingProviderId,
        model_id: embeddingModelId.trim() || (embeddingProviderId === "mock_embedding" ? "mock-local-embedding" : "local-embedding"),
        local_only: embeddingProvider?.locality !== "cloud",
        settings: settingsPayload
      }
    });
  }

  function saveRerankerRoute() {
    const timeout = Number.parseFloat(rerankerTimeout);
    const settingsPayload =
      rerankerProviderId === "local_reranker_http"
        ? {
            endpoint_url: rerankerEndpoint.trim(),
            timeout_seconds: Number.isFinite(timeout) ? timeout : 15
          }
        : rerankerProviderId === "local_cross_encoder"
          ? {
              model_path: rerankerModelPath.trim(),
              batch_size: 8,
              max_length: 512,
              timeout_seconds: Number.isFinite(timeout) ? timeout : 15
            }
        : {};
    updateBinding.mutate({
      capability: "rerank_results",
      data: {
        provider_id: rerankerProviderId,
        model_id: rerankerModelId.trim() || (rerankerProviderId === "mock_reranker" ? "mock-local-reranker" : "local-reranker"),
        local_only: rerankerProvider?.locality !== "cloud",
        settings: settingsPayload
      }
    });
  }

  function saveSttRoute() {
    const timeout = Number.parseFloat(sttTimeout);
    const settingsPayload =
      sttProviderId === "whisper_cpp"
        ? {
            binary_path: sttBinaryPath.trim(),
            model_path: sttModelPath.trim(),
            language: sttLanguage.trim() || null,
            timestamps: true,
            timeout_seconds: Number.isFinite(timeout) ? timeout : 120
          }
        : {
            timestamps: true
          };
    const consentedSettingsPayload = sttProviderCloud ? { ...settingsPayload, cloud_voice_consent: true } : settingsPayload;
    updateBinding.mutate({
      capability: "transcribe_audio",
      data: {
        provider_id: sttProviderId,
        model_id: sttModelId.trim() || (sttProviderId === "mock_stt" ? "mock-local-stt" : sttProviderCloud ? sttProviderId : "whisper-cpp-local"),
        local_only: !sttProviderCloud,
        settings: consentedSettingsPayload
      }
    });
  }

  function saveTtsRoute() {
    const timeout = Number.parseFloat(ttsTimeout);
    const settingsPayload =
      ttsProviderId === "piper"
        ? {
            binary_path: ttsBinaryPath.trim(),
            model_path: ttsModelPath.trim(),
            config_path: ttsConfigPath.trim() || null,
            voice_id: ttsVoiceId.trim() || null,
            timeout_seconds: Number.isFinite(timeout) ? timeout : 60,
            format: "wav"
          }
        : {
            voice_id: ttsVoiceId.trim() || "mock-local-voice",
            format: "wav"
          };
    const consentedSettingsPayload = ttsProviderCloud ? { ...settingsPayload, cloud_voice_consent: true } : settingsPayload;
    updateBinding.mutate({
      capability: "synthesize_speech",
      data: {
        provider_id: ttsProviderId,
        model_id: ttsModelId.trim() || (ttsProviderId === "mock_tts" ? "mock-local-tts" : ttsProviderCloud ? ttsProviderId : "piper-local"),
        local_only: !ttsProviderCloud,
        settings: consentedSettingsPayload
      }
    });
  }

  function selectManagedSttModel(modelId: string) {
    setSttManagedModelId(modelId);
    const model = sttModels.find((candidate) => candidate.id === modelId);
    if (!model) return;
    setSttProviderId("whisper_cpp");
    setSttModelId(model.id);
    if (model.disk_path) {
      setSttModelPath(model.disk_path);
    }
  }

  function runSetupAction(step: AISetupStepInfo) {
    if (step.action_route === "ai.modelPacks.download" && typeof step.action_payload.packId === "string") {
      downloadModelPack.mutate(step.action_payload.packId);
      return;
    }
    if (step.action_route === "ai.runtimes.install" && typeof step.action_payload.runtimeId === "string") {
      installRuntime.mutate(step.action_payload.runtimeId);
      return;
    }
    if (step.action_route === "settings.routing") {
      setTab("routing");
      return;
    }
    setTab("ai");
  }
  const settingsTabItems: Array<{ id: typeof tab; label: string }> = [
    { id: "ai", label: "Models" },
    { id: "routing", label: "Search" },
    { id: "voice", label: "Voice" },
    { id: "privacy", label: "Privacy" },
    { id: "export", label: "Export" },
    { id: "raw", label: "Advanced" }
  ];

  return (
    <div className="surface settings-layout">
      <Panel>
        <SectionHeader title="Models" eyebrow="local preferences" />
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="settings-tabs">
          <TabsList aria-label="Settings sections">
            {settingsTabItems.map((item) => (
              <TabsTrigger key={item.id} value={item.id} onClick={() => setTab(item.id)}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === "ai" && (
          <div className="settings-section">
            <div className="settings-hero">
              <div>
                <Badge tone="good">Runs on this device</Badge>
                <h3>Models for notes, search, and voice</h3>
                <p>
                  Start with one recommended local pack. Advanced model choices stay available when you need them.
                </p>
              </div>
              <div className="hardware-card">
                <Cpu size={22} />
                <strong>{hardware.data?.recommended_profile ?? "tiny"} profile</strong>
                <span>
                  {hardware.data?.os} / {hardware.data?.arch} / {hardware.data?.physical_ram_gb ?? "?"} GB RAM
                </span>
              </div>
              <div className="runtime-card">
                <Badge tone={runtimeTone} title={llamaRuntime?.state ?? "checking"}>
                  {runtimeHealthLabel(llamaRuntime?.state)}
                </Badge>
                <strong>llama.cpp</strong>
                <span title={runtimeBinaryTitle(llamaRuntime?.cli)}>{runtimeCliLabel(llamaRuntime?.cli.configured)}</span>
                <small>{runtimeInstalledModelsLabel(llamaRuntime?.installed_models.length ?? 0)}</small>
                <Button icon={<Play size={15} />} variant="quiet" onClick={() => testRuntime.mutate()}>
                  Test runtime
                </Button>
                <Button icon={<Import size={15} />} variant="quiet" onClick={() => importModel.mutate()}>
                  Import model
                </Button>
              </div>
            </div>
            {importModel.data && <small className="import-result">Imported {importModel.data.display_name} into Vault model storage.</small>}
            {importModel.error && <small className="import-result import-error">{importModel.error.message}</small>}
            {downloadModelPack.error && <small className="import-result import-error">{downloadModelPack.error.message}</small>}

            <LocalAICommandCenter
              setup={setupStatus.data}
              report={readinessReport.data}
              releasePlan={registryReleasePlan.data}
              productionPack={recommendedProductionPack}
              demoPack={demoSetupPack}
              runtimes={managedRuntimes}
              busy={setupWizardBusy}
              candidateBusy={evaluateCandidateReleasePlan.isPending}
              onOpenWizard={() => setSetupWizardOpen(true)}
              onOpenRouting={() => setTab("routing")}
              onRunDemo={() => runSetup.mutate({ mode: "demo", pack_id: setupStatus.data?.demo_pack_id ?? undefined })}
              onRunRecommended={() => runSetup.mutate({ mode: "recommended", pack_id: setupStatus.data?.recommended_pack_id ?? recommendedProductionPack?.id })}
              onEvaluateCandidate={() => evaluateCandidateReleasePlan.mutate()}
            />
            <AISetupGuide
              setup={setupStatus.data}
              busy={setupWizardBusy}
              onAction={runSetupAction}
              onPrepareDemo={() => runSetup.mutate({ mode: "demo", pack_id: setupStatus.data?.demo_pack_id ?? undefined })}
              onOpenWizard={() => setSetupWizardOpen(true)}
            />
            <details className="settings-advanced-panel">
              <summary>
                <span>
                  <strong>Approval details</strong>
                  <small>Model approvals, evidence, and setup tools.</small>
                </span>
                <Badge tone={readinessReport.data?.production_ready ? "good" : "warn"}>
                  {readinessReport.data?.production_ready ? "ready" : `${readinessReport.data?.summary?.blocked_count ?? 0} items`}
                </Badge>
              </summary>
              <div className="settings-advanced-body">
                <AIProductionReadinessPanel
                  report={readinessReport.data}
                  registryValidation={registryValidation.data}
                  registryValidationLoading={registryValidation.isLoading}
                  exportBusy={exportReadinessReport.isPending}
                  exportStatus={readinessExportStatus}
                  templateBusy={exportApprovalTemplate.isPending}
                  templateStatus={approvalTemplateExportStatus}
                  onExport={() => exportReadinessReport.mutate()}
                  onExportTemplate={() => exportApprovalTemplate.mutate("markdown")}
                  onExportEvidenceTemplate={() => exportApprovalTemplate.mutate("evidence")}
                  onOpenWizard={() => setSetupWizardOpen(true)}
                  onOpenRouting={() => setTab("routing")}
                />
                <AIRegistryReleasePlanPanel
                  plan={registryReleasePlan.data}
                  productionReadiness={readinessReport.data}
                  exportBusy={exportRegistryReleasePlan.isPending}
                  exportStatus={registryReleaseExportStatus}
                  candidate={candidateReleasePlan}
                  candidateHydration={candidateMetadataHydration}
                  candidateArtifactProbe={candidateArtifactProbe}
                  candidateArtifactVerification={candidateArtifactVerification}
                  candidateEvidence={candidateEvidenceOverlay}
                  candidateReleasePacket={candidateReleasePacket}
                  workspace={releaseWorkspace.data}
                  workspaceBusy={saveReleaseWorkspace.isPending || clearReleaseWorkspace.isPending}
                  candidateBusy={evaluateCandidateReleasePlan.isPending}
                  candidateHydrationBusy={hydrateCandidateMetadata.isPending}
                  candidateHydrationExportBusy={exportHydratedModelRegistry.isPending}
                  candidateExportBusy={exportCandidateReleasePlan.isPending}
                  candidateProbeBusy={probeCandidateArtifacts.isPending}
                  candidateProbeExportBusy={exportCandidateArtifactProbe.isPending}
                  candidateVerificationBusy={verifyCandidateArtifacts.isPending}
                  candidateVerificationExportBusy={exportCandidateArtifactVerification.isPending}
                  candidateTemplateBusy={exportCandidateApprovalTemplate.isPending}
                  candidateEvidenceBusy={applyCandidateEvidence.isPending}
                  candidateReleasePacketBusy={prepareCandidateReleasePacket.isPending}
                  patchedRegistryExportBusy={exportPatchedCandidateRegistry.isPending}
                  evidenceMarkdownExportBusy={exportAppliedEvidenceMarkdown.isPending}
                  canHydrateCandidate={Boolean(candidateReleasePayload?.model_registry)}
                  candidateStatus={candidateReleaseStatus}
                  workspaceStatus={candidateWorkspaceStatus}
                  onExport={() => exportRegistryReleasePlan.mutate()}
                  onSaveWorkspace={() => persistCandidateWorkspace()}
                  onClearWorkspace={() => clearReleaseWorkspace.mutate()}
                  onEvaluateCandidate={() => evaluateCandidateReleasePlan.mutate()}
                  onHydrateCandidateMetadata={() => hydrateCandidateMetadata.mutate()}
                  onExportHydratedModelRegistry={() => exportHydratedModelRegistry.mutate()}
                  onExportCandidate={() => exportCandidateReleasePlan.mutate()}
                  onProbeCandidateArtifacts={() => probeCandidateArtifacts.mutate()}
                  onExportCandidateArtifactProbe={() => exportCandidateArtifactProbe.mutate()}
                  onVerifyCandidateArtifacts={() => verifyCandidateArtifacts.mutate()}
                  onExportCandidateArtifactVerification={() => exportCandidateArtifactVerification.mutate("report")}
                  onExportCandidateArtifactEvidence={() => exportCandidateArtifactVerification.mutate("evidence")}
                  onExportCandidateTemplate={() => exportCandidateApprovalTemplate.mutate("markdown")}
                  onExportCandidateEvidenceTemplate={() => exportCandidateApprovalTemplate.mutate("evidence")}
                  onApplyCandidateEvidence={() => applyCandidateEvidence.mutate()}
                  onPrepareReleasePacket={() => prepareCandidateReleasePacket.mutate({ probe_sources: false, verify_bytes: false })}
                  onPrepareVerifiedReleasePacket={() => prepareCandidateReleasePacket.mutate({ probe_sources: true, verify_bytes: true })}
                  onExportAppliedReleasePlan={() => exportAppliedEvidenceMarkdown.mutate("releasePlan")}
                  onExportAppliedApprovalTemplate={() => exportAppliedEvidenceMarkdown.mutate("approvalTemplate")}
                  onExportPinHandoff={() => exportAppliedEvidenceMarkdown.mutate("pinHandoff")}
                  onExportPatchedModelRegistry={() => exportPatchedCandidateRegistry.mutate("model")}
                  onExportPatchedRuntimeRegistry={() => exportPatchedCandidateRegistry.mutate("runtime")}
                />
              </div>
            </details>
            <AISetupWizard
              open={setupWizardOpen}
              setup={setupStatus.data}
              hardware={hardware.data}
              productionPack={recommendedProductionPack}
              demoPack={demoSetupPack}
              runtimes={managedRuntimes}
              capabilities={capabilities.data ?? []}
              busy={setupWizardBusy}
              setupResult={runSetup.data}
              setupError={runSetup.error}
              onClose={() => setSetupWizardOpen(false)}
              onStepAction={runSetupAction}
              onRunDemo={() => runSetup.mutate({ mode: "demo", pack_id: setupStatus.data?.demo_pack_id ?? undefined })}
              onRunRecommended={() => runSetup.mutate({ mode: "recommended", pack_id: setupStatus.data?.recommended_pack_id ?? undefined })}
              onInstallRuntime={(runtimeId) => installRuntime.mutate(runtimeId)}
              onDownloadPack={(packId) => downloadModelPack.mutate(packId)}
            />
            <AISetupRunReport result={runSetup.data} />
            {runSetup.error && <small className="import-result import-error">{runSetup.error.message}</small>}

            <details className="settings-library-panel">
              <summary>
                <span>
                  <strong>Model library</strong>
                  <small>Installed models, runtimes, downloads, and local pack details.</small>
                </span>
                <span className="settings-library-counts">
                  <Badge tone="neutral">{models.length} models</Badge>
                  <Badge tone="neutral">{managedRuntimes.length} runtimes</Badge>
                  <Badge tone="info">{downloads.data?.length ?? 0} downloads</Badge>
                </span>
              </summary>
              <div className="settings-library-body">
                <section className="pack-section">
                  <div className="pack-section-header">
                    <div>
                      <Badge tone="info">local runtime</Badge>
                      <h3>Runtimes</h3>
                    </div>
                    <p>Local binaries live in app storage, are verified before use, and can be removed without touching your notes or sources.</p>
                  </div>
                  <div className="runtime-install-grid" aria-label="Managed AI runtimes">
                    {managedRuntimes.map((item) => (
                      <article key={item.id} className={`runtime-install-card ${item.release_channel === "demo" ? "demo" : ""} ${item.blocked_reasons.length ? "blocked" : ""}`}>
                        <div className="runtime-install-card-header">
                          <div>
                            <Badge tone={runtimeStateTone(item)} title={item.install_state}>
                              {runtimeInstallStateLabel(item)}
                            </Badge>
                            <Badge tone={item.release_channel === "demo" ? "info" : "neutral"} title={item.release_channel}>
                              {releaseChannelLabel(item.release_channel)}
                            </Badge>
                            <Badge tone={item.compatible === false ? "warn" : "good"} title={runtimeCompatibilityTitle(item)}>
                              {runtimeCompatibilityDisplay(item)}
                            </Badge>
                            {(item.integrity_status ?? "unknown") !== "unknown" && (
                              <Badge tone={runtimeIntegrityTone(item.integrity_status)} title={item.integrity_status ?? undefined}>
                                {runtimeIntegrityLabel(item.integrity_status)}
                              </Badge>
                            )}
                            <Badge title={item.runtime}>{item.runtime.replace("_", ".")}</Badge>
                          </div>
                          <HardDrive size={18} />
                        </div>
                        <h4>{item.display_name}</h4>
                        <p title={item.binary_name}>{item.version ?? "Local runtime binary"}</p>
                        <div className="pack-metrics">
                          <span title={item.binary_name}>Runtime binary</span>
                          <span>{formatBytes(item.size_bytes)}</span>
                          <span title={runtimeCompatibilityTitle(item)}>{runtimeCompatibilityDisplay(item)}</span>
                        </div>
                        {item.binary_path && (
                          <small className="model-path" title={item.binary_path}>
                            Installed binary
                          </small>
                        )}
                        {item.blocked_reasons.length > 0 && (
                          <ul className="pack-blockers">
                            {item.blocked_reasons.slice(0, 3).map((reason) => (
                              <li key={reason}>{localAIUserText(reason)}</li>
                            ))}
                          </ul>
                        )}
                        {item.release_channel === "production" && <ReadinessChecklist checks={item.readiness_checks} limit={4} />}
                        {runtimeLatestLog(item) && <small>{runtimeLatestLog(item)}</small>}
                        <div className="runtime-install-actions">
                          <Button
                            icon={runtimeInstallLabel(item) === "Repair" ? <RefreshCw size={15} /> : <Download size={15} />}
                            variant={item.installed ? "quiet" : item.installable ? "primary" : "quiet"}
                            disabled={item.installed || !item.installable || runtimeActionBusy}
                            onClick={() => installRuntime.mutate(item.id)}
                          >
                            {runtimeInstallLabel(item)}
                          </Button>
                          <Button icon={<RefreshCw size={15} />} variant="quiet" disabled={!item.installed || runtimeActionBusy} onClick={() => verifyRuntime.mutate(item.id)}>
                            Verify
                          </Button>
                          <Button icon={<X size={15} />} variant="danger" disabled={!item.installed || runtimeActionBusy} onClick={() => deleteRuntime.mutate(item.id)}>
                            Delete
                          </Button>
                        </div>
                        {item.license_label && <small>{item.license_label}</small>}
                        <small>{licenseReferenceLabel(item)}</small>
                      </article>
                    ))}
                  </div>
                  {installRuntime.error && <small className="import-result import-error">{installRuntime.error.message}</small>}
                  {verifyRuntime.error && <small className="import-result import-error">{verifyRuntime.error.message}</small>}
                  {deleteRuntime.error && <small className="import-result import-error">{deleteRuntime.error.message}</small>}
                </section>

                <section className="pack-section">
                  <div className="pack-section-header">
                    <div>
                      <Badge tone="good">approved</Badge>
                      <h3>Approved model packs</h3>
                    </div>
                    <p>Real local models must have a pinned source, license, checksum, runtime, and route test before use.</p>
                  </div>
                  <div className="model-pack-grid" aria-label="Production local model packs">
                    {productionPacks.map((pack) => {
                      const recommended = pack.id === recommendedProductionPack?.id;
                      const downloadableCount = pack.downloadable_model_ids.length;
                      const optionalDownloadableCount = pack.downloadable_model_ids.filter((modelId) => pack.optional_model_ids.includes(modelId)).length;
                      return (
                        <article key={pack.id} className={`model-pack-card ${pack.release_status === "blocked" ? "blocked" : ""}`}>
                          <div>
                            <Badge tone={pack.installed ? "good" : recommended ? "info" : "neutral"}>{pack.profile}</Badge>
                            <Badge tone={packStatusTone(pack.release_status)} title={pack.release_status}>
                              {packStatusLabel(pack.release_status)}
                            </Badge>
                            <Badge tone="good">{pack.privacy_label}</Badge>
                            {recommended && <Badge tone="info">Recommended</Badge>}
                          </div>
                          <h4>{pack.display_name}</h4>
                          <p>{pack.description}</p>
                          <div className="pack-metrics">
                            <span>{pack.installed_model_ids.length}/{pack.required_model_ids.length} models ready</span>
                            <span>{formatBytes(pack.disk_bytes)} storage</span>
                            <span>{downloadableCount} downloads ready</span>
                            {pack.optional_model_ids.length > 0 && (
                              <span>
                                {pack.optional_model_ids.length} optional model{pack.optional_model_ids.length === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                          {pack.blocked_reasons.length > 0 && (
                            <ul className="pack-blockers">
                              {pack.blocked_reasons.slice(0, 3).map((reason) => (
                                <li key={reason}>{localAIUserText(reason)}</li>
                              ))}
                            </ul>
                          )}
                          <PackRouteCoverage pack={pack} capabilities={capabilities.data ?? []} />
                          <ReadinessChecklist checks={pack.readiness_checks} />
                          <div className="model-pack-actions">
                            <Button
                              icon={<TestTube2 size={15} />}
                              variant={packSetupActionTone(pack, recommended)}
                              disabled={setupWizardBusy}
                              onClick={() => runSetup.mutate({ mode: "recommended", pack_id: pack.id })}
                            >
                              {packSetupActionLabel(pack)}
                            </Button>
                            <Button
                              icon={<Download size={15} />}
                              variant={pack.installed ? "quiet" : recommended && pack.installable ? "primary" : "quiet"}
                              disabled={pack.installed || !pack.installable || downloadModelPack.isPending}
                              onClick={() => downloadModelPack.mutate(pack.id)}
                            >
                              {pack.installed ? "Installed" : pack.installable ? "Download pack" : "Needs approval"}
                            </Button>
                            {pack.optional_model_ids.length > 0 && (
                              <Button
                                icon={<Sparkles size={15} />}
                                variant={optionalDownloadableCount > 0 ? "secondary" : "quiet"}
                                disabled={setupWizardBusy}
                                onClick={() => runSetup.mutate({ mode: "recommended", pack_id: pack.id, include_optional_models: true })}
                              >
                                {optionalDownloadableCount > 0 ? "Install add-ons" : "Check add-ons"}
                              </Button>
                            )}
                          </div>
                          <small title={pack.capabilities.join(", ")}>{modelCapabilitySummary(pack.capabilities)}</small>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="pack-section">
                  <div className="pack-section-header">
                    <div>
                      <Badge tone="info">starter</Badge>
                      <h3>Starter models</h3>
                    </div>
                    <p>Small deterministic models for testing private notes, search, and voice flows before approved packs are ready.</p>
                  </div>
                  <div className="model-pack-grid demo-grid" aria-label="Demo fixture model packs">
                    {demoPacks.map((pack) => {
                      const recommended = pack.profile === hardware.data?.recommended_profile;
                      const downloadableCount = pack.downloadable_model_ids.length;
                      return (
                        <article key={pack.id} className="model-pack-card demo">
                          <div>
                            <Badge tone={pack.installed ? "good" : "info"}>{pack.profile}</Badge>
                            <Badge tone={packStatusTone(pack.release_status)} title={pack.release_status}>
                              {packStatusLabel(pack.release_status)}
                            </Badge>
                            <Badge tone="good">{pack.privacy_label}</Badge>
                            {recommended && <Badge tone="info">Suggested</Badge>}
                          </div>
                          <h4>{pack.display_name}</h4>
                          <p>{pack.description}</p>
                          <div className="pack-metrics">
                            <span>{pack.installed_model_ids.length}/{pack.required_model_ids.length} models ready</span>
                            <span>{formatBytes(pack.disk_bytes)} storage</span>
                            <span>{downloadableCount} downloads ready</span>
                            {pack.optional_model_ids.length > 0 && (
                              <span>
                                {pack.optional_model_ids.length} optional model{pack.optional_model_ids.length === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                          {pack.blocked_reasons.length > 0 && <small>{localAIUserText(pack.blocked_reasons[0])}</small>}
                          <Button
                            icon={<Download size={15} />}
                            variant={pack.installed ? "quiet" : "primary"}
                            disabled={pack.installed || !pack.installable || downloadModelPack.isPending}
                            onClick={() => downloadModelPack.mutate(pack.id)}
                          >
                            {pack.installed ? "Installed" : "Download starter"}
                          </Button>
                          <small title={pack.capabilities.join(", ")}>{modelCapabilitySummary(pack.capabilities)}</small>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <div className="model-grid">
              {models.map((model) => (
                <article key={model.id} className="model-card">
                  <div>
                    <Badge tone={model.installed ? "good" : "warn"} title={model.download_state}>
                      {modelDownloadLabel(model.download_state)}
                    </Badge>
                    <Badge title={model.runtime ?? model.kind}>{modelRuntimeLabel(model.runtime, model.kind)}</Badge>
                    <Badge title={model.format ?? "pack"}>{modelFormatLabel(model.format)}</Badge>
                    {modelSourceLabel(model.source_type) && (
                      <Badge tone="info" title={model.source_type ?? undefined}>
                        {modelSourceLabel(model.source_type)}
                      </Badge>
                    )}
                    {model.runtime_tested && <Badge tone="good">Tested</Badge>}
                  </div>
                  <h4>{model.display_name}</h4>
                  <p title={model.capabilities.join(", ")}>{modelCapabilitySummary(model.capabilities)}</p>
                  <small title={model.license_label ?? "license pending"}>
                    {searchModeLabel(model.recommended_profile)} profile - {model.license_label ?? "license pending"}
                  </small>
                  <small title={licenseReferenceLabel(model)}>{licenseReferenceLabel(model) === "license artifact pending" ? "License artifact pending" : "License artifact ready"}</small>
                  {model.trust_level && <small title={model.trust_level}>{modelTrustLabel(model.trust_level)}</small>}
                  {model.disk_path && (
                    <small className="model-path" title={model.disk_path}>
                      Local model file
                    </small>
                  )}
                  <div className="model-actions">
                    <Button icon={<Play size={15} />} onClick={() => testModel.mutate(model.id)}>
                      Test
                    </Button>
                    <Button
                      icon={<Download size={15} />}
                      variant="quiet"
                      disabled={model.installed || !model.downloadable || ["installed", "queued", "downloading", "paused"].includes(model.download_state)}
                      onClick={() => downloadModel.mutate(model.id)}
                    >
                      Download
                    </Button>
                    <Button icon={<Check size={15} />} variant="quiet" disabled={!model.installed} onClick={() => verifyModel.mutate(model.id)}>
                      Verify
                    </Button>
                    <Button icon={<Sparkles size={15} />} variant="quiet" disabled={!model.installed} onClick={() => selectModel.mutate(model.id)}>
                      Use
                    </Button>
                    {model.runtime === "llama_cpp" && (
                      <Button
                        icon={llamaServerRunning && llamaServerProcess?.model_id === model.id ? <Pause size={15} /> : <Play size={15} />}
                        variant={llamaServerRunning && llamaServerProcess?.model_id === model.id ? "primary" : "quiet"}
                        disabled={!model.installed || !model.runtime_tested || startLlamaServer.isPending || stopLlamaServer.isPending}
                        onClick={() =>
                          llamaServerRunning && llamaServerProcess?.model_id === model.id
                            ? stopLlamaServer.mutate()
                            : startLlamaServer.mutate(model.id)
                        }
                      >
                        {llamaServerRunning && llamaServerProcess?.model_id === model.id ? "Stop server" : "Start server"}
                      </Button>
                    )}
                    <Button icon={<X size={15} />} variant="quiet" disabled={!model.installed} onClick={() => unloadModel.mutate(model.id)}>
                      Unload
                    </Button>
                    <Button icon={<X size={15} />} variant="danger" disabled={!model.installed} onClick={() => deleteModel.mutate(model.id)}>
                      Delete
                    </Button>
                  </div>
                  {testModel.data?.model_id === model.id && (
                    <small className="model-test-result">
                      {testModel.data.status}: {testModel.data.message}
                    </small>
                  )}
                  {testModel.error && <small className="model-test-result model-test-error">{testModel.error.message}</small>}
                  {startLlamaServer.error && model.runtime === "llama_cpp" && <small className="model-test-result model-test-error">{startLlamaServer.error.message}</small>}
                </article>
              ))}
                </div>
                <div className="runtime-details">
              <h3>Local runtime</h3>
              <article>
                <Badge tone={runtimeTone} title={llamaRuntime?.state ?? "checking"}>
                  {runtimeHealthLabel(llamaRuntime?.state)}
                </Badge>
                <strong>Runtime</strong>
                <span title={runtimeBinaryTitle(llamaRuntime?.cli)}>{runtimeBinaryDescription("cli", llamaRuntime?.cli)}</span>
              </article>
              <article>
                <Badge tone={llamaRuntime?.server.configured ? "good" : "warn"}>
                  {runtimeBinaryStatusLabel(llamaRuntime?.server)}
                </Badge>
                <strong>Server</strong>
                <span title={runtimeBinaryTitle(llamaRuntime?.server)}>{runtimeBinaryDescription("server", llamaRuntime?.server)}</span>
              </article>
              <article>
                <Badge tone={llamaServerRunning ? "good" : llamaServerProcess?.state === "exited" ? "warn" : "info"}>
                  {serverProcessLabel(llamaServerProcess?.state)}
                </Badge>
                <strong>Session</strong>
                <span title={serverProcessTitle(llamaServerProcess)}>{serverProcessDescription(llamaServerProcess)}</span>
                {llamaServerProcess?.model_id && <small title={llamaServerProcess.model_id}>Active model</small>}
                {llamaServerProcess?.mode && <small title={llamaServerProcess.mode}>Run mode</small>}
                {llamaServerProcess?.pid && <small title={String(llamaServerProcess.pid)}>Process ID</small>}
                {llamaServerProcess?.log_path && <small title={llamaServerProcess.log_path}>Log file</small>}
                {llamaServerRunning && (
                  <Button icon={<Pause size={15} />} variant="quiet" disabled={stopLlamaServer.isPending} onClick={() => stopLlamaServer.mutate()}>
                    Stop server
                  </Button>
                )}
              </article>
              {(llamaRuntime?.warnings ?? []).map((warning) => (
                <small key={warning}>{warning}</small>
              ))}
              {testRuntime.data && <small>{testRuntime.data.status}: {testRuntime.data.message}</small>}
              {stopLlamaServer.error && <small className="model-test-error">{stopLlamaServer.error.message}</small>}
                </div>
                <div className="download-list">
              <h3>Download queue</h3>
              {(downloads.data ?? []).length === 0 && <p>No model downloads yet.</p>}
              {(downloads.data ?? []).map((download) => (
                <DownloadQueueRow
                  key={download.id}
                  download={download}
                  busy={downloadActionBusy}
                  onPause={() => pauseDownload.mutate(download.id)}
                  onResume={() => resumeDownload.mutate(download.id)}
                  onCancel={() => cancelDownload.mutate(download.id)}
                />
              ))}
                </div>
              </div>
            </details>
          </div>
        )}

        {tab === "routing" && (
          <div className="settings-section">
            <SectionHeader title="Search" eyebrow="local index and ranking" />
            <div className="workflow-toolbar">
              <CapabilityStatus capability="embed_text" />
              <Button
                icon={<Brain size={15} />}
                variant="quiet"
                disabled={embeddingJobActive || reindexEmbeddings.isPending}
                onClick={() => reindexEmbeddings.mutate()}
              >
                Reindex
              </Button>
              {reindexEmbeddings.error && <small>{reindexEmbeddings.error.message}</small>}
            </div>
            {latestEmbeddingJob && (
              <EmbeddingJobProgress
                job={latestEmbeddingJob}
                cancelling={cancelJob.isPending}
                onCancel={() => cancelJob.mutate(latestEmbeddingJob.id)}
              />
            )}
            {cancelJob.error && <small className="import-result import-error">{cancelJob.error.message}</small>}
            <section className="embedding-config-panel">
              <div className="embedding-config-header">
                <div>
                  <Badge tone={embeddingProvider?.locality === "cloud" ? "bad" : "good"}>
                    {embeddingProvider?.privacy_label ?? "No provider selected"}
                  </Badge>
                  <h3>Search index</h3>
                  <p>{embedBinding?.model_id ?? "No saved embedding model"}</p>
                </div>
                <SlidersHorizontal size={22} />
              </div>
              <div className="embedding-route-grid">
                <label>
                  <span>Provider</span>
                  <select aria-label="Embedding provider" value={embeddingProviderId} onChange={(event) => setEmbeddingProviderId(event.target.value)}>
                    {(providers.data ?? [])
                      .filter((providerOption) => providerOption.kind === "embedding")
                      .map((providerOption) => (
                        <option key={providerOption.id} value={providerOption.id}>
                          {providerOption.display_name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span>Model ID</span>
                  <Input aria-label="Embedding model ID" value={embeddingModelId} onChange={(event) => setEmbeddingModelId(event.target.value)} />
                </label>
                <label>
                  <span>Dimensions</span>
                  <Input
                    aria-label="Embedding dimensions"
                    inputMode="numeric"
                    min={4}
                    max={1024}
                    type="number"
                    value={embeddingDimensions}
                    onChange={(event) => setEmbeddingDimensions(event.target.value)}
                  />
                </label>
                <label>
                  <span>Timeout</span>
                  <Input
                    aria-label="Embedding timeout seconds"
                    inputMode="decimal"
                    min={1}
                    type="number"
                    value={embeddingTimeout}
                    onChange={(event) => setEmbeddingTimeout(event.target.value)}
                    disabled={!["local_embedding_http", "llama_cpp_server_embeddings"].includes(embeddingProviderId)}
                  />
                </label>
              </div>
              {embeddingProviderId === "local_embedding" && (
                <label className="embedding-endpoint-field">
                  <span>Model path</span>
                  <div>
                    <Link2 size={16} />
                    <Input
                      aria-label="Local embedding model path"
                      placeholder="/Users/you/.vault/models/embeddings/model.bin"
                      value={embeddingModelPath}
                      onChange={(event) => setEmbeddingModelPath(event.target.value)}
                    />
                  </div>
                </label>
              )}
              {embeddingProviderId === "local_embedding_http" && (
                <label className="embedding-endpoint-field">
                  <span>Endpoint URL</span>
                  <div>
                    <Link2 size={16} />
                    <Input
                      aria-label="Local embedding endpoint URL"
                      placeholder="http://127.0.0.1:8080/v1/embeddings"
                      value={embeddingEndpoint}
                      onChange={(event) => setEmbeddingEndpoint(event.target.value)}
                    />
                  </div>
                </label>
              )}
              {embeddingProviderId === "llama_cpp_server_embeddings" && (
                <label className="embedding-endpoint-field">
                  <span>llama-server port</span>
                  <div>
                    <Link2 size={16} />
                    <Input
                      aria-label="llama.cpp embedding server port"
                      inputMode="numeric"
                      min={1}
                      max={65535}
                      type="number"
                      value={embeddingServerPort}
                      onChange={(event) => setEmbeddingServerPort(event.target.value)}
                    />
                  </div>
                </label>
              )}
              <div className="embedding-privacy-strip">
                <Badge tone={embeddingEndpointOk && embeddingModelPathOk && embeddingServerPortOk ? "good" : "bad"}>
                  {embeddingProviderId === "local_embedding_http" || embeddingProviderId === "llama_cpp_server_embeddings" ? "loopback only" : "on device"}
                </Badge>
                <span>
                  {embeddingProviderId === "local_embedding_http"
                    ? "localhost, 127.0.0.1, or ::1"
                    : embeddingProviderId === "llama_cpp_server_embeddings"
                      ? "managed llama.cpp server process"
                      : embeddingProviderId === "local_embedding"
                        ? "installed local embedding artifact"
                        : "deterministic local vectors"}
                </span>
                <div>
                  <Button icon={<Save size={15} />} disabled={!embeddingCanSave || updateBinding.isPending} onClick={saveEmbeddingRoute}>
                    Save search index
                  </Button>
                  <Button icon={<TestTube2 size={15} />} variant="quiet" disabled={testEmbeddingRoute.isPending} onClick={() => testEmbeddingRoute.mutate()}>
                    Test search index
                  </Button>
                </div>
              </div>
              {updateBinding.error && <small className="model-test-error">{updateBinding.error.message}</small>}
              {testEmbeddingRoute.error && <small className="model-test-error">{testEmbeddingRoute.error.message}</small>}
              {testEmbeddingRoute.data && (
                <small
                  className="model-test-result"
                  title={[
                    testEmbeddingRoute.data.provider,
                    testEmbeddingRoute.data.model_id,
                    testEmbeddingRoute.data.model_fingerprint ? `artifact ${testEmbeddingRoute.data.model_fingerprint}` : ""
                  ]
                    .filter(Boolean)
                    .join(" / ")}
                >
                  Search index tested / {testEmbeddingRoute.data.dimensions} dimensions / {routeTestPrivacyLabel(testEmbeddingRoute.data.sent_off_device)}
                  {testEmbeddingRoute.data.model_fingerprint ? " / Artifact recorded" : ""}
                </small>
              )}
            </section>
            <section className="embedding-config-panel">
              <div className="embedding-config-header">
                <div>
                  <Badge tone={rerankerProvider?.locality === "cloud" ? "bad" : "good"}>
                    {rerankerProvider?.privacy_label ?? "No provider selected"}
                  </Badge>
                  <h3>Result ranking</h3>
                  <p>{rerankBinding?.model_id ?? "No saved reranker model"}</p>
                </div>
                <SlidersHorizontal size={22} />
              </div>
              <div className="embedding-route-grid">
                <label>
                  <span>Provider</span>
                  <select aria-label="Reranker provider" value={rerankerProviderId} onChange={(event) => setRerankerProviderId(event.target.value)}>
                    {(providers.data ?? [])
                      .filter((providerOption) => providerOption.kind === "reranker")
                      .map((providerOption) => (
                        <option key={providerOption.id} value={providerOption.id}>
                          {providerOption.display_name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span>Model ID</span>
                  <Input aria-label="Reranker model ID" value={rerankerModelId} onChange={(event) => setRerankerModelId(event.target.value)} />
                </label>
                <label>
                  <span>Timeout</span>
                  <Input
                    aria-label="Reranker timeout seconds"
                    inputMode="decimal"
                    min={1}
                    type="number"
                    value={rerankerTimeout}
                    onChange={(event) => setRerankerTimeout(event.target.value)}
                    disabled={!["local_reranker_http", "local_cross_encoder"].includes(rerankerProviderId)}
                  />
                </label>
              </div>
              {rerankerProviderId === "local_reranker_http" && (
                <label className="embedding-endpoint-field">
                  <span>Endpoint URL</span>
                  <div>
                    <Link2 size={16} />
                    <Input
                      aria-label="Local reranker endpoint URL"
                      placeholder="http://127.0.0.1:8081/rerank"
                      value={rerankerEndpoint}
                      onChange={(event) => setRerankerEndpoint(event.target.value)}
                    />
                  </div>
                </label>
              )}
              {rerankerProviderId === "local_cross_encoder" && (
                <label className="embedding-endpoint-field">
                  <span>Model path</span>
                  <div>
                    <Link2 size={16} />
                    <input
                      aria-label="Local reranker model path"
                      placeholder="/Users/you/.vault/models/reranker/model.bin"
                      value={rerankerModelPath}
                      onChange={(event) => setRerankerModelPath(event.target.value)}
                    />
                  </div>
                </label>
              )}
              <div className="embedding-privacy-strip">
                <Badge tone={rerankerEndpointOk ? "good" : "bad"}>
                  {rerankerProviderId === "local_reranker_http" ? "loopback only" : "on device"}
                </Badge>
                <span>
                  {rerankerProviderId === "local_reranker_http"
                    ? "localhost, 127.0.0.1, or ::1"
                    : rerankerProviderId === "local_cross_encoder"
                      ? "installed local model artifact"
                      : "deterministic local rerank"}
                </span>
                <div>
                  <Button icon={<Save size={15} />} disabled={!rerankerCanSave || updateBinding.isPending} onClick={saveRerankerRoute}>
                    Save ranking
                  </Button>
                  <Button icon={<TestTube2 size={15} />} variant="quiet" disabled={testRerankerRoute.isPending} onClick={() => testRerankerRoute.mutate()}>
                    Test ranking
                  </Button>
                </div>
              </div>
              {testRerankerRoute.error && <small className="model-test-error">{testRerankerRoute.error.message}</small>}
              {testRerankerRoute.data && (
                <small className="model-test-result" title={[testRerankerRoute.data.provider, testRerankerRoute.data.model_id].filter(Boolean).join(" / ")}>
                  Ranking tested / {testRerankerRoute.data.results.length} results / {routeTestPrivacyLabel(testRerankerRoute.data.sent_off_device)}
                </small>
              )}
            </section>
            <details className="settings-route-details">
              <summary>
                <span>
                  <strong>Model task routing</strong>
                  <small>Choose which local provider handles each model-backed task.</small>
                </span>
              </summary>
              <div className="capability-list">
                {(capabilities.data ?? []).map((binding) => {
                  const provider = providerById.get(binding.provider_id);
                  const taskLabel = capabilityDisplayLabel(binding.capability);
                  return (
                    <article key={binding.capability} className="capability-row">
                      <div>
                        <strong title={binding.capability}>{taskLabel}</strong>
                        <span>{binding.model_id ?? "No model selected"}</span>
                      </div>
                      <Badge tone={provider?.locality === "cloud" ? "bad" : "good"}>
                        {provider?.privacy_label ?? "Unknown provider"}
                      </Badge>
                      <select
                        aria-label={`Provider for ${taskLabel}`}
                        value={binding.provider_id}
                        onChange={(event) =>
                          updateBinding.mutate({
                            capability: binding.capability,
                            data: {
                              provider_id: event.target.value,
                              local_only: providerById.get(event.target.value)?.locality !== "cloud"
                            }
                          })
                        }
                      >
                        {(providers.data ?? [])
                          .filter((providerOption) => providerOption.kind === provider?.kind || providerOption.id.startsWith("mock"))
                          .map((providerOption) => (
                            <option key={providerOption.id} value={providerOption.id}>
                              {providerOption.display_name}
                            </option>
                          ))}
                      </select>
                    </article>
                  );
                })}
              </div>
            </details>
          </div>
        )}

        {tab === "voice" && (
          <div className="settings-section">
            <section className="voice-route-panel voice-permission-panel" aria-label="Microphone permission preflight">
              <div className="embedding-config-header">
                <div>
                  <Badge tone={microphonePermissionTone(microphonePermissionStatus)}>{microphonePermissionLabel(microphonePermissionStatus)}</Badge>
                  <h3>Microphone access</h3>
                  <p>{microphonePermissionDetail}</p>
                </div>
                <Mic size={22} />
              </div>
              <div className="embedding-privacy-strip">
                <Badge tone="good">local capture</Badge>
                <span>Dictation, voice memos, Assistant questions.</span>
                <div>
                  <Button icon={<RefreshCw size={15} />} variant="quiet" disabled={microphonePreflightBusy} onClick={() => void refreshMicrophonePermission()}>
                    Refresh
                  </Button>
                  <Button icon={<Mic size={15} />} disabled={microphonePreflightBusy} onClick={() => void testMicrophoneAccess()}>
                    {microphonePreflightBusy ? "Checking" : "Check microphone"}
                  </Button>
                </div>
              </div>
            </section>
            <section className="voice-route-panel">
              <div className="embedding-config-header">
                <div>
                  <Badge tone={voiceRuntime?.state === "ready" ? "good" : voiceRuntime?.state === "mock_only" ? "info" : "warn"} title={String(voiceRuntime?.state ?? "checking")}>
                    {voiceRuntimeStateLabel(String(voiceRuntime?.state ?? ""))}
                  </Badge>
                  <h3>Dictation</h3>
                  <p title={sttBinding?.model_id ?? undefined}>{savedModelSummary(sttBinding?.model_id, "No saved dictation model")}</p>
                </div>
                <SlidersHorizontal size={22} />
              </div>
              <div className="voice-route-grid">
                <label>
                  <span>Provider</span>
                  <select aria-label="Dictation provider" value={sttProviderId} onChange={(event) => setSttProviderId(event.target.value)}>
                    {(providers.data ?? [])
                      .filter((providerOption) => providerOption.kind === "stt")
                      .map((providerOption) => (
                        <option key={providerOption.id} value={providerOption.id}>
                          {providerOption.display_name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span>Model ID</span>
                  <Input aria-label="Dictation model ID" value={sttModelId} onChange={(event) => setSttModelId(event.target.value)} />
                </label>
                <label>
                  <span>Language</span>
                  <Input
                    aria-label="Dictation language"
                    placeholder="auto"
                    value={sttLanguage}
                    onChange={(event) => setSttLanguage(event.target.value)}
                    disabled={sttProviderId !== "whisper_cpp"}
                  />
                </label>
                <label>
                  <span>Timeout</span>
                  <Input
                    aria-label="Dictation timeout seconds"
                    inputMode="decimal"
                    min={1}
                    type="number"
                    value={sttTimeout}
                    onChange={(event) => setSttTimeout(event.target.value)}
                    disabled={sttProviderId !== "whisper_cpp"}
                  />
                </label>
              </div>
              {sttProviderId === "whisper_cpp" && (
                <div className="voice-model-strip">
                  <label>
                    <span>Managed dictation model</span>
                    <select
                      aria-label="Managed dictation model"
                      value={sttManagedModelId}
                      onChange={(event) => selectManagedSttModel(event.target.value)}
                    >
                      <option value="">Manual model path</option>
                      {sttModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {managedDictationModelOptionLabel(model)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="voice-model-status">
                    <Badge tone={selectedManagedSttModel?.installed ? "good" : "warn"} title={selectedManagedSttModel?.download_state ?? "manual"}>
                      {managedDictationStatusLabel(selectedManagedSttModel)}
                    </Badge>
                    <span title={selectedManagedSttModel?.disk_path ?? undefined}>{managedDictationStatusDescription(selectedManagedSttModel)}</span>
                  </div>
                  <Button
                    icon={<Download size={15} />}
                    variant="quiet"
                    disabled={!selectedManagedSttModel || selectedManagedSttModel.installed || sttDownloadBusy || downloadModel.isPending}
                    onClick={() => selectedManagedSttModel && downloadModel.mutate(selectedManagedSttModel.id)}
                  >
                    Download dictation model
                  </Button>
                </div>
              )}
              {sttProviderId === "whisper_cpp" && (
                <div className="voice-path-grid">
                  <label>
                    <span>whisper.cpp binary</span>
                    <Input
                      aria-label="whisper.cpp binary path"
                      placeholder="/usr/local/bin/whisper-cli"
                      value={sttBinaryPath}
                      onChange={(event) => setSttBinaryPath(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Model file</span>
                    <Input
                      aria-label="whisper.cpp model path"
                      placeholder="~/Library/Application Support/The Vault Research Lab/models/voice/stt/..."
                      value={sttModelPath}
                      onChange={(event) => setSttModelPath(event.target.value)}
                    />
                  </label>
                </div>
              )}
              {sttProviderCloud && (
                <label className="voice-cloud-consent">
                  <input
                    aria-label="Allow off-device dictation"
                    type="checkbox"
                    checked={sttCloudConsent}
                    onChange={(event) => setSttCloudConsent(event.target.checked)}
                  />
                  <span>
                    <Badge tone="bad">off device</Badge>
                    Allow dictated audio or transcripts to leave this machine.
                  </span>
                </label>
              )}
              <div className="embedding-privacy-strip">
                <Badge tone={sttProvider?.locality === "cloud" ? "bad" : "good"}>
                  {sttProvider?.privacy_label ?? "No provider selected"}
                </Badge>
                <span>
                  {sttProviderCloud ? "cloud use requires consent" : sttProviderId === "whisper_cpp" ? "local model file" : "local test transcript"}
                </span>
                <div>
                  <Button icon={<Save size={15} />} disabled={!sttCanSave || updateBinding.isPending} onClick={saveSttRoute}>
                    Save dictation
                  </Button>
                </div>
              </div>
              {updateBinding.error && <small className="model-test-error">{updateBinding.error.message}</small>}
              {(voiceRuntime?.warnings ?? []).map((warning: string) => (
                <small key={warning} className="model-test-error">
                  {warning}
                </small>
              ))}
            </section>
            <section className="voice-route-panel">
              <div className="embedding-config-header">
                <div>
                  <Badge
                    tone={ttsRuntimeState === "ready" ? "good" : ttsRuntimeState === "mock_only" ? "info" : "warn"}
                    title={String(ttsRuntimeState ?? "checking")}
                  >
                    {voiceRuntimeStateLabel(ttsRuntimeState)}
                  </Badge>
                  <h3>Read aloud</h3>
                  <p title={ttsBinding?.model_id ?? undefined}>{savedModelSummary(ttsBinding?.model_id, "No saved read-aloud voice")}</p>
                </div>
                <Volume2 size={22} />
              </div>
              <div className="voice-route-grid">
                <label>
                  <span>Provider</span>
                  <select aria-label="Read-aloud provider" value={ttsProviderId} onChange={(event) => setTtsProviderId(event.target.value)}>
                    {(providers.data ?? [])
                      .filter((providerOption) => providerOption.kind === "tts")
                      .map((providerOption) => (
                        <option key={providerOption.id} value={providerOption.id}>
                          {providerOption.display_name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span>Model ID</span>
                  <Input aria-label="Read-aloud model ID" value={ttsModelId} onChange={(event) => setTtsModelId(event.target.value)} />
                </label>
                <label>
                  <span>Voice ID</span>
                  <Input aria-label="Read-aloud voice ID" value={ttsVoiceId} onChange={(event) => setTtsVoiceId(event.target.value)} />
                </label>
                <label>
                  <span>Timeout</span>
                  <Input
                    aria-label="Read-aloud timeout seconds"
                    inputMode="decimal"
                    min={1}
                    type="number"
                    value={ttsTimeout}
                    onChange={(event) => setTtsTimeout(event.target.value)}
                    disabled={ttsProviderId !== "piper"}
                  />
                </label>
              </div>
              {ttsProviderId === "piper" && (
                <div className="voice-path-grid">
                  <label>
                    <span>Piper binary</span>
                    <Input
                      aria-label="Piper binary path"
                      placeholder="/usr/local/bin/piper"
                      value={ttsBinaryPath}
                      onChange={(event) => setTtsBinaryPath(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Voice model</span>
                    <Input
                      aria-label="Piper voice model path"
                      placeholder="~/Library/Application Support/The Vault Research Lab/models/voice/tts/..."
                      value={ttsModelPath}
                      onChange={(event) => setTtsModelPath(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Voice config</span>
                    <Input
                      aria-label="Piper voice config path"
                      placeholder="optional .json"
                      value={ttsConfigPath}
                      onChange={(event) => setTtsConfigPath(event.target.value)}
                    />
                  </label>
                </div>
              )}
              {ttsProviderCloud && (
                <label className="voice-cloud-consent">
                  <input
                    aria-label="Allow off-device read aloud"
                    type="checkbox"
                    checked={ttsCloudConsent}
                    onChange={(event) => setTtsCloudConsent(event.target.checked)}
                  />
                  <span>
                    <Badge tone="bad">off device</Badge>
                    Allow text sent for read-aloud audio to leave this machine.
                  </span>
                </label>
              )}
              <div className="embedding-privacy-strip">
                <Badge tone={ttsProvider?.locality === "cloud" ? "bad" : "good"}>
                  {ttsProvider?.privacy_label ?? "No provider selected"}
                </Badge>
                <span>
                  {ttsProviderCloud ? "cloud use requires consent" : ttsProviderId === "piper" ? "local voice file, cached output" : "local cached audio"}
                </span>
                <div>
                  <Button icon={<Save size={15} />} disabled={!ttsCanSave || updateBinding.isPending} onClick={saveTtsRoute}>
                    Save read aloud
                  </Button>
                </div>
              </div>
              {ttsRuntimeWarnings.map((warning: string) => (
                <small key={warning} className="model-test-error">
                  {warning}
                </small>
              ))}
            </section>
            <div className="voice-grid">
              <article className="voice-panel">
                <Mic size={24} />
                <h3>Dictation</h3>
                <p>Turn spoken notes and recordings into local text.</p>
                <div className="voice-actions">
                  <Button icon={<Mic size={15} />} onClick={() => transcribe.mutate()}>
                    Try dictation
                  </Button>
                  <Button icon={<FilePlus2 size={15} />} variant="quiet" onClick={() => transcribeFile.mutate()}>
                    Import audio
                  </Button>
                </div>
                {transcribeFile.data?.source_id && <small>Created source {transcribeFile.data.source_title}</small>}
                {transcribeFile.error && <small className="model-test-error">{transcribeFile.error.message}</small>}
              </article>
              <article className="voice-panel">
                <Volume2 size={24} />
                <h3>Read aloud</h3>
                <p>Create cached local audio from notes, cards, and Assistant answers.</p>
                <Button icon={<Volume2 size={15} />} onClick={() => synthesize.mutate()}>
                  Speak sample
                </Button>
                {synthesize.data?.speech_asset_id && (
                  <small title={synthesize.data.speech_asset_id}>
                    {synthesize.data.cached ? "Audio already saved" : "Audio saved"}
                  </small>
                )}
                {synthesize.error && <small className="model-test-error">{synthesize.error.message}</small>}
              </article>
            </div>
            <div className="voice-list">
              {(voices.data ?? []).map((voice) => (
                <article key={voice.id}>
                  <Badge tone={voice.installed ? "good" : "warn"}>{voice.installed ? "installed" : "not installed"}</Badge>
                  <strong>{voice.display_name}</strong>
                  <span>{voice.privacy_label}</span>
                </article>
              ))}
            </div>
            <div className="voice-list">
              <h3>Audio notes</h3>
              {(voiceAssets.data ?? []).length === 0 && <p>No audio notes yet.</p>}
              {(voiceAssets.data ?? []).map((asset) => (
                <article key={asset.id} title={asset.kind}>
                  <Badge tone="good">{audioAssetKindLabel(asset.kind)}</Badge>
                  <strong>{asset.original_filename ?? "Audio asset"}</strong>
                  <span title={asset.source_id ?? undefined}>{asset.source_id ? "Linked to Storage" : "Not linked"}</span>
                </article>
              ))}
            </div>
            <div className="voice-list">
              <h3>Read-aloud history</h3>
              {(speechAssets.data ?? []).length === 0 && <p>No read-aloud audio yet.</p>}
              {(speechAssets.data ?? []).map((asset) => (
                <article key={asset.id} title={asset.provider}>
                  <Badge tone={asset.sent_off_device ? "bad" : "good"}>{speechAssetPrivacyLabel(asset)}</Badge>
                  <strong>{asset.voice_id ?? "Default voice"}</strong>
                  <span title={asset.audio_path}>{asset.text_preview ?? "Cached audio file"}</span>
                  <Button icon={<Play size={14} />} variant="quiet" onClick={() => playSpeechAsset.mutate(asset.id)} disabled={playSpeechAsset.isPending}>
                    Play
                  </Button>
                </article>
              ))}
            </div>
            {settingsSpeechAudio && (
              <div className="speech-preview">
                <Badge tone="good">Playback</Badge>
                <span title={settingsSpeechAudio.assetId}>Ready to play</span>
                <audio className="speech-player" src={settingsSpeechAudio.dataUrl} controls />
              </div>
            )}
            {playSpeechAsset.error && <small className="model-test-error">{playSpeechAsset.error.message}</small>}
          </div>
        )}

        {tab === "privacy" && (
          <div className="settings-section">
            <div className="privacy-grid">
              <article>
                <Shield size={24} />
                <h3>Cloud stays off</h3>
                <p>Local-only mode rejects cloud providers unless you explicitly allow them.</p>
              </article>
              <article>
                <HardDrive size={24} />
                <h3>Private prompts</h3>
                <p>Model activity keeps hashes and metadata, not full private prompts.</p>
              </article>
            </div>
            <h3>Recent model activity</h3>
            <div className="event-list">
              {(runs.data ?? []).map((run) => (
                <article key={run.id}>
                  <span title={`${run.capability} / ${run.provider}`}>
                    {capabilityDisplayLabel(run.capability)} - {modelRunProviderLabel(run)}
                  </span>
                  <small title={run.status}>
                    {modelRunStatusLabel(run.status)} / {run.sent_off_device ? "Left this device" : "Stayed on this device"}
                  </small>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "export" && (
          <div className="settings-section">
            <div className="data-export-panel">
              <div>
                <Badge tone="good">Local backup</Badge>
                <h3>Workspace backup</h3>
                <p>
                  Save a zip in the Vault backups folder with notes, sources, claims, review history,
                  capsules, files, and a safe database copy.
                </p>
              </div>
              <Button icon={<Download size={15} />} variant="primary" disabled={createWorkspaceExport.isPending} onClick={() => createWorkspaceExport.mutate()}>
                {createWorkspaceExport.isPending ? "Creating" : "Create backup"}
              </Button>
            </div>
            <div className="data-export-grid" aria-label="Workspace backup contents">
              {[
                ["Notes", "One Markdown file per note, with note metadata."],
                ["Sources", "Source records and source blocks for evidence traceability."],
                ["Claims", "Claims, evidence links, and graph edges."],
                ["Capsules", "Capsule membership, versions, exports, imports, and dependencies."],
                ["Review history", "Review decisions and pending proposals."],
                ["Files and database", "Vault files plus a safe SQLite backup."]
              ].map(([title, body]) => (
                <article key={title}>
                  <FileText size={18} />
                  <strong>{title}</strong>
                  <span>{body}</span>
                </article>
              ))}
            </div>
            <div className="data-export-destination">
              <HardDrive size={18} />
              <span>{String(settings.data?.general?.data_folder ?? "Vault data folder")}/backups</span>
            </div>
            {createWorkspaceExport.data && (
              <div className="data-export-result">
                <strong>{createWorkspaceExport.data.filename}</strong>
                <span>{formatBytes(createWorkspaceExport.data.size_bytes)}</span>
                <code>{createWorkspaceExport.data.file_path}</code>
                <div>
                  {Object.entries(createWorkspaceExport.data.manifest.counts ?? {}).map(([key, value]) => (
                    <Badge key={key} tone={value ? "info" : "neutral"}>
                      {key.replace(/_/g, " ")}: {value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {workspaceExportStatus && <small className="readiness-export-status">{workspaceExportStatus}</small>}
          </div>
        )}

        {tab === "raw" && (
          <div className="settings-section">
            <div className="settings-raw-header">
              <Badge tone="neutral">Reference</Badge>
              <h3>Settings snapshot</h3>
              <p>Current local preferences as JSON. Useful when comparing support notes or debugging a setup issue.</p>
            </div>
            <pre aria-label="Settings JSON snapshot">{JSON.stringify(settings.data, null, 2)}</pre>
          </div>
        )}
      </Panel>
    </div>
  );
}
