// App boot + all interactive wiring: lens routing, Creator/Platform/Verifier handlers,
// reset. Rendering helpers live in lenses.js; the model lives in resolver.js/policy.js;
// the fingerprint lives in phash.js. See CLAUDE.md for the rules this must not break.
import { phash, toHex, prettyHex, drawGlyph, loadImageFromURL, fileToDataURL, MATCH_THRESHOLD } from './phash.js';
import * as resolver from './resolver.js';
import { renderVault, renderApiLog, renderScopedReturn, renderGlyphCompare, toast } from './lenses.js';

const $ = id => document.getElementById(id);

const SAMPLE_META = {
  'studio-rig':   { orig: 'assets/samples/studio-rig.jpg',   copy: 'assets/samples/IMG_4471_repost.jpg',  copyName: 'IMG_4471_repost.jpg' },
  'neon-signage': { orig: 'assets/samples/neon-signage.jpg', copy: 'assets/samples/signage_final_v2.jpg', copyName: 'signage_final_v2.jpg' },
  'ink-bloom':    { orig: 'assets/samples/ink-bloom.jpg',    copy: 'assets/samples/bloom_export.jpg',     copyName: 'bloom_export.jpg' },
};
const DECOY_SRC = 'assets/samples/decoy-unregistered.jpg';

/* ---------------- lens switching ---------------- */
function switchLens(which) {
  ['creator', 'platform', 'verifier'].forEach(l => {
    $('lens-' + l).setAttribute('aria-pressed', String(l === which));
    $('panel-' + l).classList.toggle('hidden', l !== which);
  });
}
$('lens-creator').onclick = () => switchLens('creator');
$('lens-platform').onclick = () => switchLens('platform');
$('lens-verifier').onclick = () => switchLens('verifier');

function refresh() {
  renderVault(resolver.getState(), resolver.getHolder());
  renderApiLog(resolver.getState());
}

/* ---------------- Creator lens ---------------- */
$('useChips').addEventListener('click', e => {
  const c = e.target.closest('.chip');
  if (!c) return;
  c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true');
});
$('aiToggle').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  [...$('aiToggle').children].forEach(x => x.setAttribute('aria-pressed', 'false'));
  b.setAttribute('aria-pressed', 'true');
});

$('savePolicy').onclick = () => {
  const useScope = [...$('useChips').querySelectorAll('.chip[aria-pressed="true"]')].map(c => c.dataset.use);
  const aiTraining = $('aiToggle').querySelector('button[aria-pressed="true"]').dataset.ai;
  const expiry = $('expiry').value;

  const hadPolicyBefore = !!resolver.getState().policy;
  resolver.savePolicy({ useScope, expiry, aiTraining });
  refresh();

  $('creatorHint').textContent = hadPolicyBefore && resolver.getState().registry.length > 0
    ? '✓ Policy updated in the vault — every already-registered work now resolves to these new terms on its next check.'
    : (hadPolicyBefore
      ? '✓ Policy updated in the vault.'
      : '✓ Saved to vault. Now switch to Role ② to publish a work.');
  toast('Policy saved to Passport vault');
};

/* ---------------- Platform lens (multi-select connectors) ---------------- */
$('platforms').addEventListener('click', e => {
  const p = e.target.closest('.plat');
  if (!p) return;
  const nowPressed = p.getAttribute('aria-pressed') !== 'true';
  p.setAttribute('aria-pressed', String(nowPressed));
  const selected = resolver.toggleConnectedPlatform(p.dataset.plat);
  $('platformHint').textContent = selected.length
    ? `Connected to ${selected.join(', ')}. Now upload a work — one upload publishes to all ${selected.length}.`
    : 'Select at least one platform, then upload a work.';
});

async function publishFromURL(url, name, sampleSrcForPersistence) {
  const img = await loadImageFromURL(url);
  await publishImage(img, url, name, sampleSrcForPersistence);
}

