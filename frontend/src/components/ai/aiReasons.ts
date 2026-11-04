// Why the backend returned standard guidance instead of an AI answer (FALLBACK `reason`).
const REASONS: Record<string, string> = {
  AI_DISABLED: 'AI is turned off on this server.',
  NOT_CONFIGURED: 'AI is not configured on this server.',
  PRIVATE_REPO: 'AI is not used on private repositories, so no code from this repository was sent to the model.',
  NO_OPEN_FINDINGS: 'There are no open findings to summarise.',
  REFUSED: 'The AI model declined to answer this one.',
  TRUNCATED: 'The AI answer was cut off before it finished.',
  TIMEOUT: 'The AI service took too long to respond.',
  RATE_LIMITED: 'The AI service is busy right now. Try again in a minute.',
  PROVIDER_ERROR: 'The AI service returned an error.',
  INVALID_OUTPUT: "The AI answer failed ARVE's accuracy checks, so it is not shown.",
};

export function fallbackReasonText(reason?: string | null): string {
  return (reason && REASONS[reason]) || 'An AI answer is not available.';
}

// Retrying only helps for temporary provider problems.
export function isRetryableReason(reason?: string | null): boolean {
  return reason === 'TIMEOUT' || reason === 'RATE_LIMITED' || reason === 'PROVIDER_ERROR';
}
