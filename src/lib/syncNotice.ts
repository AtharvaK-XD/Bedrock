export const SYNC_NOTICE_EVENT = 'bedrock_sync_notice';

/** Friendly text for the "you hit a save limit" answers (HTTP 409) from /api/prompts and /api/workflows. */
export async function describeSaveLimit(res: Response): Promise<string | null> {
  if (res.status !== 409) return null;
  try {
    const body = await res.clone().json();
    if (body?.code === 'PROMPT_LIMIT_REACHED') {
      return "You've reached the cloud limit for saved prompts. This one is saved on this device only. Delete some old prompts to back up new ones.";
    }
    if (body?.code === 'WORKFLOW_LIMIT_REACHED') {
      return "You've reached the cloud limit for saved workflows. This one is saved on this device only. Delete some old workflows to back up new ones.";
    }
  } catch {
    // body was not JSON
  }
  return null;
}

/**
 * Tell the UI that a cloud save/load failed so the user is not left guessing.
 * Anything saved locally is still on the device, so messages should say that.
 */
export function reportSyncProblem(message: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string>(SYNC_NOTICE_EVENT, { detail: message }));
}