async function publishImage(img, previewURL, name, sampleSrcForPersistence) {
  if (!resolver.getState().policy) { toast('Set a policy first (Role ①)'); switchLens('creator'); return; }
  const platforms = resolver.getState().connectedPlatforms;
  if (!platforms.length) { toast('Connect at least one platform first'); return; }

  const bits = phash(img);
  const hex = toHex(bits);

  resolver.registerFingerprint({
    fpBits: bits,
    platforms,
    name,
    src: sampleSrcForPersistence || null, // only sample paths persist; user files stay in-memory
  });
  if (!sampleSrcForPersistence) resolver.setLastPublishedInMemory(previewURL);

  $('pubPreview').src = previewURL;
  $('pubCap').textContent = name;
  $('pubHash').textContent = prettyHex(hex);
  drawGlyph($('pubGlyph'), bits);
  $('pubFp').classList.add('show');
  $('pubStatus').textContent = 'registered → ' + resolver.getState().policy.policyId;
  $('pubPlatforms').innerHTML = platforms.length > 1
    ? `Published simultaneously to <b>${platforms.length} platforms</b>: ${platforms.join(', ')} — same fingerprint, same pointer, everywhere.`
    : `Published to <b>${platforms[0]}</b>.`;

  $('verSameBtn').disabled = false;
  $('verModBtn').disabled = false;

  refresh();
  $('platformHint').textContent = platforms.length > 1
    ? `✓ Fingerprinted once, registered across all ${platforms.length} connected platforms. Switch to Role ③ to check a copy.`
    : '✓ Fingerprinted and bound to your policy. Switch to Role ③ to check a copy.';
  toast('Work fingerprinted & registered');
}

wireDrop($('pubDrop'), async file => {
  const url = await fileToDataURL(file);
  const img = await loadImageFromURL(url);
  await publishImage(img, url, file.name, null);
});

document.querySelectorAll('.sample-thumb').forEach(el => {
  const key = el.dataset.sample;
  const meta = SAMPLE_META[key];
  const activate = () => publishFromURL(meta.orig, key + '.jpg', meta.orig);
  el.addEventListener('click', activate);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
});

/* ---------------- Verifier lens ---------------- */
$('checkUse').addEventListener('click', e => {
  const c = e.target.closest('.chip');
  if (!c) return;
  [...$('checkUse').children].forEach(x => x.setAttribute('aria-pressed', 'false'));
  c.setAttribute('aria-pressed', 'true');
});

function currentPurpose() {
  return $('checkUse').querySelector('.chip[aria-pressed="true"]').dataset.cuse;
}
function currentIdentity() {
  return $('verifierIdentity').value;
}

async function verifyImage(img, name) {
  const purpose = currentPurpose();
  const who = currentIdentity();
  const bits = phash(img);

  const result = resolver.resolve({ fpBits: bits, purpose });
  const card = $('verdict');
  card.classList.remove('allow', 'deny', 'nomatch');
  card.classList.add('show');

  $('vGlyphs').style.display = 'none';
  $('vGlyphs').innerHTML = '';
  $('vDelta').style.display = 'none';
  $('vWithheld').style.display = 'none';

  if (result.decision === 'unregistered') {
    card.classList.add('nomatch');
    $('vBadge').textContent = 'no match';
    $('vTitle').textContent = 'Not in the registry';
    const distText = result.matchDistance == null ? 'no works registered yet' : `nearest registered work is ${result.matchDistance} bits away — above the ${MATCH_THRESHOLD}-bit match threshold`;
    $('vReason').textContent = `This work has no registered policy (${distText}).`;
    $('vScoped').textContent = '';
    $('vMeta').textContent = 'checked fingerprint ⬢ ' + prettyHex(toHex(bits)).slice(0, 20);

    const receipt = resolver.writeReceipt({ who, purpose, result: 'unregistered', reference: result.reference });
    refresh();
    $('verifierHint').textContent = 'No policy found for this image — try a sample or its recompressed copy.';
    return;
  }

  const granted = result.decision === 'granted';
  card.classList.add(granted ? 'allow' : 'deny');
  $('vBadge').textContent = granted ? 'permitted' : 'not permitted';
  $('vTitle').textContent = granted ? 'Use is permitted' : 'Use is not permitted';
  $('vReason').textContent = result.reason;
  $('vScoped').innerHTML = renderScopedReturn(result);
  $('vWithheld').style.display = 'inline-flex';
  if (result.matchedEntry) {
    renderGlyphCompare($('vGlyphs'), bits, result.matchedEntry.fingerprint, name || 'checked copy', 'registered fingerprint');
  }

  if (result.previousCheck && result.previousCheck.decision !== result.decision) {
    $('vDelta').style.display = 'block';
    $('vDelta').textContent =
      `Live change detected — this same check previously returned "${result.previousCheck.decision}", now returns "${result.decision}". Same fingerprint, different answer: the terms are read fresh from the vault every time.`;
  }

  $('vMeta').textContent = `matched fingerprint at ${result.matchDistance}/64 bits ` +
    (result.matchDistance === 0 ? '(identical file)' : '(a different copy — still matched on content)');

  const receipt = resolver.writeReceipt({ who, purpose, result: result.decision, reference: result.reference });
  refresh();
  $('verifierHint').textContent = result.matchDistance > 0
    ? '✓ A different copy still resolved — the licence travelled with the work, not the file.'
    : '✓ Resolved to the live policy. Try a recompressed copy, or change the policy in Role ① and re-check.';
}

