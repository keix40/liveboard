export interface SyncWatchdogOptions {
  timeoutMs: number;
  maxAttempts: number;
  onRetry: () => void;
  onGiveUp: () => void;
}

/** Detects hung WebSocket sessions (no sync) and retries with capped backoff. */
export function createSyncWatchdog(opts: SyncWatchdogOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const arm = () => {
    clear();
    timer = setTimeout(() => {
      attempts++;
      if (attempts <= opts.maxAttempts) {
        opts.onRetry();
        arm();
      } else {
        opts.onGiveUp();
      }
    }, opts.timeoutMs);
  };

  return {
    armConnecting() {
      arm();
    },
    notifySynced() {
      attempts = 0;
      clear();
    },
    dispose() {
      clear();
    },
    get attempts() {
      return attempts;
    },
  };
}
