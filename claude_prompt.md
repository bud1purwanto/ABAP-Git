# System Instruction & Context
You are an expert full-stack developer with deep knowledge in React, FastAPI, Python, PostgreSQL, and SAP ABAP integration via PyRFC. I want you to build an "ABAP Git and Versioning Middleware" application from scratch. 

This application bridges the gap between SAP ABAP development and modern Git-like version control practices by acting as an intelligent middleman. It pulls ABAP code from SAP, compares it, generates AI-driven commit messages, saves version histories into a PostgreSQL database, and allows rollbacks back to SAP.

# Tech Stack
- **Frontend**: React (Vite) + Vanilla CSS. Do NOT use Tailwind or generic UI libraries. I want a premium, modern, "glassmorphism" aesthetic with dark themes and smooth animations.
- **Backend**: Python (FastAPI).
- **Database**: Real PostgreSQL database using SQLAlchemy ORM (NO dummy data).
- **SAP Integration**: `pyrfc` library.
- **AI Integration**: AI SDK (Google Gemini/Anthropic) for generating commit messages based on diffs.

---

# Core Features & Requirements

## 1. Database Schema (PostgreSQL via SQLAlchemy)
You must implement a real PostgreSQL database with the following tables:
- **Sandbox**: Stores SAP connection details (`name`, `host`, `sysnr`, `client`, `rfc_user`, `rfc_password`).
- **ProgramVersion**: Stores the Git-like commits (`id`, `program_name`, `source_code`, `commit_message`, `author`, `version_hash`, `created_at`).
- **ActivityLog**: Logs every action (`action` [PULL, PUSH, COMMIT, DELETE], `username`, `program_name`, `sandbox_name`, `detail`, `created_at`).

## 2. Backend API Endpoints (FastAPI)
All endpoints must fail fast and handle exceptions cleanly, returning meaningful HTTP 500/404 errors.
- **Sandboxes CRUD**: `GET /api/sandboxes`, `POST /api/sandboxes`, `DELETE /api/sandboxes/{id}`.
- **Read from SAP (`GET /api/sap/read`)**:
  - Accepts `program_name`, `sandbox_id`, and an optional `version_id`.
  - Connects to SAP via `pyrfc` and calls the `RPY_PROGRAM_READ` function module to fetch the ABAP source code.
  - Queries the database for the specified `version_id` (or the latest version if not provided).
  - Uses `difflib.unified_diff` to compare the database code vs the SAP code. *CRITICAL: Strip trailing whitespaces (`rstrip()`) before diffing to avoid false positive changes on blank lines!*
  - Returns the raw SAP source, the DB source, and the diff text.
- **Write/Rollback to SAP (`POST /api/sap/write`)**:
  - Accepts `program_name`, `sandbox_id`, and `version_id`.
  - Fetches the code from the database for the given `version_id`.
  - Connects to SAP and uses `RFC_ABAP_INSTALL_AND_RUN` with `MODE='I'` to inject and install the code back into the SAP server. *DO NOT use `RPY_PROGRAM_UPDATE` as it throws remote call errors in some environments.*
- **AI Endpoints (`POST /api/ai/generate-commit`)**: 
  - Takes the diff text and prompts the AI to generate a concise, professional Git commit message summarizing the changes.
- **Git Operations**: 
  - `POST /api/git/commit`: Saves the pulled SAP code as a new record in `ProgramVersion`.
  - `GET /api/git/history`: Returns a list of dictionaries with commit metadata (id, hash, author, created_at, commit_message) for a specific program.

## 3. Frontend UI/UX (React + CSS)
The UI must be visually stunning, using deep dark colors (e.g., `#0f172a`), subtle gradients, glassmorphism panels, and custom scrollbars. 
- **Login Screen**: Simple dummy login screen protecting the main dashboard.
- **Dashboard Layout**: A sidebar/tab system switching between "Sandboxes" and "Git Operations".
- **Sandboxes Tab**: A sleek form to add new SAP environments and a list with a custom "Delete" modal (do NOT use native `window.confirm`).
- **Git Operations Tab**:
  - **Controls Area**: 
    1. Dropdown to select Sandbox.
    2. Input field for `Z_PROGRAM_NAME`.
    3. *Auto-loading History Dropdown*: An `onChange` trigger that auto-fetches commit history when typing/selecting a program, populating a dropdown of historical commits. Selecting a version from this dropdown MUST instantly trigger an auto-preview comparison.
    4. Action Buttons: "1. Fetch Code from SAP", "2. AI Generate Commit", "3. Commit to ABAP_GIT (Postgres)", and a red "Rollback SAP to Selected Version".
  - **Diff Viewer Window**: A custom-styled, monospaced code viewer. Lines starting with `+` should have a translucent green background, lines with `-` a translucent red background. Unchanged lines remain white. Align everything to the left.
  - **Commit Message Box**: A textarea to hold the AI-generated message or allow manual editing.
  - **Activity & Commits Feed**: Display recent commits and activity logs beautifully in a table and list format on the dashboard.

# Execution Rules
1. Build the database structure first.
2. Build the backend APIs and SAP RFC integration.
3. Build the frontend architecture.
4. Ensure the Diff Viewer displays line changes flawlessly.
5. Provide the full code structure. No dummy implementations for the database or SAP logic.
