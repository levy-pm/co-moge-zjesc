import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import "./index.css";

const API_BASE = "/backend";
const ADMIN_PAGE_SIZE = 10;
const DEFAULT_RECIPE_CATEGORY = "Posilek";
const RECIPE_CATEGORY_OPTIONS = ["Posilek", "Deser"];
const STARTER_PROMPTS = [
  "Mam kurczaka, ryż i brokuła. Co z tego zrobić?",
  "Szukam czegoś szybkiego do 20 minut.",
  "Chcę coś lekkiego i wysokobiałkowego.",
  "Mam ochotę na zupę krem.",
];

function routePath() {
  const query = new URLSearchParams(window.location.search);
  const tryb = query.get("tryb");
  if (tryb === "zaloguj") return "/zaloguj";

  const raw = window.location.pathname || "/";
  const normalized = raw.replace(/\/+$/, "");
  return normalized || "/";
}

function recipeFromOption(option) {
  return {
    id: option.recipe_id ?? null,
    nazwa: option.title || "Danie",
    czas: normalizePreparationTimeLabel(option.time),
    skladniki: option.ingredients || "Brak danych",
    opis: option.instructions || "Brak danych",
    tagi: "",
    link_filmu: option.link_filmu || "",
    link_strony: option.link_strony || "",
  };
}

function asString(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return "";
}

function normalizePreparationTimeLabel(value) {
  const raw = asString(value).trim();
  if (!raw) return "Brak danych";

  const compact = raw.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/g, "");
  const normalized = compact.toLowerCase();

  const plainRange = normalized.match(/^(\d{1,4})\s*-\s*(\d{1,4})$/);
  if (plainRange) return `${plainRange[1]}-${plainRange[2]} minut`;

  const plainSingle = normalized.match(/^(\d{1,4})$/);
  if (plainSingle) return `${plainSingle[1]} minut`;

  const minuteRange = normalized.match(
    /^(\d{1,4})\s*-\s*(\d{1,4})\s*(m|min\.?|mins?|minut|minuty|minute|minutes)$/,
  );
  if (minuteRange) return `${minuteRange[1]}-${minuteRange[2]} minut`;

  const minuteSingle = normalized.match(
    /^(\d{1,4})\s*(m|min\.?|mins?|minut|minuty|minute|minutes)$/,
  );
  if (minuteSingle) return `${minuteSingle[1]} minut`;

  const hourRange = normalized.match(
    /^(\d{1,3})\s*-\s*(\d{1,3})\s*(h|hr|hrs|godz|godzina|godziny|godz\.)$/,
  );
  if (hourRange) {
    const from = Number.parseInt(hourRange[1], 10) * 60;
    const to = Number.parseInt(hourRange[2], 10) * 60;
    return `${from}-${to} minut`;
  }

  const hourSingle = normalized.match(
    /^(\d{1,3})\s*(h|hr|hrs|godz|godzina|godziny|godz\.)$/,
  );
  if (hourSingle) {
    const minutes = Number.parseInt(hourSingle[1], 10) * 60;
    return `${minutes} minut`;
  }

  return compact;
}

function normalizeRecipeCategory(value) {
  const raw = asString(value).trim().toLowerCase();
  if (raw === "deser") return "Deser";
  return "Posilek";
}

