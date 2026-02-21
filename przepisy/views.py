import json
from typing import Any

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import Przepis


ADMIN_PASSWORD = "admin123"
MODEL_AI = "llama-3.3-70b-versatile"


def _safe_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _ensure_user_state(session) -> None:
    if "messages" not in session:
        session["messages"] = []
    if "pending_options" not in session:
        session["pending_options"] = None
    if "selected_recipe_id" not in session:
        session["selected_recipe_id"] = None
    if "selected_option" not in session:
        session["selected_option"] = None
    if "options_round" not in session:
        session["options_round"] = 0
    if "excluded_recipe_ids" not in session:
        session["excluded_recipe_ids"] = []
    if "admin_logged_in" not in session:
        session["admin_logged_in"] = False


def _append_message(session, role: str, content: str) -> None:
    messages = list(session.get("messages", []))
    messages.append({"role": role, "content": content})
    session["messages"] = messages


def _set_flash(session, key: str, level: str, message: str) -> None:
    session[key] = {"level": level, "message": message}


def _pop_flash(session, key: str):
    flash = session.get(key)
    if key in session:
        del session[key]
    return flash


def _no_cache(response):
    response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response


def _normalize_option(option: dict[str, Any]) -> dict[str, Any]:
    return {
        "recipe_id": _safe_int(option.get("recipe_id")),
        "title": option.get("title") or "Danie",
        "why": option.get("why") or "",
        "ingredients": option.get("ingredients")
        or "AI nie podalo dokladnych skladnikow.",
        "instructions": option.get("instructions")
        or "AI nie podalo instrukcji. Sprobuj dopytac na czacie.",
        "time": option.get("time") or "Brak danych",
    }


def _build_db_context() -> str:
    rows = Przepis.objects.values("id", "nazwa", "skladniki", "tagi")
    return "\n".join(
        [
            f"ID:{r['id']} | Danie:{r['nazwa']} | Sklad:{r['skladniki']} | Tagi:{r['tagi']}"
            for r in rows
        ]
    )


def _run_ai_prompt(session, prompt: str) -> None:
    api_key = settings.GROQ_API_KEY
    if not api_key:
        _set_flash(
            session,
            "user_flash",
            "error",
            "Blad konfiguracji: Brak klucza API Groq w zmiennej GROQ_API_KEY.",
        )
        session["pending_options"] = None
        return

    try:
        from groq import Groq
    except Exception:
        _set_flash(
            session,
            "user_flash",
            "error",
            "Blad konfiguracji: Brak biblioteki groq. Uruchom instalacje pip.",
        )
        session["pending_options"] = None
        return

    try:
        context_db = _build_db_context()
        if not context_db:
            context_db = "Brak polaczenia z baza."
    except Exception:
        context_db = "Brak polaczenia z baza."

    system_msg = """
Jestes doswiadczonym Szefem Kuchni. Odpowiadaj WYLACZNIE poprawnym formatem JSON.
ZADANIE: Generuj dokladnie 2 rozne, konkretne propozycje dan.

ZASADY JAKOSCI:
1. SKLADNIKI: BARDZO PRECYZYJNE (ilosci, miary).
2. INSTRUKCJE: Pelny opis krok po kroku.

Struktura JSON:
{
  "assistant_text": "Krotka odpowiedz tekstowa.",
  "options": [
      { "recipe_id": 1, "title": "...", "why": "...", "ingredients": "...", "instructions": "...", "time": "..." },
      { "recipe_id": null, "title": "...", "why": "...", "ingredients": "...", "instructions": "...", "time": "..." }
    ]
}
PRIORYTET: 1. Baza (wpisz ID). 2. Internet (ID=null, ale wypelnij reszte).
""".strip()

    history = session.get("messages", [])[-6:]
    msgs: list[dict[str, str]] = [{"role": "system", "content": system_msg}]
    for message in history:
        role = message.get("role")
        content = message.get("content")
        if role in {"user", "assistant"} and isinstance(content, str):
            msgs.append({"role": role, "content": content})

    excluded_ids = session.get("excluded_recipe_ids", [])
    excluded_txt = ", ".join(map(str, excluded_ids)) or "(brak)"
    msgs.append(
        {
            "role": "user",
            "content": f"User chce: {prompt}\nBaza:{context_db}\nOdrzucone ID:{excluded_txt}",
        }
    )

    try:
        client = Groq(api_key=api_key)
        resp = client.chat.completions.create(
            model=MODEL_AI,
            messages=msgs,
            response_format={"type": "json_object"},
        )
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)

        assistant_text = str(data.get("assistant_text", "Oto co przygotowalem:"))
        options_raw = data.get("options", [])
        if not isinstance(options_raw, list):
            options_raw = []

        normalized_options = []
        for item in options_raw:
            if not isinstance(item, dict):
                continue
            option = _normalize_option(item)
            recipe_id = option.get("recipe_id")
            if recipe_id is not None:
                recipe = Przepis.objects.filter(id=recipe_id).first()
                if recipe:
                    option["title"] = recipe.nazwa
                    option["ingredients"] = recipe.skladniki or ""
                    option["time"] = recipe.czas or ""
            normalized_options.append(option)

        _append_message(session, "assistant", assistant_text)

        if normalized_options:
            session["options_round"] = int(session.get("options_round", 0)) + 1
            session["pending_options"] = normalized_options[:2]
        else:
            session["pending_options"] = None

    except Exception:
        _set_flash(
            session,
            "user_flash",
            "error",
            "Szef kuchni upuscil talerz (Blad AI). Sprobuj ponownie.",
        )
        session["pending_options"] = None


