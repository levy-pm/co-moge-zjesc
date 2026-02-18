from django.db import models

class Przepis(models.Model):
    nazwa = models.CharField(max_length=200)
    skladniki = models.TextField()
    opis = models.TextField()
    czas = models.CharField(max_length=100, blank=True)
    tagi = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return self.nazwa