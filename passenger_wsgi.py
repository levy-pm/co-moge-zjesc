import os
import sys
import traceback

path = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'strona_kuchnia.settings')


def _try_auto_migrate():
    if os.environ.get("DISABLE_AUTO_MIGRATE") == "1":
        return

    try:
        import django
        from django.core.management import call_command

        django.setup()
        call_command("migrate", interactive=False, run_syncdb=True, verbosity=0)
    except Exception:
        print("Auto-migrate failed in passenger_wsgi.py", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)


_try_auto_migrate()

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
