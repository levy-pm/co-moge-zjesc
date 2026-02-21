import { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";

const API_BASE = "/backend";

function routePath() {
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
    return body.trim();
  }

  if (body && typeof body === "object") {
    const message = body.error || body.message || body.przepis;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return `Blad HTTP ${status}`;
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

  useEffect(() => {
    const node = chatRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, pendingOptions, selectedRecipe, loading]);

  const submitPrompt = async (event) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    const userMessage = { role: "user", content: trimmed };
    const nextHistory = [...messages, userMessage].slice(-8);

    setFlash("");
    setPrompt("");
    setLoading(true);
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

      const assistantText = asString(response?.assistantText) || "Oto co przygotowalem:";
      const options = Array.isArray(response?.options) ? response.options.slice(0, 2) : [];

      setMessages((prev) => [...prev, { role: "assistant", content: assistantText }]);
      setPendingOptions(options);
      setOptionsRound((value) => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Blad polaczenia z serwerem.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Szef kuchni upuscil talerz: ${message}`,
        },
      ]);
      setPendingOptions([]);
      setFlash(message);
    } finally {
      setLoading(false);
    }
  };

  const openSelectedOption = async (option) => {
    setSelectedOption(option);
    setPendingOptions([]);

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

    try {
      await apiRequest("/chat/feedback", {
        method: "POST",
        body: {
          action: "rejected",
          userText: messages.length > 0 ? messages[messages.length - 1].content : "",
          option1: pendingOptions[0] || null,
          option2: pendingOptions[1] || null,
        },
      });
    } catch {
      // Brak blokowania UI
    }

    setPendingOptions([]);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "Zrozumialem. Sprobujmy czegos innego. Podpowiedz mi: wolisz cos lzejszego, czy moze inny rodzaj kuchni?",
      },
    ]);
  };

  const backToSearch = () => {
    setSelectedOption(null);
    setSelectedRecipe(null);
    setPendingOptions([]);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Jasne! Szukamy dalej. Na co masz ochote?" },
    ]);
  };

  const hasMessages = messages.length > 0;

  return (
    <main className="page user-page">
      <header className="hero">
        <h1>Co moge zjesc?</h1>
        <p>Zdrowo, smacznie i nowoczesnie. Twoj kulinarny asystent.</p>
      </header>

      {flash && <div className="alert error">{flash}</div>}

      <section className="chat-window" ref={chatRef}>
        {messages.map((message, index) => (
          <article key={`${message.role}-${index}`} className={`chat-msg ${message.role}`}>
            <div className="avatar">{message.role === "user" ? "Ty" : "AI"}</div>
            <div className="bubble">{message.content}</div>
          </article>
        ))}
        {!hasMessages && (
          <p className="placeholder">
            Napisz, na co masz ochote, a dostaniesz 2 propozycje.
          </p>
        )}
      </section>

      {selectedRecipe ? (
        <section className="recipe-view">
          <div className="recipe-card">
            <h2>{selectedRecipe.nazwa || "Danie"}</h2>
            <p className="recipe-meta">
              Czas przygotowania: <strong>{selectedRecipe.czas || "Brak danych"}</strong>
            </p>
            <div className="recipe-grid">
              <div className="section-box">
                <h3>Skladniki</h3>
                <div className="content">{selectedRecipe.skladniki || "Brak danych"}</div>
              </div>
              <div className="section-box">
                <h3>Przygotowanie</h3>
                <div className="content">{selectedRecipe.opis || "Brak danych"}</div>
              </div>
            </div>
          </div>

          <button type="button" className="btn" onClick={backToSearch}>
            Wroc do szukania (mam ochote na cos innego)
          </button>
        </section>
      ) : null}

      {!selectedRecipe && pendingOptions.length > 0 ? (
        <section className="options-wrap">
          <h3 className="cards-title">Co wybierasz?</h3>
          <div className={`cards ${pendingOptions.length === 1 ? "one" : "two"}`}>
            {pendingOptions.map((option, index) => (
              <article key={`option-${optionsRound}-${index}`} className="option-card">
                <div className="option-head">
                  <h4>{option.title || "Danie"}</h4>
                  <span className="time-pill">Czas: {option.time || "Brak danych"}</span>
                  <p className="option-why">{option.why || ""}</p>
                  <div className="ingredients">
                    <p className="ingredients-label">Glowne skladniki</p>
                    <p className="ingredients-preview">
                      {asString(option.ingredients).slice(0, 140)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => openSelectedOption(option)}
                >
                  Wybieram to
                </button>
              </article>
            ))}
          </div>

          <div className="reject-wrap">
            <button type="button" className="btn primary" onClick={rejectOptions}>
              Zadne mi nie pasuje, szukaj dalej
            </button>
          </div>
        </section>
      ) : null}

      {!selectedOption || !selectedRecipe ? (
        <section className="chat-input-wrap">
          <form className="chat-form" onSubmit={submitPrompt}>
            <input
              type="text"
              name="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Na co masz ochote?"
              autoComplete="off"
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? "AI pracuje..." : "Zapytaj"}
            </button>
          </form>
        </section>
      ) : null}
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
    checkAuth();
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
      setFlashMessage("success", "Jestes zalogowany jako Administrator.");
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
      setFlashMessage("warning", "Nazwa i skladniki sa wymagane.");
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
        error instanceof Error ? error.message : "Blad zapisu przepisu.",
      );
    } finally {
      setLoading(false);
    }
  };

  const saveEditedRecipe = async (event) => {
    event.preventDefault();
    if (!selectedRecipe) return;

    if (!editForm.nazwa.trim() || !editForm.skladniki.trim()) {
      setFlashMessage("warning", "Nazwa i skladniki sa wymagane.");
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
        error instanceof Error ? error.message : "Blad zapisu zmian.",
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
      setFlashMessage("success", "Usunieto przepis.");
      setConfirmDelete(false);
      await loadRecipes();
    } catch (error) {
      setFlashMessage(
        "error",
        error instanceof Error ? error.message : "Blad usuwania przepisu.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!authReady) {
    return (
      <main className="admin-page">
        <h1>Zaplecze Kuchenne</h1>
        <p className="small-note">Sprawdzanie sesji administratora...</p>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="admin-page">
        <h1>Zaplecze Kuchenne</h1>
        <section className="admin-section">
          <h2>Logowanie admina</h2>
          <form className="stack-form" onSubmit={submitLogin}>
            <div className="admin-field">
              <label htmlFor="admin-password">Podaj haslo szefa kuchni</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            {loginError ? <div className="alert error">{loginError}</div> : null}
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "Logowanie..." : "Zaloguj"}
            </button>
          </form>
          <p className="small-note top-gap">
            Powrot do strony glownej: <a href="/">co-moge-zjesc.pl</a>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <h1>Zaplecze Kuchenne</h1>

      <div className="top-right dual">
        <a href="/" className="btn inline-link">
          Strona glowna
        </a>
        <button type="button" className="btn" onClick={logout}>
          Wyloguj
        </button>
      </div>

      {flash.message ? <div className={`alert ${flash.level}`}>{flash.message}</div> : null}

      <section className="admin-section">
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
              <label htmlFor="add-skladniki">Lista skladnikow</label>
              <textarea
                id="add-skladniki"
                value={addForm.skladniki}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, skladniki: event.target.value }))
                }
              />
            </div>

            <div className="admin-field">
              <label htmlFor="add-czas">Czas</label>
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
              <label htmlFor="add-opis">Przepis krok po kroku</label>
              <textarea
                id="add-opis"
                value={addForm.opis}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, opis: event.target.value }))
                }
              />
            </div>

            <div className="admin-field full">
              <label htmlFor="add-tagi">Tagi (dla AI)</label>
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
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "Zapisywanie..." : "Zapisz w bazie"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-section">
        <h2>Baza dan</h2>
        {recipes.length === 0 ? (
          <p className="small-note">Brak przepisow w bazie.</p>
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

      <section className="admin-section">
        <h2>Edytuj lub usun przepis</h2>
        {recipes.length === 0 || !selectedRecipe ? (
          <p className="small-note">Brak przepisow do edycji.</p>
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
                  <label htmlFor="edit-skladniki">Skladniki</label>
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
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? "Zapisywanie..." : "Zapisz zmiany"}
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => setConfirmDelete(true)}
                  disabled={loading}
                >
                  Usun przepis
                </button>
              </div>
            </form>

            {confirmDelete ? (
              <div className="confirm-box">
                Potwierdz usuniecie - tej operacji nie da sie cofnac.
                <div className="confirm-actions">
                  <button type="button" className="btn primary" onClick={deleteRecipe}>
                    TAK, usun
                  </button>
                  <button
                    type="button"
                    className="btn"
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
