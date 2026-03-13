function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value) {
  return safeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function truncate(value, maxChars) {
  const text = safeString(value);
  return text.slice(0, Math.max(0, Number(maxChars || 0)));
}

function redactSensitiveText(value, maxChars = 1500) {
  let text = truncate(value, maxChars);
  text = text.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]");
  text = text.replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[telefon]");
  text = text.replace(/\b(?:sk|gsk|AIza)[-_A-Za-z0-9]{10,}\b/g, "[secret]");
  text = text.replace(
    /\b(?:bearer\s+)?[A-Za-z0-9-_]{24,}\.[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\b/gi,
    "[token]",
  );
  text = text.replace(/\b\d{11,16}\b/g, "[number]");
  return text;
}

const BLOCK_PATTERNS = [
  /ignore previous instructions/i,
  /ignore all previous instructions/i,
  /forget (all|previous) instructions/i,
  /reveal system prompt/i,
  /show system prompt/i,
  /show hidden instructions/i,
  /disclose (internal|developer) instructions/i,
  /print.*(env|\.env|secrets?)/i,
  /print.*(prompt|config)/i,
  /list.*(keys|tokens|credentials)/i,
  /(api[_\s-]?key|session[_\s-]?secret|admin[_\s-]?session)/i,
  /(dump|exfiltrat(e|ion)|leak).*(data|secrets?|keys?)/i,
  /zignoruj poprzednie instrukcje/i,
  /zignoruj wszystkie instrukcje/i,
  /(ujawnij|pokaz).*(prompt systemowy|instrukcje deweloperskie)/i,
  /pokaz.*(prompt systemowy|ukryte instrukcje|sekrety|zmienne srodowiskowe)/i,
  /(podaj|pokaz|ujawnij).*(klucz|sekret|token|haslo)/i,
];

const SUSPICIOUS_PATTERNS = [
  /act as developer/i,
  /jailbreak/i,
  /bypass/i,
  /sudo/i,
  /root access/i,
  /wyjdz poza zasady/i,
  /ominiecie ograniczen/i,
  /obejscie ograniczen/i,
  /udawaj administratora/i,
  /wykonaj komende/i,
  /(read|show).*(file|filesystem)/i,
  /(sql|mysql|postgres).*dump/i,
];

function classifyPrompt(prompt) {
  const rawPrompt = safeString(prompt);
  const normalized = normalizeText(rawPrompt);

  const blockReasons = [];
  const suspiciousReasons = [];

  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(rawPrompt) || pattern.test(normalized)) {
      blockReasons.push(pattern.toString());
    }
  }

  if (blockReasons.length > 0) {
    return {
      action: "block",
      reasons: blockReasons,
      redactedPrompt: redactSensitiveText(rawPrompt),
    };
  }

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(rawPrompt) || pattern.test(normalized)) {
      suspiciousReasons.push(pattern.toString());
    }
  }

  if (suspiciousReasons.length > 0) {
    return {
      action: "suspicious",
      reasons: suspiciousReasons,
      redactedPrompt: redactSensitiveText(rawPrompt),
    };
  }

  return {
    action: "allow",
    reasons: [],
    redactedPrompt: redactSensitiveText(rawPrompt),
  };
}

function sanitizeHistory(history, maxItems = 6, maxChars = 700) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string",
    )
    .slice(-maxItems)
    .map((item) => ({
      role: item.role,
      content: redactSensitiveText(item.content, maxChars),
    }))
    .filter((item) => item.content.length > 0);
}

function sanitizeModelOutputText(value, maxChars = 1800) {
  const withoutControlChars = Array.from(truncate(value, maxChars))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return (
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && code !== 127)
      );
    })
    .join("");

  const text = withoutControlChars
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\[([^\]]{1,120})\]\((https?:\/\/[^)\s]{1,300})\)/gi, "$1 ($2)")
    .trim();
  if (!text) return "";
  return text;
}

function safeBlockedChatResponse() {
  return {
    assistantText:
      "Nie moge pomoc z tym zapytaniem. Opisz prosze skladniki i preferencje kulinarne.",
    options: [],
    blocked: true,
  };
}

module.exports = {
  classifyPrompt,
  redactSensitiveText,
  safeBlockedChatResponse,
  sanitizeHistory,
  sanitizeModelOutputText,
};