function normalizeTagKey(value) {
  return asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseTags(value) {
  return asString(value)
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueTags(tags) {
  const seen = new Set();
  const result = [];
  for (const tag of tags) {
    const key = normalizeTagKey(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(tag.trim());
  }
  return result;
}

function tagsToString(tags) {
  return uniqueTags(tags).join(", ");
}

function splitTextRows(value) {
  return asString(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripListPrefix(value) {
  return value
    .replace(/^[-*•\u2022]+\s*/, "")
    .replace(/^\d+\s*[.)-]\s*/, "")
    .replace(/^krok\s*\d+\s*[:.)-]?\s*/i, "")
    .trim();
}

function ingredientItemsFromText(value) {
  const rows = splitTextRows(value).map(stripListPrefix).filter(Boolean);
  if (rows.length > 1) return rows;

  const single = rows[0] || asString(value).trim();
  if (!single || /^brak danych$/i.test(single)) return [];

  const splitByCommaOrSemicolon = single
    .split(/\s*,\s+|\s*;\s*/)
    .map(stripListPrefix)
    .filter(Boolean);

  return splitByCommaOrSemicolon.length > 1 ? splitByCommaOrSemicolon : [single];
}

function explicitKrokSteps(value) {
  const text = asString(value)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();

  if (!/krok\s*\d+/i.test(text)) return [];

  return text
    .split(/(?=krok\s*\d+\s*[:.)-]?)/gi)
    .map((chunk) => chunk.trim())
    .filter((chunk) => /^krok\s*\d+/i.test(chunk))
    .map((chunk) => chunk.replace(/^krok\s*\d+\s*[:.)-]?\s*/i, "").trim())
    .map(stripListPrefix)
    .filter(Boolean);
}

function instructionStepsFromText(value) {
  const fromKrokMarkers = explicitKrokSteps(value);
  if (fromKrokMarkers.length > 0) return fromKrokMarkers;

  const rows = splitTextRows(value).map(stripListPrefix).filter(Boolean);
  if (rows.length > 1) return rows;

  const single = rows[0] || asString(value).trim();
  if (!single || /^brak danych$/i.test(single)) return [];

  const sentenceSplit = single
    .split(/(?:\s*[.;!?]\s+)|(?:\s+->\s+)/)
    .map(stripListPrefix)
    .filter(Boolean);

  return sentenceSplit.length > 0 ? sentenceSplit : [single];
}

function toExternalUrl(value) {
  const text = asString(value).trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

function parseApiError(status, body) {
  if (typeof body === "string" && body.trim()) {
    const text = body.trim();
    if (text.startsWith("<!DOCTYPE html>") || text.startsWith("<html")) {
      return `Błąd HTTP ${status}. Serwer zwrócił stronę HTML zamiast API.`;
    }
    return text.slice(0, 260);
  }

  if (body && typeof body === "object") {
    const message = body.error || body.message || body.przepis;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return `Błąd HTTP ${status}`;
}

async function apiRequest(path, options = {}) {
  const method = options.method || "GET";
  const headers = { ...(options.headers || {}) };
  let body;

  if (Object.prototype.hasOwnProperty.call(options, "body")) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body,
    credentials: "include",
  });

  const contentType = response.headers.get("content-type") || "";
  let payload;

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    throw new Error(parseApiError(response.status, payload));
  }

  return payload;
}

function ChatBubble({ role, content }) {
  const icon = role === "user" ? "🍴" : "🧑‍🍳";
  const label = role === "user" ? "Użytkownik" : "Asystent";

  return (
    <article className={`chat-row ${role}`}>
      <div className="chat-avatar" aria-label={label} title={label}>
        <span className="chat-avatar-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="chat-bubble">{content}</div>
    </article>
  );
}

function TypingBubble() {
  return (
    <article className="chat-row assistant">
      <div className="chat-avatar" aria-label="Asystent" title="Asystent">
        <span className="chat-avatar-icon" aria-hidden="true">
          🧑‍🍳
        </span>
      </div>
      <div className="chat-bubble typing">
        <span />
        <span />
        <span />
      </div>
    </article>
  );
}

function StarterPrompts({ loading, onPick }) {
  return (
    <div className="starter-wrap">
      <p>Na start możesz kliknąć jedną z propozycji:</p>
      <div className="starter-grid">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="starter-chip"
            disabled={loading}
            onClick={() => onPick(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function OptionCard({ option, index, onChoose }) {
  const ingredientsPreview = asString(option.ingredients);
  const timeLabel = normalizePreparationTimeLabel(option.time);

  return (
    <article className="choice-card">
      <div className="choice-top">
        <div className="choice-meta">
          <span className="choice-pill">Propozycja {index + 1}</span>
          <span className="choice-time">Czas: {timeLabel}</span>
        </div>
        <h4>{option.title || "Danie"}</h4>
        <p className="choice-why">{option.why || "Dopasowane do Twojego zapytania."}</p>
      </div>

      <div className="choice-bottom">
        <p className="choice-label">Lista składników</p>
        <p className="choice-ingredients">{ingredientsPreview || "Brak danych"}</p>
        <button type="button" className="btn ghost" onClick={() => onChoose(option, index)}>
          Wybieram to danie
        </button>
      </div>
    </article>
  );
}

function TagsEditor({
  idPrefix,
  label,
  tags,
  inputValue,
  onInputChange,
  onInputKeyDown,
  onAddTag,
  onRemoveTag,
  suggestions,
  disabled,
}) {
  const datalistId = `${idPrefix}-suggestions`;
  const inputId = `${idPrefix}-input`;

  return (
    <div className="admin-field full">
      <label htmlFor={inputId}>{label}</label>
      <div className="tag-editor">
        <div className="tag-chip-wrap">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <span key={`${idPrefix}-${tag}`} className="tag-chip">
                <span>{tag}</span>
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={() => onRemoveTag(tag)}
                  disabled={disabled}
                  aria-label={`Usuń tag ${tag}`}
                >
                  ×
                </button>
              </span>
            ))
          ) : (
            <p className="tag-chip-empty">Brak tagów.</p>
          )}
        </div>
        <div className="tag-editor-row">
          <input
            id={inputId}
            type="text"
            list={datalistId}
            placeholder="Wpisz tag i naciśnij Enter"
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            disabled={disabled}
          />
          <button type="button" className="btn ghost" onClick={onAddTag} disabled={disabled}>
            Dodaj tag
          </button>
        </div>
        <datalist id={datalistId}>
          {suggestions.map((tag) => (
            <option key={`${datalistId}-${tag}`} value={tag} />
          ))}
        </datalist>
        <p className="small-note">Enter dodaje tag. Duplikaty nie są dodawane.</p>
      </div>
    </div>
  );
}

