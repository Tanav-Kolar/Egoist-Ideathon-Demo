// Render helpers shared across the app: the vault rail (policy / registry / ledger),
// the API log drawer, and the scoped-response JSON block in the Verifier lens.
import { policySummaryLines, purposeLabel } from './policy.js';
import { prettyHex, toHex, hamming, drawGlyph } from './phash.js';
import { fmtTime } from './resolver.js';

const $ = id => document.getElementById(id);

export function renderVault(state, holder) {
  // holder name is static in the markup; only the "last updated" line is dynamic.
  $('vaultUpdated').textContent = state.policy ? `last updated ${fmtTime(state.policy.updatedAt)}` : '';

  const pv = $('vaultPolicy');
  if (!state.policy) {
    pv.innerHTML = '<div class="pol-empty">No policy set yet.</div>';
  } else {
    pv.innerHTML = policySummaryLines(state.policy).map(l =>
      `<div class="pol-line"><span class="f">${l.f}</span><span class="v ${l.cls}">${escapeHtml(l.v)}</span></div>`
    ).join('');
  }

  const rl = $('regList');
  $('regCount').textContent = state.registry.length;
  if (state.registry.length === 0) {
    rl.innerHTML = '<div class="reg-empty">No works registered.</div>';
  } else {
    rl.innerHTML = state.registry.slice().reverse().map(r =>
      `<div class="reg-row"><span class="fp">⬢ ${prettyHex(toHex(r.fingerprint)).slice(0, 14)}</span><span>${escapeHtml(r.policyRef)} · ${fmtTime(r.registeredAt).slice(11)}</span></div>`
    ).join('');
  }

  const lg = $('ledger');
  $('ledgerCount').textContent = state.receipts.length;
  if (state.receipts.length === 0) {
    lg.innerHTML = '<div class="ledger-empty">No checks yet.</div>';
  } else {
    lg.innerHTML = state.receipts.slice().reverse().map(r => {
      const cls = r.result === 'granted' ? '' : (r.result === 'unregistered' ? 'nomatch' : 'deny');
      const vdCls = r.result === 'granted' ? 'g' : (r.result === 'unregistered' ? 'n' : 'd');
      const vdText = r.result === 'granted' ? 'granted' : (r.result === 'unregistered' ? 'no match' : 'denied');
      return `<div class="receipt ${cls}">
        <div class="rt"><span class="who">${escapeHtml(r.who)}</span><span class="when">${fmtTime(r.at)}</span></div>
        <div class="what">use: ${escapeHtml(purposeLabel(r.purpose))}</div>
        <span class="vd ${vdCls}">${vdText}</span>
      </div>`;
    }).join('');
  }
}

export function renderApiLog(state) {
  const el = $('apiLastCall');
  const last = state.apiLog[state.apiLog.length - 1];
  if (!last) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="api-call">
    <div>last call: <span class="ep">${last.method} ${last.endpoint}</span> · ${fmtTime(last.at).slice(11)}</div>
    <pre>${escapeHtml(JSON.stringify(last.request, null, 2))}\n↓\n${escapeHtml(JSON.stringify(last.response, null, 2))}</pre>
  </div>`;
}

/** Renders the syntax-colored §6 scoped response block. */
export function renderScopedReturn(response) {
  const c = s => `<span class="c">${s}</span>`;
  const k = s => `<span class="k">${s}</span>`;
  const s_ = s => `<span class="s">${s}</span>`;
  const r_ = s => `<span class="r">${s}</span>`;

  const decisionSpan = response.decision === 'granted' ? s_(`"${response.decision}"`) : r_(`"${response.decision}"`);
  let out = `${c('// resolver → verifier · scoped response')}\n`;
  out += `${k('decision:')} ${decisionSpan}\n`;
  if (response.scope) {
    out += `${k('scope:')}    ${s_(response.scope.useScope.join(', '))}\n`;
    out += `${k('expiry:')}   ${s_(response.scope.expiry)}\n`;
    out += `${k('training:')} ${response.aiTraining === 'denied' ? r_(`"${response.aiTraining}"`) : s_(`"${response.aiTraining}"`)}\n`;
  }
  out += `${k('creator:')}  ${r_('null')}  ${c('// identity withheld')}\n`;
  out += `${k('reference:')} ${s_(`"${response.reference}"`)}`;
  return out;
}

/**
 * Renders two fingerprint glyphs side by side in `container`, with an arrow between
 * them showing the Hamming distance — the differing bits are lit in --rust on BOTH
 * glyphs. This is the money-beat pixel: proof, in the open, that a visibly different
 * file still resolves to (near-)the same fingerprint.
 */
export function renderGlyphCompare(container, bitsChecked, bitsRegistered, labelChecked, labelRegistered) {
  const d = hamming(bitsChecked, bitsRegistered);
  container.style.display = 'flex';
  container.innerHTML = `
    <div class="g"><canvas class="glyphA"></canvas><div class="cap">${escapeHtml(labelChecked)}</div></div>
    <div class="arrow"><b>${d}/64</b>bits differ</div>
    <div class="g"><canvas class="glyphB"></canvas><div class="cap">${escapeHtml(labelRegistered)}</div></div>
  `;
  drawGlyph(container.querySelector('.glyphA'), bitsChecked, { diffAgainst: bitsRegistered });
  drawGlyph(container.querySelector('.glyphB'), bitsRegistered, { diffAgainst: bitsChecked });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

let toastTimer;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
