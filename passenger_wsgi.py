import sys
import os

# Wskazujemy ścieżkę do projektu
sys.path.append(os.getcwd())
sys.path.append('strona_kuchnia')  # To nazwa folderu z settings.py

# Ustawiamy zmienną środowiskową Django
os.environ['DJANGO_SETTINGS_MODULE'] = 'strona_kuchnia.settings'

# Uruchamiamy aplikację
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()