def _resolve_selected_recipe(session) -> dict[str, str] | None:
    selected_option = session.get("selected_option")
    selected_recipe_id = session.get("selected_recipe_id")

    if not selected_option and selected_recipe_id is None:
        return None

    recipe = None
    if selected_recipe_id is not None:
        recipe = Przepis.objects.filter(id=_safe_int(selected_recipe_id)).first()

    if recipe:
        return {
            "nazwa": recipe.nazwa,
            "czas": recipe.czas or "Brak danych",
            "skladniki": recipe.skladniki or "",
            "opis": recipe.opis or "",
        }

    option = selected_option if isinstance(selected_option, dict) else {}
    return {
        "nazwa": option.get("title", "Danie"),
        "czas": option.get("time", "Brak danych"),
        "skladniki": option.get("ingredients", "AI nie podalo dokladnych skladnikow."),
        "opis": option.get(
            "instructions", "AI nie podalo instrukcji. Sprobuj dopytac na czacie."
        ),
    }


def _admin_redirect(request, selected_id: int | None = None):
    url = f"{request.path}?tryb=zaloguj"
    if selected_id is not None:
        url = f"{url}&edit_id={selected_id}"
    return redirect(url)


def _handle_admin_post(request):
    session = request.session
    action = request.POST.get("action")

    if action == "admin_login":
        password = request.POST.get("password", "")
        if password == ADMIN_PASSWORD:
            session["admin_logged_in"] = True
            _set_flash(
                session, "admin_flash", "success", "Jestes zalogowany jako Administrator"
            )
        else:
            _set_flash(session, "admin_flash", "error", "Zle haslo!")
        return _admin_redirect(request)

    if action == "admin_logout":
        session["admin_logged_in"] = False
        _set_flash(session, "admin_flash", "info", "Wylogowano")
        return _admin_redirect(request)

    if not session.get("admin_logged_in"):
        return _admin_redirect(request)

    if action == "admin_add":
        nazwa = (request.POST.get("nazwa") or "").strip()
        skladniki = (request.POST.get("skladniki") or "").strip()
        opis = (request.POST.get("opis") or "").strip()
        czas = (request.POST.get("czas") or "").strip()
        tagi = (request.POST.get("tagi") or "").strip()

        if nazwa and skladniki:
            recipe = Przepis.objects.create(
                nazwa=nazwa, skladniki=skladniki, opis=opis, czas=czas, tagi=tagi
            )
            _set_flash(
                session,
                "admin_flash",
                "success",
                f"Dodano: {recipe.nazwa} (ID: {recipe.id})",
            )
        else:
            _set_flash(
                session, "admin_flash", "warning", "Nazwa i skladniki sa wymagane!"
            )
        return _admin_redirect(request)

    selected_id = _safe_int(request.POST.get("selected_id"))

    if action == "admin_save" and selected_id is not None:
        recipe = Przepis.objects.filter(id=selected_id).first()
        if not recipe:
            _set_flash(session, "admin_flash", "warning", "Nie znaleziono przepisu.")
            return _admin_redirect(request)

        nazwa = (request.POST.get("nazwa") or "").strip()
        skladniki = (request.POST.get("skladniki") or "").strip()
        recipe.opis = (request.POST.get("opis") or "").strip()
        recipe.czas = (request.POST.get("czas") or "").strip()
        recipe.tagi = (request.POST.get("tagi") or "").strip()

        if not nazwa or not skladniki:
            _set_flash(
                session, "admin_flash", "warning", "Nazwa i skladniki sa wymagane!"
            )
            return _admin_redirect(request, selected_id=selected_id)

        recipe.nazwa = nazwa
        recipe.skladniki = skladniki
        recipe.save()
        _set_flash(session, "admin_flash", "success", "Zapisano zmiany")
        return _admin_redirect(request, selected_id=selected_id)

    if action == "admin_delete_request" and selected_id is not None:
        session["confirm_delete"] = selected_id
        return _admin_redirect(request, selected_id=selected_id)

    if action == "admin_delete_confirm" and selected_id is not None:
        Przepis.objects.filter(id=selected_id).delete()
        session.pop("confirm_delete", None)
        _set_flash(session, "admin_flash", "success", "Usunieto przepis")
        return _admin_redirect(request)

    if action == "admin_delete_cancel":
        session.pop("confirm_delete", None)
        _set_flash(session, "admin_flash", "info", "Anulowano")
        return _admin_redirect(request, selected_id=selected_id)

    return _admin_redirect(request, selected_id=selected_id)


