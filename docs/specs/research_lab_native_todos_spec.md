# Research Lab Native Todos Spec

**Document version:** 0.1  
**Date:** 2026-06-16  
**Status:** proposed  
**Purpose:** Add a native, minimalist todo system to The Vault Research Lab so research work can turn into tracked action without leaving the local-first knowledge workspace.

## 1. Product Thesis

The Vault Research Lab should help the user think, collect, verify, and act.

The current product is strong at capturing knowledge, reviewing claims, generating notes, and building evidence-backed structure. The missing everyday loop is simple task follow-through: "I found something important; now what do I need to do?"

Native todos should make that loop effortless.

The target feeling is closer to Todoist and Superlist than to a project-management suite:

- fast capture,
- low visual noise,
- clear today/inbox focus,
- lightweight lists,
- optional due dates,
- optional labels,
- subtasks when needed,
- contextual detail only on demand.

The Research Lab adaptation is that tasks can attach to notes, sources, claims, capsules, review items, learning items, and tool runs. A task is not just a floating reminder; it can be a small action anchored to evidence.

## 2. Reference App Takeaways

This spec uses public Todoist and Superlist documentation as UX references, not as a clone target.

### Todoist Patterns To Borrow

Todoist's strongest pattern is speed of capture. Quick Add accepts a task name plus structured details such as dates, labels, reminders, and projects in one field. Todoist also leans on natural-language dates, recurring schedules, priorities, labels, filters, sections, and subtasks.

Useful references:

