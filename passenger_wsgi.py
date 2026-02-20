import os
import sys

path = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, path)

os.environ['DJANGO_SETTINGS_MODULE'] = 'strona_kuchnia.settings'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
