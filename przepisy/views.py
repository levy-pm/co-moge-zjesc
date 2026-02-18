import re

import requests
from django.conf import settings
from django.db.models import Q
from django.shortcuts import render
from groq import Groq

from .models import Przepis


def znajdz_przepis_w_bazie(pytanie):
    pytanie = (pytanie or "").strip()
    if not pytanie:
        return None

    bezposrednie_dopasowanie = Przepis.objects.filter(
        Q(nazwa__icontains=pytanie) | Q(tagi__icontains=pytanie)
    ).first()
    if bezposrednie_dopasowanie:
        return bezposrednie_dopasowanie

    slowa = [slowo for slowo in re.split(r"\W+", pytanie.lower()) if len(slowo) >= 4]
    if not slowa:
        return None

    warunek = Q()
    for slowo in slowa[:6]:
        warunek |= Q(nazwa__icontains=slowo) | Q(tagi__icontains=slowo)

    return Przepis.objects.filter(warunek).first()


def pobierz_kontekst_z_internetu(pytanie):
    try:
        odpowiedz = requests.get(
            "https://api.duckduckgo.com/",
            params={
                "q": f"przepis {pytanie}",
                "format": "json",
                "no_html": "1",
                "skip_disambig": "1",
            },
            timeout=6,
        )
        odpowiedz.raise_for_status()
        dane = odpowiedz.json()
    except Exception:
        return ""

    fragmenty = []

    if dane.get("AbstractText"):
        fragmenty.append(dane["AbstractText"])

    for wpis in dane.get("RelatedTopics", []):
        if len(fragmenty) >= 4:
            break

        if isinstance(wpis, dict) and wpis.get("Text"):
            fragmenty.append(wpis["Text"])
            continue

        if isinstance(wpis, dict) and wpis.get("Topics"):
            for podwpis in wpis["Topics"]:
                if isinstance(podwpis, dict) and podwpis.get("Text"):
                    fragmenty.append(podwpis["Text"])
                if len(fragmenty) >= 4:
                    break

    return " ".join(fragmenty[:4]).strip()


def strona_glowna(request):
    przepisy_z_bazy = Przepis.objects.all()
    odpowiedz_ai = None
    status_bazy = None
    pytanie_uzytkownika = ""

    if request.method == "POST":
        pytanie_uzytkownika = (request.POST.get("pytanie") or "").strip()

        if pytanie_uzytkownika:
            try:
                znaleziony_przepis = znajdz_przepis_w_bazie(pytanie_uzytkownika)

                if znaleziony_przepis:
                    status_bazy = f"Przepis znaleziony w bazie: {znaleziony_przepis.nazwa}."
                    kontekst = (
                        "Dane przepisu z bazy:\n"
                        f"Nazwa: {znaleziony_przepis.nazwa}\n"
                        f"Skladniki: {znaleziony_przepis.skladniki}\n"
                        f"Opis: {znaleziony_przepis.opis}\n"
                        f"Czas: {znaleziony_przepis.czas}\n"
                        f"Tagi: {znaleziony_przepis.tagi}"
                    )
                else:
                    status_bazy = (
                        "Nie ma tego przepisu w bazie. Korzystam z informacji z internetu "
                        "i proponuje alternatywe."
                    )
                    kontekst_internetowy = pobierz_kontekst_z_internetu(pytanie_uzytkownika)
                    if kontekst_internetowy:
                        kontekst = f"Informacje z internetu:\n{kontekst_internetowy}"
                    else:
                        kontekst = (
                            "Nie udalo sie pobrac danych z internetu. "
                            "Uzyj ogolnej wiedzy kulinarnej."
                        )

                client = Groq(api_key=settings.GROQ_API_KEY)

                chat_completion = client.chat.completions.create(
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "Jestes kucharzem. Odpowiadaj po polsku, krotko i konkretnie. "
                                "Najpierw odnes sie do podanego kontekstu, potem zaproponuj danie."
                            ),
                        },
                        {
                            "role": "system",
                            "content": kontekst,
                        },
                        {
                            "role": "user",
                            "content": pytanie_uzytkownika,
                        },
                    ],
                    model="llama-3.3-70b-versatile",
                )

                odpowiedz_ai = chat_completion.choices[0].message.content

            except Exception as e:
                odpowiedz_ai = f"Blad AI: {e}"

    response = render(
        request,
        "home.html",
        {
            "przepisy": przepisy_z_bazy,
            "odpowiedz_ai": odpowiedz_ai,
            "status_bazy": status_bazy,
            "pytanie_uzytkownika": pytanie_uzytkownika,
        },
    )
    response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response
