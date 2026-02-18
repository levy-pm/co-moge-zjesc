from django.shortcuts import render
from django.conf import settings
from groq import Groq
from .models import Przepis

def strona_glowna(request):
    # 1. Pobieramy przepisy z bazy (żeby wyświetlić listę)
    przepisy_z_bazy = Przepis.objects.all()
    odpowiedz_ai = None
    
    # 2. Sprawdzamy, czy użytkownik kliknął "Zapytaj" (wysłał formularz)
    if request.method == "POST":
        pytanie = request.POST.get('pytanie') # To co wpisał użytkownik
        
        if pytanie:
            try:
                # Łączymy się z Groq (używając klucza z settings.py)
                client = Groq(api_key=settings.GROQ_API_KEY)
                
                # Wysyłamy zapytanie do AI
                chat_completion = client.chat.completions.create(
                    messages=[
                        {
                            "role": "system",
                            "content": "Jesteś kucharzem. Podaj krótki pomysł na danie z tych składników. Nie używaj JSON, pisz normalnie po polsku."
                        },
                        {
                            "role": "user",
                            "content": pytanie,
                        }
                    ],
                    model="llama-3.3-70b-versatile",
                )
                
                # Wyciągamy odpowiedź
                odpowiedz_ai = chat_completion.choices[0].message.content
                
            except Exception as e:
                odpowiedz_ai = f"Błąd AI: {e}"

    # 3. Wysyłamy wszystko do HTML
    return render(request, 'home.html', {
        'przepisy': przepisy_z_bazy,
        'odpowiedz_ai': odpowiedz_ai
    })