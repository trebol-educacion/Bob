/**
 * Result of audio validation before passing it to an LLM/eval pipeline.
 * Centralizes the "no scoring without audio" rule from Jira ticket.
 */
export interface AudioGuardResult {
  ok: boolean;
  reason?: 'empty_blob' | 'too_small' | 'too_short';
  blob?: Blob;
  durationSeconds?: number;
}

/**
 * Validates that a recorded audio blob has actual speech content before
 * spending tokens on transcription/evaluation. Returns ok=false with
 * a localizable reason if the blob is missing, too small (< 512 bytes)
 * or too short (< 0.3 seconds by default).
 *
 * Activities should call this BEFORE any Gemini transcribe call and
 * surface the failure to the user with a "try again" affordance.
 */
export function validateRecordedAudio(opts: {
  blob: Blob | null | undefined;
  durationSeconds: number;
  minBytes?: number;
  minDurationSeconds?: number;
}): AudioGuardResult {
  const { blob, durationSeconds, minBytes = 512, minDurationSeconds = 0.3 } = opts;

  if (!blob) {
    return { ok: false, reason: 'empty_blob' };
  }

  if (blob.size < minBytes) {
    return { ok: false, reason: 'too_small' };
  }

  if (durationSeconds < minDurationSeconds) {
    return { ok: false, reason: 'too_short' };
  }

  return { ok: true, blob, durationSeconds };
}
