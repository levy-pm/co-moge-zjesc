function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 20_000;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("Przekroczono czas oczekiwania na odpowiedz AI.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function postJsonWithRetry({
  url,
  payload,
  headers = {},
  timeoutMs = 20_000,
  maxRetries = 1,
  retryDelayMs = 300,
  retryableStatuses = [429, 500, 502, 503, 504],
}) {
  let response = null;
  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      response = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify(payload),
        },
        timeoutMs,
      );
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt >= maxRetries) {
        throw new Error(lastError || "Blad sieci podczas wywolania AI.");
      }
      await sleep((attempt + 1) * retryDelayMs);
      continue;
    }

    if (response.ok) {
      return response;
    }

    const raw = await response.text();
    lastError = `Blad AI HTTP ${response.status}: ${raw.slice(0, 300)}`;
    const retryable = retryableStatuses.includes(response.status);
    if (!retryable || attempt >= maxRetries) {
      throw new Error(lastError);
    }
    await sleep((attempt + 1) * retryDelayMs);
  }

  throw new Error(lastError || "Blad AI: nieudane wywolanie modelu.");
}

module.exports = {
  fetchWithTimeout,
  postJsonWithRetry,
  sleep,
};