function UserChatPage() {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [pendingOptions, setPendingOptions] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [excludedRecipeIds, setExcludedRecipeIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState("");
  const [optionsRound, setOptionsRound] = useState(0);

  const chatRef = useRef(null);
  const composerRef = useRef(null);

  const latestUserText = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") {
        return messages[index].content;
      }
    }
    return "";
  }, [messages]);

  useEffect(() => {
    const node = chatRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, pendingOptions, selectedRecipe, loading]);

  useEffect(() => {
    const input = composerRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  }, [prompt]);

  const sendPrompt = async (rawPrompt) => {
    const trimmed = rawPrompt.trim();
    if (!trimmed || loading) return;

    const normalizePrompt = (value) => value.trim().toLowerCase();
    const shouldKeepExcluded =
      normalizePrompt(trimmed) !== "" &&
      normalizePrompt(trimmed) === normalizePrompt(latestUserText);
    const excludedForRequest = shouldKeepExcluded ? excludedRecipeIds : [];

    if (!shouldKeepExcluded && excludedRecipeIds.length > 0) {
      setExcludedRecipeIds([]);
    }

    const userMessage = { role: "user", content: trimmed };
    const nextHistory = [...messages, userMessage].slice(-6);

    setFlash("");
    setPrompt("");
    setLoading(true);
    setSelectedOption(null);
    setSelectedRecipe(null);
    setPendingOptions([]);
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await apiRequest("/chat/options", {
        method: "POST",
        body: {
          prompt: trimmed,
          history: nextHistory,
          excludedRecipeIds: excludedForRequest,
        },
      });

      const assistantText = asString(response?.assistantText) || "Oto co przygotowałem:";
      const options = Array.isArray(response?.options) ? response.options.slice(0, 2) : [];

      setMessages((prev) => [...prev, { role: "assistant", content: assistantText }]);
      setPendingOptions(options);
      setOptionsRound((value) => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Błąd połączenia z serwerem.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Szef kuchni upuścił talerz: ${message}`,
        },
      ]);
      setPendingOptions([]);
      setFlash(message);
    } finally {
      setLoading(false);
    }
  };

  const submitPrompt = (event) => {
    event.preventDefault();
    void sendPrompt(prompt);
  };

  const handlePromptKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendPrompt(prompt);
    }
  };

  const sendFeedback = async (payload) => {
    try {
      await apiRequest("/chat/feedback", {
        method: "POST",
        body: payload,
      });
    } catch {
      // Brak blokowania UI
    }
  };

  const openSelectedOption = async (option, chosenIndex) => {
    setSelectedOption(option);
    setPendingOptions([]);

    void sendFeedback({
      action: "accepted",
      userText: latestUserText,
      option1: pendingOptions[0] || null,
      option2: pendingOptions[1] || null,
      chosenIndex: chosenIndex + 1,
    });

    const recipeId = Number.isInteger(option?.recipe_id) ? option.recipe_id : null;
    if (recipeId !== null) {
      try {
        const response = await apiRequest(`/public/recipes/${recipeId}`);
        if (response?.recipe) {
          setSelectedRecipe(response.recipe);
          return;
        }
      } catch {
        // Fallback ponizej
      }
    }

    setSelectedRecipe(recipeFromOption(option || {}));
  };

  const rejectOptions = async () => {
    const ids = pendingOptions
      .map((option) => (Number.isInteger(option?.recipe_id) ? option.recipe_id : null))
      .filter((value) => value !== null);

    if (ids.length > 0) {
      setExcludedRecipeIds((prev) => Array.from(new Set([...prev, ...ids])));
    }

    await sendFeedback({
      action: "rejected",
      userText: latestUserText,
      option1: pendingOptions[0] || null,
      option2: pendingOptions[1] || null,
    });

    setPendingOptions([]);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "Zrozumiałem. Spróbujmy czegoś innego. Wolisz coś lżejszego czy inny rodzaj kuchni?",
      },
    ]);
  };

  const backToSearch = () => {
    setSelectedOption(null);
    setSelectedRecipe(null);
    setPendingOptions([]);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Jasne! Szukamy dalej. Na co masz ochotę?" },
    ]);
  };

  const hasMessages = messages.length > 0;
  const selectedSource = "Propozycja";
  const ingredientItems = ingredientItemsFromText(selectedRecipe?.skladniki);
  const preparationSteps = instructionStepsFromText(selectedRecipe?.opis);
  const filmUrl = toExternalUrl(selectedRecipe?.link_filmu);

  return (
    <main className="user-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <section className="home-card reveal">

        <header className="hero-copy">
          <div className="hero-text">
            <h1>Co mogę zjeść?</h1>
            <p>
              Podaj składniki, nastrój albo pomysł, poczekaj na propozycje, wybierz i zacznij gotować. Koniec długiego szukania pomysłu co możesz zjeść!
            </p>
          </div>
          <aside className="hero-visual" aria-label="Brokuł, warzywa i gorące danie">
            <div className="hero-visual-surface" aria-hidden="true">
              <span className="hero-steam hero-steam-a" />
              <span className="hero-steam hero-steam-b" />
              <span className="hero-steam hero-steam-c" />
              <span className="hero-food hero-food-bowl">🍲</span>
              <span className="hero-food hero-food-broccoli">🥦</span>
              <span className="hero-food hero-food-carrot">🥕</span>
              <span className="hero-food hero-food-tomato">🍅</span>
            </div>
          </aside>
        </header>

        {flash ? <div className="alert error">{flash}</div> : null}

        {selectedRecipe ? (
          <section className="recipe-stage">
            <div className="recipe-stage-head">
              <div>
                <p className="recipe-source">{selectedSource}</p>
                <h2>{selectedRecipe.nazwa || "Danie"}</h2>
                <p className="recipe-time">
                  Czas przygotowania:{" "}
                  <strong>{normalizePreparationTimeLabel(selectedRecipe.czas)}</strong>
                </p>
              </div>
              <button type="button" className="btn" onClick={backToSearch}>
                Wróć do szukania
              </button>
            </div>

            <div className="recipe-detail-flow">
              <article className="recipe-block">
                <h3>Składniki</h3>
                {ingredientItems.length > 0 ? (
                  <ul className="recipe-list">
                    {ingredientItems.map((item, index) => (
                      <li key={`ingredient-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Brak danych</p>
                )}
              </article>
              <article className="recipe-block">
                <h3>Przygotowanie</h3>
                {preparationSteps.length > 0 ? (
                  <ol className="recipe-steps">
                    {preparationSteps.map((step, index) => (
                      <li key={`step-${index}`}>
                        <span className="recipe-step-label">Krok {index + 1}</span>
                        <p>{step}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>Brak danych</p>
                )}
                {filmUrl ? (
                  <div className="recipe-film-link-wrap">
                    <a
                      href={filmUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn ghost inline-link recipe-film-cta"
                    >
                      Przejdź do filmu
                    </a>
                  </div>
                ) : null}
              </article>
              {selectedRecipe.link_strony ? (
                <article className="recipe-block">
                  <h3>Link do strony</h3>
                  <a
                    href={toExternalUrl(selectedRecipe.link_strony)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="recipe-link"
                  >
                    {selectedRecipe.link_strony}
                  </a>
                </article>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="chat-card">
            <div className="chat-scroll" ref={chatRef}>
              {messages.map((message, index) => (
                <ChatBubble key={`${message.role}-${index}`} role={message.role} content={message.content} />
              ))}

              {loading ? <TypingBubble /> : null}

              {!hasMessages ? (
                <div className="empty-state">
                  <h3>Powiedz, na co masz ochotę</h3>
                  <p>
                    Gotowy na dwie pyszne propozycje? Zaakceptuj lub odrzuć i znajdź idealne danie dla siebie!
                  </p>
                  <StarterPrompts loading={loading} onPick={sendPrompt} />
                </div>
              ) : null}

              {pendingOptions.length > 0 ? (
                <section className="choices-wrap">
                  <div className="choices-head">
                    <h3>Co wybierasz?</h3>
                    <span>Runda {optionsRound}</span>
                  </div>
                  <div className={`choices-grid ${pendingOptions.length === 1 ? "single" : ""}`}>
                    {pendingOptions.map((option, index) => (
                      <OptionCard
                        key={`option-${optionsRound}-${index}`}
                        option={option}
                        index={index}
                        onChoose={openSelectedOption}
                      />
                    ))}
                  </div>
                  <button type="button" className="btn primary" onClick={rejectOptions}>
                    Żadne mi nie pasuje, szukaj dalej
                  </button>
                </section>
              ) : null}
            </div>

            <form className="composer" onSubmit={submitPrompt}>
              <label htmlFor="chat-prompt" className="sr-only">
                Pole czatu
              </label>
              <textarea
                id="chat-prompt"
                ref={composerRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handlePromptKeyDown}
                placeholder="Np. mam makaron, pomidory i mozzarellę..."
                rows={1}
                disabled={loading}
              />
              <button type="submit" className="btn send" disabled={loading}>
                {loading ? "Szef kuchni myśli..." : "Wyślij"}
              </button>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}

function emptyRecipeForm() {
  return {
    nazwa: "",
    skladniki: "",
    opis: "",
    czas: "",
    kategoria: DEFAULT_RECIPE_CATEGORY,
    tagi: "",
    link_filmu: "",
    link_strony: "",
  };
}

function AdminPanelPage() {
  const [authReady, setAuthReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  const [recipes, setRecipes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [addForm, setAddForm] = useState(emptyRecipeForm());
  const [editForm, setEditForm] = useState(emptyRecipeForm());
  const [addTagInput, setAddTagInput] = useState("");
  const [editTagInput, setEditTagInput] = useState("");
  const [flash, setFlash] = useState({ level: "", message: "" });

  const editingRecipe = useMemo(
    () => recipes.find((item) => item.id === editingId) || null,
    [recipes, editingId],
  );

  const pagedRecipes = useMemo(() => {
    const offset = (currentPage - 1) * ADMIN_PAGE_SIZE;
    return recipes.slice(offset, offset + ADMIN_PAGE_SIZE);
  }, [recipes, currentPage]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(recipes.length / ADMIN_PAGE_SIZE)),
    [recipes.length],
  );

  const knownTags = useMemo(() => {
    const tags = [];
    for (const recipe of recipes) {
      tags.push(...parseTags(recipe?.tagi || ""));
    }
    return uniqueTags(tags).sort((left, right) =>
      left.localeCompare(right, "pl", { sensitivity: "base" }),
    );
  }, [recipes]);

  const knownTagByKey = useMemo(() => {
    const map = new Map();
    for (const tag of knownTags) {
      const key = normalizeTagKey(tag);
      if (!key || map.has(key)) continue;
      map.set(key, tag);
    }
    return map;
  }, [knownTags]);

  const addTags = useMemo(() => uniqueTags(parseTags(addForm.tagi)), [addForm.tagi]);
  const editTags = useMemo(() => uniqueTags(parseTags(editForm.tagi)), [editForm.tagi]);

  const availableAddTagSuggestions = useMemo(() => {
    const used = new Set(addTags.map((tag) => normalizeTagKey(tag)));
    return knownTags.filter((tag) => !used.has(normalizeTagKey(tag)));
  }, [knownTags, addTags]);

  const availableEditTagSuggestions = useMemo(() => {
    const used = new Set(editTags.map((tag) => normalizeTagKey(tag)));
    return knownTags.filter((tag) => !used.has(normalizeTagKey(tag)));
  }, [knownTags, editTags]);

  const setFlashMessage = (level, message) => {
    setFlash({ level, message });
  };

  const clearTagInput = (mode) => {
    if (mode === "add") {
      setAddTagInput("");
      return;
    }
    setEditTagInput("");
  };

  const resolveTagValue = (rawValue) => {
    const cleaned = asString(rawValue).trim().replace(/[.,;]+$/g, "");
    const key = normalizeTagKey(cleaned);
    if (!key) return "";
    const existing = knownTagByKey.get(key);
    return existing || cleaned;
  };

  const setTagsForMode = (mode, tags) => {
    const tagString = tagsToString(tags);
    if (mode === "add") {
      setAddForm((prev) => ({ ...prev, tagi: tagString }));
      return;
    }
    setEditForm((prev) => ({ ...prev, tagi: tagString }));
  };

  const addTagFromInput = (mode) => {
    const rawInput = mode === "add" ? addTagInput : editTagInput;
    const resolvedTag = resolveTagValue(rawInput);
    if (!resolvedTag) {
      clearTagInput(mode);
      return;
    }

    const currentTags = mode === "add" ? addTags : editTags;
    const existingKeys = new Set(currentTags.map((tag) => normalizeTagKey(tag)));
    const nextKey = normalizeTagKey(resolvedTag);

    if (existingKeys.has(nextKey)) {
      clearTagInput(mode);
      return;
    }

    setTagsForMode(mode, [...currentTags, resolvedTag]);
    clearTagInput(mode);
  };

  const removeTag = (mode, tagToRemove) => {
    const currentTags = mode === "add" ? addTags : editTags;
    const removeKey = normalizeTagKey(tagToRemove);
    const nextTags = currentTags.filter((tag) => normalizeTagKey(tag) !== removeKey);
    setTagsForMode(mode, nextTags);
  };

  const onTagInputKeyDown = (mode, event) => {
    if (event.key === "Enter" || event.key === "," || event.key === ";") {
      event.preventDefault();
      addTagFromInput(mode);
    }
  };

  const buildRecipePayload = (form, currentTags, pendingInput) => {
    const pending = resolveTagValue(pendingInput);
    const payloadTags = pending ? [...currentTags, pending] : currentTags;
    return {
      ...form,
      kategoria: normalizeRecipeCategory(form.kategoria),
      tagi: tagsToString(payloadTags),
    };
  };

  const loadRecipes = async () => {
    const response = await apiRequest("/recipes");
    const rows = Array.isArray(response?.recipes) ? response.recipes : [];
    const normalizedRows = rows.map((recipe) => ({
      ...recipe,
      kategoria: normalizeRecipeCategory(recipe?.kategoria),
      tagi: tagsToString(parseTags(recipe?.tagi)),
    }));
    setRecipes(normalizedRows);
    setCurrentPage((prev) => {
      const maxPage = Math.max(1, Math.ceil(normalizedRows.length / ADMIN_PAGE_SIZE));
      return Math.min(Math.max(prev, 1), maxPage);
    });

    if (!normalizedRows.some((item) => item.id === editingId)) {
      setEditingId(null);
      setEditForm(emptyRecipeForm());
      setEditTagInput("");
    }
  };

  const checkAuth = async () => {
    try {
      const response = await apiRequest("/admin/me");
      setLoggedIn(Boolean(response?.loggedIn));
      if (response?.loggedIn) {
        await loadRecipes();
      }
    } catch {
      setLoggedIn(false);
    } finally {
      setAuthReady(true);
    }
  };

  useEffect(() => {
    void checkAuth();
  }, []);

  useEffect(() => {
    if (!editingRecipe) return;
    setEditForm({
      nazwa: editingRecipe.nazwa || "",
      skladniki: editingRecipe.skladniki || "",
      opis: editingRecipe.opis || "",
      czas: editingRecipe.czas || "",
      kategoria: normalizeRecipeCategory(editingRecipe.kategoria),
      tagi: tagsToString(parseTags(editingRecipe.tagi || "")),
      link_filmu: editingRecipe.link_filmu || "",
      link_strony: editingRecipe.link_strony || "",
    });
    setEditTagInput("");
  }, [editingRecipe]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(Math.max(prev, 1), totalPages));
  }, [totalPages]);

  const submitLogin = async (event) => {
    event.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setLoginError("");
    try {
      await apiRequest("/admin/login", { method: "POST", body: { password } });
      setLoggedIn(true);
      setPassword("");
      setFlashMessage("success", "Jesteś zalogowany jako administrator.");
      await loadRecipes();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Nieudane logowanie.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiRequest("/admin/logout", { method: "POST" });
    } finally {
      setLoggedIn(false);
      setRecipes([]);
      setCurrentPage(1);
      setEditingId(null);
      setEditForm(emptyRecipeForm());
      setAddTagInput("");
      setEditTagInput("");
      setFlashMessage("info", "Wylogowano.");
    }
  };

  const saveNewRecipe = async (event) => {
    event.preventDefault();

    if (!addForm.nazwa.trim() || !addForm.skladniki.trim()) {
      setFlashMessage("warning", "Nazwa i składniki są wymagane.");
      return;
    }

    setLoading(true);
    try {
      const payload = buildRecipePayload(addForm, addTags, addTagInput);
      const response = await apiRequest("/recipes", {
        method: "POST",
        body: payload,
      });
      setAddForm(emptyRecipeForm());
      setAddTagInput("");
      setFlashMessage(
        "success",
        `Dodano: ${response?.recipe?.nazwa || "przepis"} (ID: ${response?.recipe?.id ?? "-"})`,
      );
      setCurrentPage(1);
      await loadRecipes();
    } catch (error) {
      setFlashMessage(
        "error",
        error instanceof Error ? error.message : "Błąd zapisu przepisu.",
      );
    } finally {
      setLoading(false);
    }
  };

  const saveEditedRecipe = async (event, recipeId) => {
    event.preventDefault();
    if (!recipeId) return;

    if (!editForm.nazwa.trim() || !editForm.skladniki.trim()) {
      setFlashMessage("warning", "Nazwa i składniki są wymagane.");
      return;
    }

    setLoading(true);
    try {
      const payload = buildRecipePayload(editForm, editTags, editTagInput);
      await apiRequest(`/recipes/${recipeId}`, {
        method: "PUT",
        body: payload,
      });
      setFlashMessage("success", "Zapisano zmiany.");
      setEditTagInput("");
      await loadRecipes();
    } catch (error) {
      setFlashMessage(
        "error",
        error instanceof Error ? error.message : "Błąd zapisu zmian.",
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteRecipe = async (recipeId) => {
    if (!recipeId) return;
    setLoading(true);
    try {
      await apiRequest(`/recipes/${recipeId}`, { method: "DELETE" });
      setFlashMessage("success", "Usunięto przepis.");
      if (editingId === recipeId) {
        setEditingId(null);
        setEditForm(emptyRecipeForm());
        setEditTagInput("");
      }
      await loadRecipes();
    } catch (error) {
      setFlashMessage(
        "error",
        error instanceof Error ? error.message : "Błąd usuwania przepisu.",
      );
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (recipe) => {
    if (editingId === recipe.id) {
      setEditingId(null);
      setEditForm(emptyRecipeForm());
      setEditTagInput("");
      return;
    }

    setEditingId(recipe.id);
    setEditForm({
      nazwa: recipe.nazwa || "",
      skladniki: recipe.skladniki || "",
      opis: recipe.opis || "",
      czas: recipe.czas || "",
      kategoria: normalizeRecipeCategory(recipe.kategoria),
      tagi: tagsToString(parseTags(recipe.tagi || "")),
      link_filmu: recipe.link_filmu || "",
      link_strony: recipe.link_strony || "",
    });
    setEditTagInput("");
  };

  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  if (!authReady) {
    return (
      <main className="admin-shell">
        <section className="admin-panel">
          <h1>Zaplecze Kuchenne</h1>
          <p className="small-note">Sprawdzanie sesji administratora...</p>
        </section>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="admin-shell">
        <section className="admin-panel">
          <h1>Zaplecze Kuchenne</h1>
          <p className="small-note">Zaloguj się, aby zarządzać bazą przepisów.</p>
          <form className="stack-form" onSubmit={submitLogin}>
            <div className="admin-field">
              <label htmlFor="admin-password">Hasło administratora</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            {loginError ? <div className="alert error">{loginError}</div> : null}
            <button type="submit" className="btn send" disabled={loading}>
              {loading ? "Logowanie..." : "Zaloguj"}
            </button>
          </form>
          <p className="small-note top-gap">
            Powrót do strony głównej: <a href="/">co-moge-zjesc.pl</a>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-hero">
        <div>
          <p className="hero-kicker">Panel administracyjny</p>
          <h1>Zaplecze Kuchenne</h1>
        </div>
        <div className="admin-toolbar">
          <a href="/" className="btn ghost inline-link">
            Strona główna
          </a>
          <button type="button" className="btn" onClick={logout}>
            Wyloguj
          </button>
        </div>
      </header>

      {flash.message ? <div className={`alert ${flash.level}`}>{flash.message}</div> : null}

      <section className="admin-panel">
        <h2>Dodaj nowy przepis</h2>
        <form onSubmit={saveNewRecipe}>
          <div className="admin-grid">
            <div className="admin-field">
              <label htmlFor="add-nazwa">Nazwa dania</label>
              <input
                id="add-nazwa"
                type="text"
                value={addForm.nazwa}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, nazwa: event.target.value }))
                }
              />
            </div>

            <div className="admin-field">
              <label htmlFor="add-skladniki">Lista składników</label>
              <textarea
                id="add-skladniki"
                value={addForm.skladniki}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, skladniki: event.target.value }))
                }
              />
            </div>

            <div className="admin-field">
              <label htmlFor="add-czas">Czas przygotowania (min.)</label>
              <input
                id="add-czas"
                type="text"
                value={addForm.czas}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, czas: event.target.value }))
                }
              />
            </div>

            <div className="admin-field">
              <label htmlFor="add-kategoria">Kategoria przepisu</label>
              <select
                id="add-kategoria"
                value={addForm.kategoria}
                onChange={(event) =>
                  setAddForm((prev) => ({
                    ...prev,
                    kategoria: normalizeRecipeCategory(event.target.value),
                  }))
                }
              >
                {RECIPE_CATEGORY_OPTIONS.map((category) => (
                  <option key={`add-category-${category}`} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-field">
              <label htmlFor="add-opis">Opis krok po kroku</label>
              <textarea
                id="add-opis"
                value={addForm.opis}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, opis: event.target.value }))
                }
              />
            </div>

            <TagsEditor
              idPrefix="add-tags"
              label="Tagi dla AI"
              tags={addTags}
              inputValue={addTagInput}
              onInputChange={setAddTagInput}
              onInputKeyDown={(event) => onTagInputKeyDown("add", event)}
              onAddTag={() => addTagFromInput("add")}
              onRemoveTag={(tag) => removeTag("add", tag)}
              suggestions={availableAddTagSuggestions}
              disabled={loading}
            />

            <div className="admin-field">
              <label htmlFor="add-link-filmu">Link do filmu</label>
              <input
                id="add-link-filmu"
                type="text"
                value={addForm.link_filmu}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, link_filmu: event.target.value }))
                }
              />
            </div>

            <div className="admin-field">
              <label htmlFor="add-link-strony">Link do strony</label>
              <input
                id="add-link-strony"
                type="text"
                value={addForm.link_strony}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, link_strony: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="top-gap">
            <button type="submit" className="btn send" disabled={loading}>
              {loading ? "Zapisywanie..." : "Zapisz w bazie"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-panel">
        <h2>Baza dań</h2>
        {recipes.length === 0 ? (
          <p className="small-note">Brak przepisów w bazie.</p>
        ) : (
          <div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nazwa</th>
                    <th>Kategoria</th>
                    <th>Tagi</th>
                    <th>Edytuj</th>
                    <th>Usuń</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRecipes.map((recipe) => (
                    <Fragment key={recipe.id}>
                      <tr>
                        <td>{recipe.id}</td>
                        <td>{recipe.nazwa}</td>
                        <td>{normalizeRecipeCategory(recipe.kategoria)}</td>
                        <td>{recipe.tagi || "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            title="Edytuj"
                            aria-label={`Edytuj przepis ${recipe.nazwa}`}
                            onClick={() => startEditing(recipe)}
                            disabled={loading}
                          >
                            📝
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-icon-btn danger"
                            title="Usuń"
                            aria-label={`Usuń przepis ${recipe.nazwa}`}
                            onClick={() => deleteRecipe(recipe.id)}
                            disabled={loading}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>

                      {editingId === recipe.id ? (
                        <tr className="admin-edit-row">
                          <td colSpan={6}>
                            <form
                              className="admin-inline-form"
                              onSubmit={(event) => saveEditedRecipe(event, recipe.id)}
                            >
                              <div className="admin-grid">
                                <div className="admin-field">
                                  <label htmlFor={`edit-nazwa-${recipe.id}`}>Nazwa dania</label>
                                  <input
                                    id={`edit-nazwa-${recipe.id}`}
                                    type="text"
                                    value={editForm.nazwa}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({ ...prev, nazwa: event.target.value }))
                                    }
                                  />
                                </div>

                                <div className="admin-field">
                                  <label htmlFor={`edit-skladniki-${recipe.id}`}>
                                    Lista składników
                                  </label>
                                  <textarea
                                    id={`edit-skladniki-${recipe.id}`}
                                    value={editForm.skladniki}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        skladniki: event.target.value,
                                      }))
                                    }
                                  />
                                </div>

                                <div className="admin-field">
                                  <label htmlFor={`edit-czas-${recipe.id}`}>Czas przygotowania (min.)</label>
                                  <input
                                    id={`edit-czas-${recipe.id}`}
                                    type="text"
                                    value={editForm.czas}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({ ...prev, czas: event.target.value }))
                                    }
                                  />
                                </div>

                                <div className="admin-field">
                                  <label htmlFor={`edit-kategoria-${recipe.id}`}>Kategoria przepisu</label>
                                  <select
                                    id={`edit-kategoria-${recipe.id}`}
                                    value={editForm.kategoria}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        kategoria: normalizeRecipeCategory(event.target.value),
                                      }))
                                    }
                                  >
                                    {RECIPE_CATEGORY_OPTIONS.map((category) => (
                                      <option key={`edit-category-${recipe.id}-${category}`} value={category}>
                                        {category}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="admin-field">
                                  <label htmlFor={`edit-opis-${recipe.id}`}>Przygotowanie</label>
                                  <textarea
                                    id={`edit-opis-${recipe.id}`}
                                    value={editForm.opis}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({ ...prev, opis: event.target.value }))
                                    }
                                  />
                                </div>

                                <TagsEditor
                                  idPrefix={`edit-tags-${recipe.id}`}
                                  label="Tagi"
                                  tags={editTags}
                                  inputValue={editTagInput}
                                  onInputChange={setEditTagInput}
                                  onInputKeyDown={(event) => onTagInputKeyDown("edit", event)}
                                  onAddTag={() => addTagFromInput("edit")}
                                  onRemoveTag={(tag) => removeTag("edit", tag)}
                                  suggestions={availableEditTagSuggestions}
                                  disabled={loading}
                                />

                                <div className="admin-field">
                                  <label htmlFor={`edit-link-filmu-${recipe.id}`}>Link do filmu</label>
                                  <input
                                    id={`edit-link-filmu-${recipe.id}`}
                                    type="text"
                                    value={editForm.link_filmu}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        link_filmu: event.target.value,
                                      }))
                                    }
                                  />
                                </div>

                                <div className="admin-field">
                                  <label htmlFor={`edit-link-strony-${recipe.id}`}>Link do strony</label>
                                  <input
                                    id={`edit-link-strony-${recipe.id}`}
                                    type="text"
                                    value={editForm.link_strony}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        link_strony: event.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              </div>

                              <div className="admin-inline-actions">
                                <button type="submit" className="btn send" disabled={loading}>
                                  {loading ? "Zapisywanie..." : "Zapisz"}
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-pagination">
              <button
                type="button"
                className="admin-page-btn"
                onClick={goToPrevPage}
                disabled={loading || currentPage <= 1}
                aria-label="Poprzednia strona"
              >
                ←
              </button>
              <div className="admin-page-indicator">
                <strong>{currentPage}</strong>/{totalPages}
              </div>
              <button
                type="button"
                className="admin-page-btn"
                onClick={goToNextPage}
                disabled={loading || currentPage >= totalPages}
                aria-label="Następna strona"
              >
                →
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function App() {
  const path = routePath();
  if (path === "/zaloguj") {
    return <AdminPanelPage />;
  }
  return <UserChatPage />;
}

export default App;

