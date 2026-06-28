import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";

/**
 * useServerValidation
 * -------------------
 * Auto-checks a server for security violations whenever `serverId` changes.
 *
 * Checks performed (based on server environment):
 *  - Non-sandbox (DEV/QA/PROD): Multiple Logon Check
 *  - Sandbox: SAP Lock / Edit Check (only when programName is given)
 *
 * Returns:
 *   { checking, passed, message, retry }
 *   - checking  : true while the RFC call is in progress
 *   - passed    : true = OK to proceed | false = blocked | null = not checked yet
 *   - message   : human-readable status message
 *   - retry     : function to manually re-run the check
 */
export function useServerValidation({ serverId, environment, programName = "", author = "" }) {
  const [checking, setChecking] = useState(false);
  const [passed, setPassed] = useState(null);   // null = not yet checked
  const [message, setMessage] = useState("");

  const run = useCallback(async () => {
    if (!serverId || !environment) {
      setPassed(null);
      setMessage("");
      return;
    }

    // Sandbox + no programName → skip Lock check (nothing to lock-check yet)
    if (environment === "SANDBOX" && !programName) {
      setPassed(null);
      setMessage("");
      return;
    }

    setChecking(true);
    setPassed(null);
    setMessage("");

    try {
      if (environment !== "SANDBOX") {
        // ── Multiple Logon Check (DEV / QA / PROD) ──────────────────
        const params = new URLSearchParams({ sandbox_id: serverId });
        if (author) params.append("author", author);
        const res = await api.checkLogon(serverId, author);

        if (res.applicable === false) {
          setPassed(true);
          setMessage("hidden");
        } else if (!res.passed) {
          const terminal = res.conflicting_terminal
            ? ` (PC/Terminal: ${res.conflicting_terminal})`
            : "";
          setPassed(false);
          setMessage(
            `Multiple Logon blocked: User '${res.conflicting_user}'${terminal} ` +
            `has an active SAP GUI session. Log out first.`
          );
        } else {
          setPassed(true);
          setMessage("No active dialog session — server is safe to use.");
        }
      } else {
        // ── SAP Lock / Edit Check (SANDBOX) ─────────────────────────
        // Re-use the existing logon-check endpoint; for sandbox we just verify
        // the sandbox is not being actively edited (checked via enqueue).
        // We call a lightweight lock check endpoint.
        const res = await api.checkLock(serverId, programName);
        if (!res.passed) {
          setPassed(false);
          setMessage(
            `Lock blocked: Program '${programName}' is currently being edited ` +
            `by user '${res.lock_user || "unknown"}'. Wait for them to release.`
          );
        } else {
          setPassed(true);
          setMessage("Program is not locked — sandbox is safe to use.");
        }
      }
    } catch (err) {
      // Fail-closed: if we can't check, block access
      setPassed(false);
      setMessage(`Validation error: ${err.message}. Access blocked for safety.`);
    } finally {
      setChecking(false);
    }
  }, [serverId, environment, programName, author]);

  // Auto-run whenever the server or program changes
  useEffect(() => {
    run();
  }, [run]);

  return { checking, passed, message, retry: run };
}
