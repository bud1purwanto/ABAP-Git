# System Instruction & Context
You are an expert full-stack developer with deep knowledge in React, FastAPI, Python, PostgreSQL, and SAP ABAP integration via PyRFC. I want you to build an "ABAP Git and Versioning Middleware" application from scratch. 

This application bridges the gap between SAP ABAP development and modern Git-like version control practices by acting as an intelligent middleman. It pulls ABAP code from SAP, compares it, generates AI-driven commit messages, saves version histories into a PostgreSQL database, allows rollbacks back to SAP, enables syncing code across different SAP landscapes, and provides live deployment validation.

# Tech Stack
- **Frontend**: React (Vite) + Vanilla CSS. Do NOT use Tailwind or generic UI libraries. I want a premium, modern, "glassmorphism" aesthetic with dark/light mode toggle, subtle gradients, and smooth micro-animations.
- **Backend**: Python (FastAPI).
- **Database**: Real PostgreSQL database using SQLAlchemy ORM.
- **SAP Integration**: `pyrfc` library.
- **AI Integration**: AI SDKs (Google Gemini/Anthropic/OpenRouter) with strict JSON/Markdown sanitization for generating commit messages based on diffs.

---

# Core Features & Requirements

## 1. Database Schema (PostgreSQL via SQLAlchemy)
You must implement a real PostgreSQL database with the following tables:
- **User**: Handles authentication (`id`, `username`, `hashed_password`, `role` [super_admin, admin, user], `git_author_name`, `created_at`).
- **Sandbox**: Stores SAP connection details (`name`, `host`, `sysnr`, `client`, `rfc_user`, `rfc_password`, `environment` [SANDBOX, DEV, QA, PROD]).
- **ProgramVersion**: Stores the Git-like commits (`id`, `program_name`, `source_code`, `commit_message`, `author`, `version_hash`, `created_at`).
- **ActivityLog**: Logs every action (`action` [PULL, PUSH, COMMIT, DELETE, DEPLOY_LIVE, SYNC, COMPARE], `username`, `program_name`, `sandbox_name`, `detail`, `created_at`). Include an SQLAlchemy `after_insert` event to automatically prune logs older than 30 days.

## 2. Backend API Endpoints (FastAPI)
All endpoints must fail fast and handle exceptions cleanly, returning meaningful HTTP errors.
- **Auth & Users**: JWT-based authentication. Endpoints for Login, List Users, Create User, Delete User, Reset Password, and Role verification.
- **Sandboxes CRUD**: `GET /api/sandboxes`, `POST /api/sandboxes`, `PUT /api/sandboxes/{id}`, `DELETE /api/sandboxes/{id}`.
- **SAP Operations**:
  - `GET /api/sap/{sandbox_id}/logon-check`: Verifies PyRFC connection.
  - `GET /api/sap/{sandbox_id}/tcodes`: Fetches active user T-Codes.
  - `GET /api/sap/read`: Fetches ABAP code via `RPY_PROGRAM_READ`, diffs it against DB, and returns `difflib.unified_diff`. *CRITICAL: Strip trailing whitespaces.*
  - `POST /api/sap/write`: Uses `RFC_ABAP_INSTALL_AND_RUN` to install code.
  - `POST /api/sap/validate_live_deployment`: Validates if a program is locked in SAP tables (`E070`, `E071`) before allowing deployment to PROD.
  - `POST /api/sap/sync/compare` & `apply`: Fetches code from Source Server and deploys directly to Target Server.
  - `POST /api/sap/compare`: Fetches code from Server A and Server B, generating a real-time diff.
- **Git Operations**: 
  - `POST /api/git/commit`: Saves code to `ProgramVersion`.
  - `GET /api/git/history` & `GET /api/git/commits`: Returns paginated commit lists.
  - `PATCH /api/git/version/{id}` & `DELETE /api/git/version/{id}`: Edit or delete commits.
- **Activity & Stats**: `GET /api/activity` (paginated), `GET /api/stats/overview`.

## 3. Frontend UI/UX (React + CSS)
The UI must be visually stunning, using deep dark colors (e.g., `#0f172a`), subtle gradients, glassmorphism panels, custom scrollbars, and fully responsive layouts. 
- **Dashboard Layout**: A sidebar navigation system with user profile card pinned to the bottom.
- **Overview Tab**: Displays metric cards (Servers, Programs, Commits) and feeds for Recent Commits and Recent Activity. Include "Show All" buttons that open infinite-scrolling paginated modals.
- **Sandboxes Tab**: Add/Edit/Delete SAP environments. Includes a live connection test button.
- **Git Operations Tab**:
  - Select Sandbox and input `Z_PROGRAM_NAME`. 
  - Action Buttons: "Fetch Code", "AI Generate Commit", "Commit to DB", "Rollback".
  - *Diff Viewer Window*: Custom monospaced viewer (green for `+`, red for `-`).
- **Sync Tab**: UI to pick a Source Server and a Target Server. Click to compare the ABAP code directly between two SAP environments, view the diff, and click "Deploy" to synchronize them.
- **Compare Server Tab**: Side-by-side split screen comparing code of a specific program between two different SAP servers.
- **Git Log Tab**: Searchable history of all commits grouped by Program, allowing users to Edit Commit Messages or Delete Commits (admin only).
- **Users Tab**: Admin panel to manage users, reset passwords, and assign roles.

# Execution Rules
1. Build the database structure first, including the auto-prune events.
2. Build the backend APIs and SAP RFC integration (handling login checks and locks).
3. Build the frontend architecture with a beautiful Dashboard Layout.
4. Ensure the Diff Viewers and Modals are flawless and responsive.
5. Provide the full code structure. No dummy implementations for the database or SAP logic.
