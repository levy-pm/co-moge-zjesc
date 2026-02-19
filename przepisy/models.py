from django.db import models


class Przepis(models.Model):
    nazwa = models.CharField(max_length=200)
    skladniki = models.TextField()
    opis = models.TextField()
    czas = models.CharField(max_length=100, blank=True)
    tagi = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return self.nazwa


class Feedback(models.Model):
    ts = models.DateTimeField(auto_now_add=True)
    user_text = models.TextField(blank=True)
    option1_title = models.CharField(max_length=255, blank=True)
    option1_recipe_id = models.IntegerField(null=True, blank=True)
    option2_title = models.CharField(max_length=255, blank=True)
    option2_recipe_id = models.IntegerField(null=True, blank=True)
    action = models.CharField(max_length=20)
    chosen_index = models.IntegerField(null=True, blank=True)
    follow_up_answer = models.TextField(blank=True)

    def __str__(self):
        return f"{self.ts:%Y-%m-%d %H:%M} {self.action}"
