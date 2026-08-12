// The decision engine — evaluates a live policy object against a requested purpose.
// Per CLAUDE.md: no territory field exists anywhere in this model, and there is no
// `revoked` flag — "revocation" is simply the creator editing useScope/aiTraining/expiry
// on the standing policy, which this function reads fresh every time it's called.

export const PURPOSES = [
  { value: 'web', label: 'Web use' },
  { value: 'commercial-ad', label: 'Commercial ad' },
  { value: 'print', label: 'Print' },
  { value: 'broadcast', label: 'Broadcast' },
  { value: 'ai-training', label: 'AI training' },
];

const PURPOSE_TO_SCOPE = { web: 'web', print: 'print', broadcast: 'broadcast', 'commercial-ad': 'commercial' };

export function purposeLabel(purpose) {
  return PURPOSES.find(p => p.value === purpose)?.label || purpose;
}

/**
 * Evaluate a purpose against a live policy object.
 * @returns {{decision: 'granted'|'denied', reason: string}}
 */
export function evaluate(policy, purpose) {
  // 1. Expiry gates everything, including AI-training requests.
  if (policy.expiry && new Date(policy.expiry) < new Date()) {
    return { decision: 'denied', reason: `Licence expired on ${policy.expiry}.` };
  }

  // 2. AI training is evaluated on its own axis, not against useScope.
  if (purpose === 'ai-training') {
    if (policy.aiTraining === 'allowed') {
      return { decision: 'granted', reason: 'Holder permits AI training on this work.' };
    }
    if (policy.aiTraining === 'if-licensed') {
      return { decision: 'denied', reason: 'AI training is permitted only under a negotiated licence; none is on file for this check.' };
    }
    return { decision: 'denied', reason: "Holder has set this work to don't-train." };
  }

  // 3. Every other purpose checks the standing use-scope (which includes "commercial").
  const scopeKey = PURPOSE_TO_SCOPE[purpose] || purpose;
  const useScope = policy.license.useScope;
  if (!useScope.includes(scopeKey)) {
    const reason = scopeKey === 'commercial'
      ? 'Editorial-only licence; commercial use is not permitted.'
      : `${purposeLabel(purpose)} is outside the licensed scope (${useScope.join(', ') || 'none granted'}).`;
    return { decision: 'denied', reason };
  }

  return { decision: 'granted', reason: `${purposeLabel(purpose)} is within the licensed scope.` };
}

/** Human-readable summary of a policy, for the vault card. */
export function policySummaryLines(policy) {
  const aiClass = policy.aiTraining === 'denied' ? 'deny' : (policy.aiTraining === 'allowed' ? 'grant' : 'cond');
  const aiText = policy.aiTraining === 'denied' ? "don't train" : (policy.aiTraining === 'allowed' ? 'allowed' : 'if licensed');
  return [
    { f: 'uses', v: policy.license.useScope.join(', ') || '—', cls: '' },
    { f: 'expiry', v: policy.expiry || '—', cls: '' },
    { f: 'AI training', v: aiText, cls: aiClass },
  ];
}
