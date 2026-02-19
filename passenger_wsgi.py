import os
import sys

# Pobieramy pełną ścieżkę do folderu, w którym jest ten plik
path = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, path)

# Ustawiamy moduł ustawień - upewnij się, że 'strona_kuchnia' to na pewno 
# nazwa folderu zawierającego plik settings.py
os.environ['DJANGO_SETTINGS_MODULE'] = 'strona_kuchnia.settings'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()