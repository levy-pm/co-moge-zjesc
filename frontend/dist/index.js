const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const distPath = __dirname;
const port = Number(process.env.PORT || 3000);
const maxBodySize = 1024 * 1024;

const MIME_TYPES = {
  ".css": "text/css; charset=UTF-8",
  ".html": "text/html; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=UTF-8",
};

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=UTF-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=UTF-8",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeFor(filePath),
      "Content-Length": content.length,
      "Cache-Control": "public, max-age=0",
    });
    res.end(content);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodySize) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      body += chunk.toString("utf8");
    });

    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function buildFallbackRecipe(skladniki) {
  const list = skladniki
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const ingredients = list.length > 0 ? list.join(", ") : skladniki;

  return [
    "Propozycja awaryjna (bez polaczenia z AI):",
    "",
    `Danie: Szybka patelnia ze skladnikow: ${ingredients}`,
    "",
    "Przygotowanie:",
    "1. Pokroj skladniki na male kawalki.",
    "2. Rozgrzej lyzke oleju na patelni i podsmaz twardsze skladniki 3-5 min.",
    "3. Dodaj pozostale skladniki, dopraw sola, pieprzem i ziolami.",
    "4. Podlej 2-3 lyzkami wody, dus 5-8 min, az wszystko bedzie miekkie.",
    "5. Podawaj od razu; mozna dodac jogurt naturalny lub sok z cytryny.",
  ].join("\n");
}

async function askGroqForRecipe(skladniki, apiKey) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "Jestes Szefem Kuchni. Podaj konkretny przepis na podstawie skladnikow.",
        },
        {
          role: "user",
          content: `Mam te skladniki: ${skladniki}. Co moge z nich zrobic? Podaj tytul i opis wykonania.`,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Groq HTTP ${response.status}: ${raw.slice(0, 200)}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

function resolveStaticPath(urlPath) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const requested = path.join(distPath, safePath);
  if (requested.startsWith(distPath) && fs.existsSync(requested) && fs.statSync(requested).isFile()) {
    return requested;
  }

  if (urlPath.startsWith("/assets/")) {
    if (urlPath.endsWith(".js")) {
      return path.join(distPath, "bundle.js");
    }
    if (urlPath.endsWith(".css")) {
      return path.join(distPath, "styles.css");
    }
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const urlObj = new URL(req.url || "/", "http://localhost");
  const pathname = decodeURIComponent(urlObj.pathname || "/");

  if (method === "POST" && (pathname === "/generuj/" || pathname === "/generuj")) {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { przepis: "Bledne dane JSON." });
      return;
    }

    const skladniki = typeof payload.skladniki === "string" ? payload.skladniki.trim() : "";
    if (!skladniki) {
      sendJson(res, 400, { przepis: "Wpisz najpierw jakies skladniki." });
      return;
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      try {
        const answer = await askGroqForRecipe(skladniki, apiKey);
        if (answer) {
          sendJson(res, 200, { przepis: answer });
          return;
        }
      } catch (error) {
        console.error("Groq request failed:", error);
      }
    }

    sendJson(res, 200, { przepis: buildFallbackRecipe(skladniki) });
    return;
  }

  if (method !== "GET" && method !== "HEAD") {
    sendText(res, 405, "Method not allowed");
    return;
  }

  const staticPath = resolveStaticPath(pathname === "/" ? "/index.html" : pathname);
  if (staticPath) {
    sendFile(res, staticPath);
    return;
  }

  sendFile(res, path.join(distPath, "index.html"));
});

server.listen(port, () => {
  console.log(`Frontend serwowany na porcie ${port}`);
});
