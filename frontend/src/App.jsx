import { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";

const API_BASE = "/backend";
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
    czas: option.time || "Brak danych",
    skladniki: option.ingredients || "Brak danych",
    opis: option.instructions || "Brak danych",
    tagi: "",
  };
}

function asString(value) {
  return typeof value === "string" ? value : "";
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
  return (
    <article className={`chat-row ${role}`}>
      <div className="chat-avatar">{role === "user" ? "TY" : "AI"}</div>
      <div className="chat-bubble">{content}</div>
    </article>
  );
}

function TypingBubble() {
  return (
    <article className="chat-row assistant">
      <div className="chat-avatar">AI</div>
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
  const preview =
    ingredientsPreview.length > 170
      ? `${ingredientsPreview.slice(0, 170)}...`
      : ingredientsPreview || "Brak danych";

  return (
    <article className="choice-card">
      <div className="choice-top">
        <div className="choice-meta">
          <span className="choice-pill">Propozycja {index + 1}</span>
          <span className="choice-time">Czas: {option.time || "Brak danych"}</span>
        </div>
        <h4>{option.title || "Danie"}</h4>
        <p className="choice-why">{option.why || "Dopasowane do Twojego zapytania."}</p>
      </div>

      <div className="choice-bottom">
        <p className="choice-label">Główne składniki</p>
        <p className="choice-ingredients">{preview}</p>
        <button type="button" className="btn ghost" onClick={() => onChoose(option, index)}>
          Wybieram to danie
        </button>
      </div>
    </article>
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
          excludedRecipeIds,
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
  const selectedSource =
    selectedOption && Number.isInteger(selectedOption.recipe_id) ? "Baza przepisów" : "AI";

  return (
    <main className="user-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="hero-card reveal">
        <div className="hero-copy">
          <h1>Co mogę zjeść?</h1>
          <p>
            Podajesz składniki albo nastrój, a dostajesz dwie konkretne propozycje z pełnym
            opisem przygotowania.
          </p>
        </div>
      </header>

      {flash ? <div className="alert error reveal">{flash}</div> : null}

      {selectedRecipe ? (
        <section className="recipe-stage reveal">
          <div className="recipe-stage-head">
            <div>
              <p className="recipe-source">{selectedSource}</p>
              <h2>{selectedRecipe.nazwa || "Danie"}</h2>
              <p className="recipe-time">
                Czas przygotowania: <strong>{selectedRecipe.czas || "Brak danych"}</strong>
              </p>
            </div>
            <button type="button" className="btn" onClick={backToSearch}>
              Wróć do szukania
            </button>
          </div>

          <div className="recipe-grid">
            <article className="recipe-block">
              <h3>Składniki</h3>
              <p>{selectedRecipe.skladniki || "Brak danych"}</p>
            </article>
            <article className="recipe-block">
              <h3>Przygotowanie</h3>
              <p>{selectedRecipe.opis || "Brak danych"}</p>
            </article>
          </div>
        </section>
      ) : (
        <section className="chat-card reveal">
          <div className="chat-scroll" ref={chatRef}>
            {messages.map((message, index) => (
              <ChatBubble key={`${message.role}-${index}`} role={message.role} content={message.content} />
            ))}

            {loading ? <TypingBubble /> : null}

            {!hasMessages ? (
              <div className="empty-state">
                <h3>Powiedz, na co masz ochotę</h3>
                <p>
                  Chat przygotuje 2 konkretne opcje. Możesz je zaakceptować albo odrzucić i
                  poprosić o kolejne.
                </p>
                <StarterPrompts loading={loading} onPick={sendPrompt} />
              </div>
            ) : null}
          </div>

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
    </main>
  );
}

function emptyRecipeForm() {
  return {
    nazwa: "",
    skladniki: "",
    opis: "",
    czas: "",
    tagi: "",
  };
}

function AdminPanelPage() {
  const [authReady, setAuthReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  const [recipes, setRecipes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [addForm, setAddForm] = useState(emptyRecipeForm());
  const [editForm, setEditForm] = useState(emptyRecipeForm());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [flash, setFlash] = useState({ level: "", message: "" });

  const selectedRecipe = useMemo(
    () => recipes.find((item) => item.id === selectedId) || null,
    [recipes, selectedId],
  );

  const setFlashMessage = (level, message) => {
    setFlash({ level, message });
  };

  const loadRecipes = async () => {
    const response = await apiRequest("/recipes");
    const rows = Array.isArray(response?.recipes) ? response.recipes : [];
    setRecipes(rows);
    if (rows.length === 0) {
      setSelectedId(null);
      setEditForm(emptyRecipeForm());
      return;
    }

    const exists = rows.some((item) => item.id === selectedId);
    const nextId = exists ? selectedId : rows[0].id;
    setSelectedId(nextId);
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
    if (!selectedRecipe) return;
    setEditForm({
      nazwa: selectedRecipe.nazwa || "",
      skladniki: selectedRecipe.skladniki || "",
      opis: selectedRecipe.opis || "",
      czas: selectedRecipe.czas || "",
      tagi: selectedRecipe.tagi || "",
    });
    setConfirmDelete(false);
  }, [selectedRecipe]);

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
      setSelectedId(null);
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
      const response = await apiRequest("/recipes", {
        method: "POST",
        body: addForm,
      });
      setAddForm(emptyRecipeForm());
      setFlashMessage(
        "success",
        `Dodano: ${response?.recipe?.nazwa || "przepis"} (ID: ${response?.recipe?.id ?? "-"})`,
      );
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

  const saveEditedRecipe = async (event) => {
    event.preventDefault();
    if (!selectedRecipe) return;

    if (!editForm.nazwa.trim() || !editForm.skladniki.trim()) {
      setFlashMessage("warning", "Nazwa i składniki są wymagane.");
      return;
    }

    setLoading(true);
    try {
      await apiRequest(`/recipes/${selectedRecipe.id}`, {
        method: "PUT",
        body: editForm,
      });
      setFlashMessage("success", "Zapisano zmiany.");
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

  const deleteRecipe = async () => {
    if (!selectedRecipe) return;
    setLoading(true);
    try {
      await apiRequest(`/recipes/${selectedRecipe.id}`, { method: "DELETE" });
      setFlashMessage("success", "Usunięto przepis.");
      setConfirmDelete(false);
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
              <label htmlFor="add-czas">Czas przygotowania</label>
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
              <label htmlFor="add-opis">Opis krok po kroku</label>
              <textarea
                id="add-opis"
                value={addForm.opis}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, opis: event.target.value }))
                }
              />
            </div>

            <div className="admin-field full">
              <label htmlFor="add-tagi">Tagi dla AI</label>
              <input
                id="add-tagi"
                type="text"
                value={addForm.tagi}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, tagi: event.target.value }))
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
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nazwa</th>
                  <th>Czas</th>
                  <th>Tagi</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((recipe) => (
                  <tr key={recipe.id}>
                    <td>{recipe.id}</td>
                    <td>{recipe.nazwa}</td>
                    <td>{recipe.czas}</td>
                    <td>{recipe.tagi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel">
        <h2>Edytuj lub usuń przepis</h2>
        {recipes.length === 0 || !selectedRecipe ? (
          <p className="small-note">Brak przepisów do edycji.</p>
        ) : (
          <>
            <div className="admin-field">
              <label htmlFor="select-recipe">Wybierz ID przepisu</label>
              <select
                id="select-recipe"
                value={selectedId || ""}
                onChange={(event) => setSelectedId(Number(event.target.value))}
              >
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.id} - {recipe.nazwa}
                  </option>
                ))}
              </select>
            </div>

            <form className="top-gap" onSubmit={saveEditedRecipe}>
              <div className="admin-grid">
                <div className="admin-field">
                  <label htmlFor="edit-nazwa">Nazwa</label>
                  <input
                    id="edit-nazwa"
                    type="text"
                    value={editForm.nazwa}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, nazwa: event.target.value }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <label htmlFor="edit-skladniki">Składniki</label>
                  <textarea
                    id="edit-skladniki"
                    value={editForm.skladniki}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, skladniki: event.target.value }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <label htmlFor="edit-czas">Czas</label>
                  <input
                    id="edit-czas"
                    type="text"
                    value={editForm.czas}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, czas: event.target.value }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <label htmlFor="edit-opis">Opis</label>
                  <textarea
                    id="edit-opis"
                    value={editForm.opis}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, opis: event.target.value }))
                    }
                  />
                </div>

                <div className="admin-field full">
                  <label htmlFor="edit-tagi">Tagi</label>
                  <input
                    id="edit-tagi"
                    type="text"
                    value={editForm.tagi}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, tagi: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="admin-actions">
                <button type="submit" className="btn send" disabled={loading}>
                  {loading ? "Zapisywanie..." : "Zapisz zmiany"}
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => setConfirmDelete(true)}
                  disabled={loading}
                >
                  Usuń przepis
                </button>
              </div>
            </form>

            {confirmDelete ? (
              <div className="confirm-box">
                Potwierdź usunięcie - tej operacji nie da się cofnąć.
                <div className="confirm-actions">
                  <button type="button" className="btn primary" onClick={deleteRecipe}>
                    TAK, usuń
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Nie, anuluj
                  </button>
                </div>
              </div>
            ) : null}
          </>
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
