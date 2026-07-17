// Waits between request starts to hold a global call rate.
export class RateLimiter {
  #intervalMs;
  #nextStartAt = 0;

  // Converts a per-minute rate into a delay between calls.
  constructor(ratePerMinute) {
    if (!Number.isFinite(ratePerMinute) || ratePerMinute <= 0) {
      throw new Error("The SMx collection rate must be greater than zero.");
    }

    this.#intervalMs = 60_000 / ratePerMinute;
  }

  // Reserves the next request slot and waits for it.
  async wait() {
    const now = Date.now();
    const startAt = Math.max(now, this.#nextStartAt);
    const delayMs = startAt - now;

    this.#nextStartAt = startAt + this.#intervalMs;

    if (delayMs > 0) {
      // Sleeps until this request can start.
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