- [Todoist Quick Add](https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz)
- [Todoist task view](https://www.todoist.com/help/articles/use-the-task-view-to-manage-tasks-in-todoist-eDeRDO0C)
- [Todoist recurring dates](https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)
- [Todoist filters](https://www.todoist.com/help/articles/introduction-to-filters-V98wIH)
- [Todoist glossary](https://www.todoist.com/help/articles/todoist-glossary-cA60laWMH)

Borrow:

- one-line capture first,
- natural language dates,
- fast keyboard flow,
- priority as lightweight signal,
- labels for cross-list batching,
- sections/subtasks for decomposition,
- saved smart views.

Avoid:

- making filters feel like a query language in the default UI,
- turning the task detail view into a dense settings panel,
- requiring projects for every captured item.

### Superlist Patterns To Borrow

Superlist's strongest pattern is blending tasks with lists and notes. Lists can contain tasks, text, images, and attachments; tasks can contain details and subtasks; the sidebar has Today, Inbox, Updates, Lists, Tasks, quick create, and sections.

Useful references:

- [Superlist sidebar](https://help.superlist.com/en/articles/22657-get-to-know-the-sidebar)
- [Superlist inbox](https://help.superlist.com/en/articles/73472-manage-tasks-in-the-inbox)
- [Superlist tasks and subtasks](https://help.superlist.com/en/articles/23853-create-tasks-and-subtasks)
- [Superlist basics](https://help.superlist.com/en/articles/10050-superlist-basics-lists-tasks-sections-meetings-explained)
- [Superlist lists](https://help.superlist.com/en/articles/22661-create-and-organize-lists)

Borrow:

- Inbox as a triage space,
- Today as the daily working view,
- lists that can hold both task intent and note-like context,
- task details that can contain text and subtasks,
- quick command capture,
- inbox-zero processing.

Avoid:

- heavy collaboration concepts in v1,
- rich list customization as a first milestone,
- making todo lists compete with Research Lab notes.

## 3. Product Principles

### 3.1 Tasks Are Action, Not Knowledge

Claims, notes, and sources remain the canonical knowledge layer. Todos are commitments, reminders, and next actions.

A todo can reference a claim or source, but completing a todo does not approve a claim, rewrite a source, or mutate the graph.

### 3.2 Capture Should Be Nearly Frictionless

The user should be able to create a todo from:

- global quick capture,
- selected note text,
- selected source text,
- an approved or pending claim,
- a review item,
- a capsule,
- an assistant answer,
- a Night Lab brief,
- a learning item.

The default task can be only a title. Everything else is optional.

### 3.3 Context Should Be Attached, Not Repeated

If a todo comes from a source block, the task detail should link back to that block. It should not duplicate large source text.

If a todo comes from a generated note or assistant answer, the task should preserve provenance: origin, source object, local/off-device status if AI suggested it, and review status if applicable.

### 3.4 Native Todos Should Stay Minimal

No Kanban board in v1. No Gantt chart. No time tracking. No team chat. No complex dependency graph.

The core should be:

```text
Inbox, Today, Upcoming, Lists, Completed
```

Everything else should emerge from filters and context.

## 4. User-Facing Model

### Todo

A todo is one actionable item.

Core fields:

- title,
- status,
- due date,
- optional scheduled date/time,
- optional deadline,
- priority,
- list,
- labels,
- source links,
- subtasks,
- notes/description,
- recurrence rule,
- provenance.

### Todo List

A list is a lightweight container for related tasks.

Examples:

- Paper backlog,
- Experiments,
- Writing,
- People to contact,
- Research Lab improvements,
- Capsule cleanup.

Lists are not folders for sources or notes. They organize action.

### Smart View

A smart view is a saved task query with a friendly name.

Built-in smart views:

- Inbox,
- Today,
- Upcoming,
- Waiting,
- Flagged,
- Generated suggestions,
- Completed.

Custom smart views can come later.

### Context Link

A context link attaches a todo to another Vault entity.

Supported target types:

```text
note
source
source_block
claim
kg_node
review_item
capsule
learning_item
tool
lab_job
assistant_answer
```

## 5. Core Workflows

### 5.1 Quick Add

The user opens quick add from the app shell or Todos view.

Required behavior:

- one focused input,
- Enter saves,
- Escape closes,
- natural-language date parsing,
- optional tokens for list, label, and priority,
- current context can be attached automatically.

Example input:

```text
Email Anna about citation mismatch tomorrow @waiting #Paper review p2
```

Parsed result:

```json
{
  "title": "Email Anna about citation mismatch",
  "due_date": "2026-06-17",
  "labels": ["waiting"],
  "list": "Paper review",
  "priority": 2
}
```

Supported v1 tokens:

| Token | Meaning |
| --- | --- |
| `today` | due today |
| `tomorrow` | due tomorrow |
| `next week` | due next Monday |
| weekday names | next matching weekday |
| `@label` | add label |
| `#list` | assign list |
| `p1`, `p2`, `p3`, `p4` | priority |
| `every ...` | recurrence rule |

Natural-language parsing can be conservative. If parsing is uncertain, keep text in the title instead of guessing.

### 5.2 Inbox Triage

Inbox collects:

- quick captured tasks without a list,
- tasks created from notes/sources without explicit destination,
- AI-suggested task proposals accepted by the user,
- review-derived follow-ups,
- Night Lab follow-ups.

Inbox actions:

- complete,
- set due date,
- move to list,
- add label,
- attach context,
- defer,
- delete.

The desired flow is not "manage a database." It is "clear the pile."

### 5.3 Today

Today shows:

- tasks due today,
- overdue tasks,
- manually pinned focus tasks,
- optionally tasks scheduled for today.

Today should be the fastest working surface:

- complete,
- reschedule,
- open context,
- add quick task,
- drag or keyboard reorder within manual focus section.

Overdue tasks should be visible but calm. No red wall of shame.

### 5.4 Upcoming

Upcoming shows dated tasks grouped by date.

V1 can be a vertical list grouped by:

- Overdue,
- Today,
- Tomorrow,
- This week,
- Later.

Calendar layout is future work.

### 5.5 Contextual Task Creation

Every major research surface should have "Create todo" where it naturally belongs.

Examples:

- Note selection -> Create todo from selection.
- Source block -> Follow up.
- Claim -> Verify this claim.
- Review item -> Create edit task.
- Assistant answer -> Save as todo.
- Capsule health warning -> Add cleanup todo.
- Night Lab brief item -> Add todo.

The created todo should include a context link back to the origin.

### 5.6 AI-Suggested Todos

Local models may propose todos from notes, transcripts, sources, or Night Lab output.

Rules:

- AI-created todos are proposals until accepted.
- User-created todos are canonical immediately.
- Proposals should appear in a reviewable "Suggested todos" lane or review item type.
- The proposal payload must include source text hash and context links.
- The model output must not silently create active todos.

Example tasks a model might suggest:

- "Verify the quoted statistic against the original PDF."
- "Turn the open question about retrieval evaluation into an experiment."
- "Ask Sarah for the missing license source."

### 5.7 Markdown Checkbox Integration

Notes may contain Markdown checkboxes:

```md
- [ ] Re-read section 4 before publishing
- [x] Export references
```

V1 behavior:

- Existing checkboxes remain note content.
- The user can convert selected checkbox lines into native todos.
- Native todos can be inserted into a note as linked checkbox lines.
- Editing a linked checkbox completion state in the note should update the todo when the link marker is present.

Recommended linked syntax:

```md
- [ ] Re-read section 4 before publishing <!-- vault-todo:todo_123 -->
```

Do not attempt full bidirectional sync for arbitrary checkbox text in v1.

## 6. Information Architecture

Add a top-level navigation item:

```text
Tasks
```

Inside Tasks:

- Inbox,
- Today,
- Upcoming,
- Lists,
- Completed.

Optional secondary strip:

- Waiting,
- Suggested,
- All.

The app should also show contextual tasks inside:

- Note detail,
- Source detail,
- Claim detail,
- Capsule detail,
- Review detail.

Contextual panes should show only tasks linked to the current object.

## 7. UX Requirements

### 7.1 Visual Style

Follow the existing Research Lab direction:

- quiet desktop-native feel,
- dense but readable rows,
- no decorative hero sections,
- no oversized cards,
- no nested cards,
- minimal labels,
- icon buttons with tooltips,
- stable row height,
- subtle priority color,
- no celebratory animation beyond a small completion transition.

### 7.2 Task Row

Desktop row layout:

```text
[checkbox] Title text                         Due  List  Context  Priority
```

Mobile row layout:

```text
[checkbox] Title text
Due · List · Context
```

Row interactions:

- click title opens detail drawer,
- click checkbox completes,
- right-click opens quick menu,
- due pill opens date picker,
- context pill jumps to linked object,
- keyboard focus is visible.

### 7.3 Detail Drawer

Task detail opens in a side drawer, not a full page, unless screen width requires it.

Fields:

- title,
- status,
- due date,
- deadline,
- priority,
- list,
- labels,
- description,
- subtasks,
- context links,
- provenance,
- activity.

The drawer should start compact. Advanced provenance can be collapsed.

### 7.4 Empty States

Keep copy short.

Examples:

```text
No tasks
```

```text
Inbox clear
```

```text
Nothing due today
```

Do not explain the entire feature in empty states.

## 8. Keyboard Shortcuts

Suggested desktop shortcuts:

| Shortcut | Action |
| --- | --- |
| `Q` | Quick add task when in Tasks |
| `Cmd/Ctrl+K` | Global command search includes task actions |
| `E` | Complete focused task |
| `Enter` | Open focused task |
| `A` | Add task below |
| `Shift+A` | Add task above |
| `D` | Set due date |
| `L` | Move to list |
| `P` | Set priority |
| `Backspace` | Delete selected task with confirmation |
| `Esc` | Close composer or drawer |

Global quick task capture can reuse the existing quick note pattern if the app already has one global capture surface.

## 9. Data Model

Add tables to `services/core/vault_core/db/schema.py`.

### `todo_lists`

```sql
CREATE TABLE IF NOT EXISTS todo_lists (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  UNIQUE(workspace_id, name),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);
```

### `todos`

```sql
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  list_id TEXT,
  parent_todo_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 4,
  due_date TEXT,
  due_time TEXT,
  deadline_date TEXT,
  recurrence_rule TEXT,
  scheduled_for TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  source_kind TEXT NOT NULL DEFAULT 'user',
  source_ref_json TEXT NOT NULL DEFAULT '{}',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(list_id) REFERENCES todo_lists(id),
  FOREIGN KEY(parent_todo_id) REFERENCES todos(id)
);
```

Status values:

```text
open
completed
cancelled
archived
```

Priority values:

```text
1 = urgent
2 = high
3 = normal
4 = low
```

### `todo_labels`

```sql
CREATE TABLE IF NOT EXISTS todo_labels (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, name),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);
```

### `todo_label_links`

```sql
CREATE TABLE IF NOT EXISTS todo_label_links (
  todo_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(todo_id, label_id),
  FOREIGN KEY(todo_id) REFERENCES todos(id),
  FOREIGN KEY(label_id) REFERENCES todo_labels(id)
);
```

### `todo_context_links`

```sql
CREATE TABLE IF NOT EXISTS todo_context_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  todo_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_title TEXT,
  relation TEXT NOT NULL DEFAULT 'related',
  exact_quote TEXT,
  locator TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(todo_id) REFERENCES todos(id)
);
```

Relation values:

```text
created_from
supports
blocks
verifies
follow_up_for
related
```

### `todo_events`

```sql
CREATE TABLE IF NOT EXISTS todo_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  todo_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(todo_id) REFERENCES todos(id)
);
```

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_todos_workspace_status ON todos(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(workspace_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_todos_list ON todos(workspace_id, list_id, sort_index);
CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_context_target ON todo_context_links(workspace_id, target_type, target_id);
```

## 10. API Contracts

Add Pydantic schemas in `services/core/vault_core/api/schemas.py`.

### Create Todo

```python
class TodoCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    list_id: str | None = None
    list_name: str | None = None
    parent_todo_id: str | None = None
    due_date: str | None = None
    due_time: str | None = None
    deadline_date: str | None = None
    recurrence_rule: str | None = None
    priority: int = Field(default=4, ge=1, le=4)
    labels: list[str] = Field(default_factory=list)
    context_links: list[TodoContextLinkCreate] = Field(default_factory=list)
    source_kind: Literal["user", "note_selection", "source_selection", "review", "assistant", "night_lab", "ai_suggestion"] = "user"
```

### Quick Add Todo

```python
class TodoQuickAddRequest(BaseModel):
    text: str = Field(min_length=1)
    context: dict[str, Any] = Field(default_factory=dict)
```

### Update Todo

```python
class TodoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    list_id: str | None = None
    due_date: str | None = None
    due_time: str | None = None
    deadline_date: str | None = None
    recurrence_rule: str | None = None
    priority: int | None = Field(default=None, ge=1, le=4)
    labels: list[str] | None = None
```

### Routes

```text
GET    /todos
POST   /todos
POST   /todos/quick-add
GET    /todos/{todo_id}
PUT    /todos/{todo_id}
POST   /todos/{todo_id}/complete
POST   /todos/{todo_id}/reopen
DELETE /todos/{todo_id}

GET    /todo-lists
POST   /todo-lists
PUT    /todo-lists/{list_id}
POST   /todo-lists/{list_id}/archive

GET    /todo-labels
POST   /todo-labels

GET    /todos/views/{view_id}
GET    /todos/context/{target_type}/{target_id}
POST   /todos/from-selection
POST   /todos/suggestions/from-note
POST   /todos/suggestions/from-source
```

Built-in view IDs:

```text
inbox
today
upcoming
waiting
suggested
completed
all
```

## 11. Backend Behavior

### 11.1 Quick Add Parser

Implement a deterministic parser first.

Responsibilities:

- strip and normalize input,
- detect date phrases,
- detect `@labels`,
- detect `#list`,
- detect `p1` to `p4`,
- detect simple recurrence phrases,
- return parse warnings rather than failing.

Do not use an LLM for v1 quick add parsing. It should work offline, instantly, and predictably.

### 11.2 Recurrence

V1 recurrence support:

- daily,
- weekly,
- every weekday,
- every N days,
- every N weeks,
- every month on same day.

On completing a recurring todo:

1. Keep an event for the completed occurrence.
2. Move `due_date` to the next occurrence.
3. Clear `completed_at`.
4. Keep subtasks open by default unless user chooses complete forever.

### 11.3 Context Links

When a task is created from another entity, create `todo_context_links` row.

For source selections:

- store target type,
- target id,
- locator,
- optional exact quote,
- quote hash in metadata.

For note selections:

- store note id,
- optional text range when available,
- selected text hash.

### 11.4 Generated Suggestions

AI todo extraction should create review items of type:

```text
todo_suggestion
```

Payload:

```json
{
  "title": "Verify citation source",
  "description": "",
  "priority": 3,
  "due_date": null,
  "labels": ["verification"],
  "context_links": [
    {
      "target_type": "claim",
      "target_id": "claim_123",
      "relation": "verifies"
    }
  ],
  "source_hash": "...",
  "ai_run_id": "airun_123"
}
```

Approving the review item creates the todo. Rejecting it leaves no active task.

## 12. Frontend Implementation

### 12.1 Types

Add TypeScript types:

```ts
export type Todo = {
  id: string;
  title: string;
  description: string;
  status: "open" | "completed" | "cancelled" | "archived" | string;
  priority: 1 | 2 | 3 | 4;
  due_date?: string | null;
  due_time?: string | null;
  deadline_date?: string | null;
  recurrence_rule?: string | null;
  list_id?: string | null;
  list?: TodoList | null;
  labels: TodoLabel[];
  context_links: TodoContextLink[];
  subtasks?: Todo[];
  created_at: string;
  updated_at: string;
};
```

### 12.2 IPC/API Route Map

Add routes to:

- `apps/desktop/src/lib/apiClient.ts`,
- `apps/desktop/electron/ipc/routes.ts`,
- `apps/desktop/src/lib/types.ts`.

Route names:

```text
todos.list
todos.quickAdd
todos.create
todos.get
todos.update
todos.complete
todos.reopen
todos.delete
todos.views
todos.context
todoLists.list
todoLists.create
todoLists.update
todoLists.archive
todoLabels.list
```

### 12.3 React Surfaces

Add `TasksView`.

Sections:

- left narrow task nav,
- central task list,
- right detail drawer when selected.

Task nav:

- Inbox,
- Today,
- Upcoming,
- Suggested,
- Completed,
- Lists.

Task list:

- grouped rows,
- inline quick add at top,
- keyboard navigation,
- empty states.

Detail drawer:

- editable title,
- date controls,
- priority segmented control,
- list select,
- labels input,
- subtasks,
- context links,
- provenance disclosure.

### 12.4 Contextual Components

Add reusable `LinkedTodosPanel`.

Props:

```ts
{
  targetType: string;
  targetId: string;
  title?: string;
}
```

Use it in:

- note detail,
- source detail,
- claim detail,
- capsule detail,
- review item detail.

### 12.5 Quick Capture Integration

Update global quick capture so destination can be:

```text
Note
Source
Task
```

For Task:

- single field,
- optional current context,
- Enter creates todo,
- no extra explanatory text.

## 13. AI Integration

Add a local capability:

```text
suggest_todos
```

Default provider:

```text
mock_llm
```

Production route:

```text
local LLM through starter pack
```

Prompts should extract only actionable next steps and preserve source references.

Rules:

- no automatic canonical todo creation from AI output,
- proposed todos go through review,
- exact source quote validation when a todo is tied to source evidence,
- no cloud route unless user explicitly opts in.

## 14. Search and Assistant Integration

Tasks should be searchable.

Search result type:

```text
todo
```

Assistant may answer questions like:

- "What follow-ups do I have for this capsule?"
- "What tasks are linked to weak claims?"
- "What should I work on today?"

Assistant answers should use task data directly, not infer tasks from notes unless asked to suggest todos.

## 15. Privacy and Local-First Requirements

Todos are local workspace data.

Rules:

- no external sync in v1,
- no calendar push in v1,
- no email integration in v1,
- no Slack/GitHub import in v1,
- no cloud AI task extraction by default,
- provenance must show if a task was user-created, imported, or AI-suggested.

Future integrations can be added behind explicit opt-in.

## 16. Testing Plan

### Backend Tests

Add tests for:

- todo CRUD,
- quick add parsing,
- labels creation and reuse,
- list creation and archive,
- context link creation,
- due-date views,
- today/upcoming filters,
- recurrence completion,
- AI suggestion review approval,
- note checkbox conversion.

### Frontend Tests

Add tests for:

- Tasks nav renders,
- Inbox quick add creates row,
- Today view groups overdue/today tasks,
- completing task updates row,
- detail drawer edits title/date/priority,
- contextual linked tasks panel renders in Note/Source detail,
- quick capture Task destination works.

### E2E Smoke

Add one Playwright smoke:

1. Create task from global quick capture.
2. Add due date via natural text.
3. Complete task.
4. Create task from note selection.
5. Open linked note from task context pill.

## 17. Implementation Milestones

### Milestone T1: Native Todo Core

- schema tables,
- Pydantic contracts,
- CRUD endpoints,
- deterministic quick add parser,
- basic list/label support,
- tests.

Acceptance:

- backend can create, list, update, complete, reopen, and delete todos,
- quick add parses dates, labels, list, and priority,
- context links are persisted.

### Milestone T2: Tasks UI

- top-level Tasks nav,
- Inbox, Today, Upcoming, Completed,
- task rows,
- detail drawer,
- inline quick add,
- keyboard basics.

Acceptance:

- user can manage everyday tasks without touching Advanced settings,
- UI remains minimal on desktop and mobile.

### Milestone T3: Research Context Integration

- create todo from note selection,
- create todo from source block,
- linked todos panel,
- review-item follow-up tasks,
- capsule linked tasks.

Acceptance:

- every major research object can show its linked todos,
- jumping between task and source context works.

### Milestone T4: Suggested Todos

- `suggest_todos` capability,
- review item type `todo_suggestion`,
- local prompt and mock implementation,
- approve/reject flow,
- Night Lab follow-up integration.

Acceptance:

- model suggestions never become active tasks without user approval,
- suggested tasks preserve source context.

### Milestone T5: Polish and Power Use

- recurrence,
- saved smart views,
- note checkbox linked sync,
- search integration,
- assistant task queries.

Acceptance:

- tasks feel native to the Research Lab rather than bolted on.

## 18. Open Questions

- Should the top-level nav label be `Tasks`, `Todos`, or `Next`?
- Should task lists be allowed inside capsules as capsule-specific action plans?
- Should completed tasks linked to a source appear in source history forever or hide by default?
- Should reminders trigger native OS notifications in v1, or wait until calendar/notification settings exist?
- Should `deadline_date` ship in v1, or should due date be enough for the first slice?

## 19. Product Principle

Knowledge without action gets heavy.

Todos should be the lightest possible bridge from research insight to next step.
