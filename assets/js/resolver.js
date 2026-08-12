// The vault + resolver + ledger. This module is the honesty boundary of the whole
// demo (CLAUDE.md "Model rules"): the registry MUST store only {fingerprint, policyRef,
// registeredAt} — never a policy snapshot, never the image, never the holder's name.
// Resolution is always a live two-step lookup: registry -> policyRef -> vault.
//
// Every mutation is expressed as one of the four API-shaped calls from build-spec.md
// §10, and every call is appended to `apiLog` so the Integration API drawer can show
// the judge exactly what request their last action produced — not a canned example.

import { hamming, MATCH_THRESHOLD } from './phash.js';
import { evaluate } from './policy.js';

const STORAGE_KEY = 'coathook_v1';
const HOLDER = 'Robin Swift';
const POLICY_ID = 'pol_8f21'; // stable across edits — the pointer never changes, only what it points to

function nowISO() { return new Date().toISOString(); }
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10) + ' ' + d.toTimeString().slice(0, 5);
}
function randomRef() { return 'ref_' + Math.random().toString(16).slice(2, 6) + '_random'; }
function randomHolderRef() { return 'psp_anon_' + Math.random().toString(16).slice(2, 6); }

function emptyState() {
  return {
    policy: null,          // the single standing policy object, or null before first save
    registry: [],           // [{ fingerprint, policyRef, registeredAt }] — pointer only, ever
    receipts: [],           // [{ who, at, purpose, result, reference }]
    connectedPlatform: null,
    lastPublished: null,    // { src, name, fpBits } — src is a same-origin sample path only;
                             // user-dropped files are never persisted (quota + privacy)
    apiLog: [],              // [{ method, endpoint, request, response, at }]
    lastCheckByKey: {},      // { "<fpBits>::<purpose>": { decision, aiTraining } } — UI-only
                             // bookkeeping so the Verifier lens can show a before/after
                             // delta when the SAME check is re-run after a policy edit.
                             // Derived entirely from receipts already written; not a
                             // second source of truth for the policy itself.
  };
}

let state = emptyState();
let lastPublishedDataURL = null; // in-memory only, for user-dropped files; never persisted

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...emptyState(), ...parsed };
    }
  } catch (e) {
    console.warn('Coathook: could not load saved state', e);
  }
  return state;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Coathook: localStorage write failed (quota?)', e);
    return false;
  }
}

function logApiCall(method, endpoint, request, response) {
  state.apiLog.push({ method, endpoint, request, response, at: nowISO() });
  if (state.apiLog.length > 20) state.apiLog.shift();
}

export function getState() { return state; }
export function getHolder() { return HOLDER; }
export function getLastApiCall() { return state.apiLog[state.apiLog.length - 1] || null; }

/* ---------------- POST /policy — creator sets/updates the standing policy ---------------- */
export function savePolicy({ useScope, expiry, aiTraining }) {
  const isFirstSave = !state.policy;
  const request = { useScope, expiry, aiTraining };

  state.policy = {
    policyId: POLICY_ID,
    holder: HOLDER,
    holderRef: state.policy?.holderRef || randomHolderRef(),
    license: { useScope, commercial: useScope.includes('commercial') },
    expiry,
    aiTraining,
    updatedAt: nowISO(),
  };

  const response = { ...state.policy };
  logApiCall('POST', '/policy', request, response);
  persist();
  return { policy: state.policy, isFirstSave };
}

/* ---------------- POST /register — platform binds fingerprint -> policyRef at upload ---------------- */
export function registerFingerprint({ fpBits, platform, name, src }) {
  if (!state.policy) throw new Error('no policy set');
  const request = { fingerprint: fpBits, policyRef: state.policy.policyId };

  // de-dupe: if this exact work (within match threshold) is already registered, just
  // refresh its timestamp rather than creating a duplicate pointer.
  const existing = state.registry.find(r => hammingLocal(r.fingerprint, fpBits) <= 10);
  let entry;
  if (existing) {
    existing.registeredAt = nowISO();
    entry = existing;
  } else {
    entry = { fingerprint: fpBits, policyRef: state.policy.policyId, registeredAt: nowISO() };
    state.registry.push(entry);
  }

  // lastPublished is UI convenience state for the quick-verify buttons — NOT part of
  // the resolver/registry model. Only same-origin sample paths get persisted; a
  // user-dropped file's bytes stay in memory only (see fileToLastPublished below).
  state.lastPublished = { src: src || null, name: name || 'untitled', fpBits, platform };

  const response = { ...entry };
  logApiCall('POST', '/register', request, response);
  persist();
  return entry;
}

function hammingLocal(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/** Record a user-dropped file as "last published" for the verifier's quick-check
 *  buttons, keeping the actual image bytes in memory only (never localStorage). */
export function setLastPublishedInMemory(dataURL) {
  lastPublishedDataURL = dataURL;
}
export function getLastPublishedDataURL() {
  return lastPublishedDataURL;
}

/* ---------------- POST /resolve — verifier checks a fingerprint ---------------- */
export function resolve({ fpBits, purpose }) {
  const request = { fingerprint: fpBits, purpose };

  let best = null, bestD = Infinity;
  for (const r of state.registry) {
    const d = hamming(r.fingerprint, fpBits);
    if (d < bestD) { bestD = d; best = r; }
  }

  if (!best || bestD > MATCH_THRESHOLD) {
    const response = {
      decision: 'unregistered',
      reason: 'No policy on record for this work.',
      scope: null, aiTraining: null,
      reference: randomRef(), creator: null,
    };
    logApiCall('POST', '/resolve', request, response);
    persist();
    return { ...response, matchDistance: bestD === Infinity ? null : bestD, matchedEntry: null };
  }

  // The live indirection: look up the CURRENT policy through the stored pointer.
  // best.policyRef always resolves against state.policy — never a cached snapshot.
  const policy = (state.policy && state.policy.policyId === best.policyRef) ? state.policy : null;
  if (!policy) {
    const response = { decision: 'unregistered', reason: 'Registered fingerprint has no resolvable policy.', scope: null, aiTraining: null, reference: randomRef(), creator: null };
    logApiCall('POST', '/resolve', request, response);
    persist();
    return { ...response, matchDistance: bestD, matchedEntry: best };
  }

  const { decision, reason } = evaluate(policy, purpose);
  const response = {
    decision, reason,
    scope: { useScope: policy.license.useScope, expiry: policy.expiry },
    aiTraining: policy.aiTraining,
    reference: randomRef(),
    creator: null,
  };
  logApiCall('POST', '/resolve', request, response);

  // Before/after delta: has this exact fingerprint+purpose check been run before,
  // and did the answer change since then? Proves the pointer is live on ordinary edits.
  const key = `${fpBits}::${purpose}`;
  const previous = state.lastCheckByKey[key] || null;
  state.lastCheckByKey[key] = { decision, aiTraining: policy.aiTraining };
  persist();

  return { ...response, matchDistance: bestD, matchedEntry: best, previousCheck: previous };
}

/* ---------------- POST /receipt — verifier writes back a receipt ---------------- */
export function writeReceipt({ who, purpose, result, reference }) {
  const request = { who, purpose, result, reference };
  const receipt = { who, at: nowISO(), purpose, result, reference };
  state.receipts.push(receipt);
  const response = { ...receipt };
  logApiCall('POST', '/receipt', request, response);
  persist();
  return receipt;
}

export function setConnectedPlatform(name) {
  state.connectedPlatform = name;
  persist();
}

export function resetAll() {
  state = emptyState();
  lastPublishedDataURL = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
}

export { fmtTime, nowISO };
