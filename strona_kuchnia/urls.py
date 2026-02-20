from django.contrib import admin
from django.urls import path
# Importujemy oba widoki: stary (opcjonalnie) i nowy dla Reacta
from przepisy.views import strona_glowna, api_generuj_przepis 

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Twoja stara strona główna (możesz ją zostawić lub usunąć)
    path('', strona_glowna), 
    
    # KLUCZOWA LINIA: To tutaj puka React
    # Pamiętaj o ukośniku na końcu!
    path('api/generuj/', api_generuj_przepis, name='api_generuj'), 
    # Gdy Django jest podpięte pod /api w hostingu, ścieżka trafia jako /generuj/
    path('generuj/', api_generuj_przepis, name='api_generuj_mounted'),
]