wireDrop($('verDrop'), async file => {
  const url = await fileToDataURL(file);
  const img = await loadImageFromURL(url);
  await verifyImage(img, file.name);
});

$('verSameBtn').onclick = async () => {
  const lp = resolver.getState().lastPublished;
  if (!lp) { toast('Publish a work first'); return; }
  const url = lp.src || resolver.getLastPublishedDataURL();
  if (!url) { toast('That upload was not kept in memory after reload — publish again'); return; }
  const img = await loadImageFromURL(url);
  await verifyImage(img, lp.name + ' (exact)');
};

$('verModBtn').onclick = async () => {
  const lp = resolver.getState().lastPublished;
  if (!lp) { toast('Publish a work first'); return; }
  const meta = lp.src ? Object.values(SAMPLE_META).find(m => m.orig === lp.src) : null;
  if (meta) {
    const img = await loadImageFromURL(meta.copy);
    await verifyImage(img, meta.copyName);
    return;
  }
  // user-dropped file: derive a recompressed copy client-side (in memory, not persisted)
  const url = resolver.getLastPublishedDataURL();
  if (!url) { toast('That upload was not kept in memory after reload — publish again'); return; }
  const modURL = await recompress(url);
  const img = await loadImageFromURL(modURL);
  await verifyImage(img, (lp.name || 'upload').replace(/\.\w+$/, '') + '_recompressed.jpg');
};

$('verDecoyBtn').onclick = async () => {
  const img = await loadImageFromURL(DECOY_SRC);
  await verifyImage(img, 'decoy-unregistered.jpg');
};

async function recompress(dataURL) {
  const img = await loadImageFromURL(dataURL);
  const c = document.createElement('canvas');
  c.width = Math.max(8, Math.round(img.width * 0.6));
  c.height = Math.max(8, Math.round(img.height * 0.6));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.35);
}

/* ---------------- generic dropzone ---------------- */
function wireDrop(zone, onFile) {
  const open = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => { if (inp.files[0]) onFile(inp.files[0]); };
    inp.click();
  };
  zone.onclick = open;
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  zone.ondragover = e => { e.preventDefault(); zone.classList.add('drag'); };
  zone.ondragleave = () => zone.classList.remove('drag');
  zone.ondrop = e => {
    e.preventDefault(); zone.classList.remove('drag');
    const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
    if (f) onFile(f);
  };
}

/* ---------------- reset ---------------- */
$('resetDemo').onclick = () => {
  if (!confirm('Reset the demo? This clears the vault, registry, and receipt ledger.')) return;
  resolver.resetAll();
  location.reload();
};

/* ---------------- init ---------------- */
resolver.load();
if (resolver.getState().lastPublished) {
  $('verSameBtn').disabled = false;
  $('verModBtn').disabled = false;
}
// restore which platform connectors were toggled on before a reload
const savedPlatforms = resolver.getState().connectedPlatforms;
$('platforms').querySelectorAll('.plat').forEach(btn => {
  btn.setAttribute('aria-pressed', String(savedPlatforms.includes(btn.dataset.plat)));
});
refresh();
