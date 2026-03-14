const path = require("path");

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseInlineImageDataUrl(value) {
  const text = safeString(value);
  const match = text.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return {
    mimeType: match[1].toLowerCase(),
    base64Data: match[2],
  };
}

function validateImageName(fileName, allowedExtensions) {
  const name = safeString(fileName);
  if (!name) return true;
  const ext = path.extname(name).toLowerCase();
  if (!ext) return false;
  return allowedExtensions.has(ext);
}

function validateInlineImageDataUrl(value, options = {}) {
  const maxBytes = Number(options.maxBytes || 6 * 1024 * 1024);
  const allowedMimeTypes = options.allowedMimeTypes || new Set();
  const allowedExtensions = options.allowedExtensions || new Set();
  const imageName = options.imageName;

  const parsed = parseInlineImageDataUrl(value);
  if (!parsed) {
    return {
      ok: false,
      status: 400,
      error: "Niepoprawny format zdjecia.",
    };
  }

  if (allowedMimeTypes.size > 0 && !allowedMimeTypes.has(parsed.mimeType)) {
    return {
      ok: false,
      status: 400,
      error: "Nieobslugiwany format zdjecia. Uzyj JPG, PNG, WEBP, HEIC lub HEIF.",
    };
  }

  if (!validateImageName(imageName, allowedExtensions)) {
    return {
      ok: false,
      status: 400,
      error: "Nieobslugiwane rozszerzenie pliku.",
    };
  }

  if (parsed.base64Data.length < 32) {
    return {
      ok: false,
      status: 400,
      error: "Zdjecie jest niepoprawne lub uszkodzone.",
    };
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(parsed.base64Data)) {
    return {
      ok: false,
      status: 400,
      error: "Niepoprawny payload obrazu.",
    };
  }

  if (parsed.base64Data.length % 4 !== 0) {
    return {
      ok: false,
      status: 400,
      error: "Niepoprawny payload obrazu.",
    };
  }

  const approxBytes = Math.floor((parsed.base64Data.length * 3) / 4);
  if (!Number.isFinite(approxBytes) || approxBytes <= 0) {
    return {
      ok: false,
      status: 400,
      error: "Niepoprawny rozmiar obrazu.",
    };
  }
  if (approxBytes > maxBytes) {
    return {
      ok: false,
      status: 400,
      error: "Zdjecie jest zbyt duze. Zrob blizsze ujecie albo mniejsze zdjecie.",
    };
  }

  return {
    ok: true,
    mimeType: parsed.mimeType,
    base64Data: parsed.base64Data,
    bytes: approxBytes,
  };
}

module.exports = {
  validateInlineImageDataUrl,
};
