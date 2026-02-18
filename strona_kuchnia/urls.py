from django.contrib import admin
from django.urls import path
from przepisy.views import strona_glowna  # <--- Importujemy Twój widok

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', strona_glowna),  # <--- Pusty cudzysłów oznacza stronę główną
]