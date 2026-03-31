const STORAGE_KEY = 'guardianagent_approval_ui_state_v1';
const MAX_ENTRY_AGE_MS = 12 * 60 * 60 * 1000;

const approvalUiState = loadApprovalUiState();

function loadApprovalUiState() {
  try {
    if (typeof sessionStorage === 'undefined') return {};
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistApprovalUiState() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(approvalUiState));
  } catch {
    // Ignore storage failures; the live in-memory map still avoids double clicks.
  }
}

function normalizeApprovalDecision(decision) {
  return decision === 'denied' ? 'denied' : 'approved';
}

function pruneApprovalUiState(now = Date.now()) {
  let changed = false;
  for (const [approvalId, state] of Object.entries(approvalUiState)) {
    const updatedAt = Number(state?.updatedAt) || 0;
    if (!updatedAt || now - updatedAt > MAX_ENTRY_AGE_MS) {
      delete approvalUiState[approvalId];
      changed = true;
    }
  }
  if (changed) {
    persistApprovalUiState();
  }
}

function writeApprovalUiState(approvalIds, nextState) {
  pruneApprovalUiState();
  const ids = Array.isArray(approvalIds) ? approvalIds : [approvalIds];
  const now = Date.now();
  ids
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .forEach((approvalId) => {
      approvalUiState[approvalId] = {
        ...nextState,
        updatedAt: now,
      };
    });
  persistApprovalUiState();
}

export function getApprovalUiState(approvalId) {
  pruneApprovalUiState();
  const id = String(approvalId || '').trim();
  if (!id) return null;
  const state = approvalUiState[id];
  return state && typeof state === 'object' ? state : null;
}

export function getApprovalUiGroupState(approvalIds) {
  const states = (Array.isArray(approvalIds) ? approvalIds : [approvalIds])
    .map((approvalId) => getApprovalUiState(approvalId))
    .filter(Boolean);
  if (states.length === 0) return null;
  const processing = states.find((state) => state.status === 'processing');
  if (processing) return processing;
  const errored = states.find((state) => state.status === 'error');
  if (errored) return errored;
  const allApproved = states.every((state) => state.status === 'approved');
  if (allApproved) return states[0];
  const allDenied = states.every((state) => state.status === 'denied');
  if (allDenied) return states[0];
  return states[states.length - 1];
}

export function markApprovalUiProcessing(approvalIds, decision) {
  const normalizedDecision = normalizeApprovalDecision(decision);
  writeApprovalUiState(approvalIds, {
    status: 'processing',
    decision: normalizedDecision,
    message: normalizedDecision === 'approved' ? 'Approving…' : 'Denying…',
  });
}

export function markApprovalUiResolved(approvalIds, decision, message = '') {
  const normalizedDecision = normalizeApprovalDecision(decision);
  writeApprovalUiState(approvalIds, {
    status: normalizedDecision,
    decision: normalizedDecision,
    message: String(message || (normalizedDecision === 'approved' ? 'Approved' : 'Denied')),
  });
}

export function markApprovalUiError(approvalIds, message = '') {
  writeApprovalUiState(approvalIds, {
    status: 'error',
    decision: '',
    message: String(message || 'Approval update failed'),
  });
}

export function clearApprovalUiState(approvalIds) {
  const ids = Array.isArray(approvalIds) ? approvalIds : [approvalIds];
  let changed = false;
  ids
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .forEach((approvalId) => {
      if (approvalUiState[approvalId]) {
        delete approvalUiState[approvalId];
        changed = true;
      }
    });
  if (changed) {
    persistApprovalUiState();
  }
}