def _render_admin(request):
    session = request.session
    recipes = list(Przepis.objects.order_by("-id"))
    selected_id = _safe_int(request.GET.get("edit_id"))
    if selected_id is None and recipes:
        selected_id = recipes[0].id

    selected_recipe = None
    if selected_id is not None:
        selected_recipe = next((r for r in recipes if r.id == selected_id), None)

    response = render(
        request,
        "home.html",
        {
            "admin_mode": True,
            "admin_logged_in": bool(session.get("admin_logged_in")),
            "admin_flash": _pop_flash(session, "admin_flash"),
            "admin_recipes": recipes,
            "admin_selected_recipe": selected_recipe,
            "admin_selected_id": selected_id,
            "admin_confirm_delete_id": _safe_int(session.get("confirm_delete")),
        },
    )
    return _no_cache(response)


def _handle_user_post(request):
    session = request.session
    action = request.POST.get("action")
    api_key_missing = not bool(settings.GROQ_API_KEY)

    if action == "chat_prompt":
        if api_key_missing:
            _set_flash(
                session,
                "user_flash",
                "error",
                "Blad konfiguracji: Brak klucza API Groq w zmiennej GROQ_API_KEY.",
            )
            return redirect(request.path)
        prompt = (request.POST.get("pytanie") or "").strip()
        if prompt:
            _append_message(session, "user", prompt)
            _run_ai_prompt(session, prompt)
        return redirect(request.path)

    if action == "choose_option":
        idx = _safe_int(request.POST.get("option_index"))
        pending_options = session.get("pending_options") or []
        if idx is not None and 0 <= idx < len(pending_options):
            selected_option = pending_options[idx]
            session["selected_option"] = selected_option
            session["selected_recipe_id"] = selected_option.get("recipe_id")
        return redirect(request.path)

    if action == "reject_options":
        pending_options = session.get("pending_options") or []
        excluded_ids = list(session.get("excluded_recipe_ids", []))
        for option in pending_options:
            if not isinstance(option, dict):
                continue
            recipe_id = _safe_int(option.get("recipe_id"))
            if recipe_id is not None and recipe_id not in excluded_ids:
                excluded_ids.append(recipe_id)
        session["excluded_recipe_ids"] = excluded_ids
        session["pending_options"] = None
        _append_message(
            session,
            "assistant",
            (
                "Zrozumialem. Sprobujmy czegos innego. "
                "Podpowiedz mi: wolisz cos lzejszego, czy moze inny rodzaj kuchni?"
            ),
        )
        return redirect(request.path)

    if action == "back_to_search":
        session["selected_option"] = None
        session["selected_recipe_id"] = None
        session["pending_options"] = None
        _append_message(
            session, "assistant", "Jasne! Szukamy dalej. Na co masz ochote?"
        )
        return redirect(request.path)

    return redirect(request.path)


def _render_user(request):
    session = request.session
    api_key_missing = not bool(settings.GROQ_API_KEY)
    response = render(
        request,
        "home.html",
        {
            "admin_mode": False,
            "messages": session.get("messages", []),
            "pending_options": session.get("pending_options") or [],
            "selected_recipe": _resolve_selected_recipe(session),
            "options_round": session.get("options_round", 0),
            "user_flash": _pop_flash(session, "user_flash"),
            "api_key_missing": api_key_missing,
        },
    )
    return _no_cache(response)


def strona_glowna(request):
    _ensure_user_state(request.session)

    if request.GET.get("tryb") == "zaloguj":
        if request.method == "POST":
            admin_redirect = _handle_admin_post(request)
            if admin_redirect is not None:
                return admin_redirect
        return _render_admin(request)

    if request.method == "POST":
        user_redirect = _handle_user_post(request)
        if user_redirect is not None:
            return user_redirect

    return _render_user(request)

@csrf_exempt
@require_POST
def api_generuj_przepis(request):
    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        payload = {}

    skladniki = (payload.get("skladniki") or request.POST.get("skladniki") or "").strip()

    api_key = settings.GROQ_API_KEY
    if not api_key:
        return JsonResponse(
            {"przepis": "Blad: Brak klucza API Groq w ustawieniach."},
            status=500,
        )

    try:
        from groq import Groq
    except Exception:
        return JsonResponse(
            {"przepis": "Blad: Brak biblioteki groq. Uruchom instalacje pip."},
            status=500,
        )

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=MODEL_AI,
            messages=[
                {
                    "role": "system",
                    "content": "Jestes Szefem Kuchni. Podaj konkretny przepis na podstawie skladnikow.",
                },
                {
                    "role": "user",
                    "content": f"Mam te skladniki: {skladniki}. Co moge z nich zrobic? Podaj tytul i opis wykonania.",
                },
            ],
        )

        odpowiedz_ai = completion.choices[0].message.content

        try:
            Przepis.objects.create(
                nazwa=f"Przepis z: {skladniki[:30]}...",
                skladniki=skladniki,
                opis=odpowiedz_ai,
            )
        except Exception:
            pass

        return JsonResponse({"przepis": odpowiedz_ai})

    except Exception as e:
        print(f"Blad AI: {e}")
        return JsonResponse(
            {"przepis": "Szef kuchni ma przerwe (Blad serwera)."},
            status=500,
        )
