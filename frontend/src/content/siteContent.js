export const COMPANY_PROFILE = {
  brandName: "Co mogę zjeść?",
  canonicalUrl: "https://co-moge-zjesc.pl",
  supportEmail: "kontakt@co-moge-zjesc.pl",
  operatorName: "Zespół projektu Co mogę zjeść",
  operatorNote:
    "Pełne dane operatora opublikujemy przed uruchomieniem płatnych planów.",
  formalAddress: "Dane adresowe udostępniamy mailowo w sprawach formalnych i prawnych.",
  taxIdNote:
    "Numer identyfikacyjny operatora zostanie podany przed komercyjnym wdrożeniem serwisu.",
  responseTime: "2 dni robocze",
  lastUpdated: "13 marca 2026",
};

export const FOOTER_LINK_GROUPS = [
  {
    label: "Serwis",
    links: [
      { href: "/jak-to-dziala", label: "Jak to działa" },
      { href: "/faq", label: "FAQ" },
      { href: "/o-projekcie", label: "O projekcie" },
    ],
  },
  {
    label: "Zaufanie",
    links: [
      { href: "/legal/terms", label: "Regulamin" },
      { href: "/legal/privacy", label: "Polityka prywatności" },
      { href: "/legal/cookies", label: "Polityka cookies" },
      { href: "/contact", label: "Kontakt" },
    ],
  },
];

export const LEGAL_PAGE_CONTENT = {
  terms: {
    title: "Regulamin serwisu",
    intro:
      "Poniżej opisujemy zasady korzystania z aplikacji Co mogę zjeść? w wersji publicznej dostępnej online.",
    sections: [
      {
        heading: "1. Zakres usługi",
        text: `Serwis ${COMPANY_PROFILE.brandName} pomaga znaleźć propozycje dań i deserów na podstawie wiadomości tekstowej, filtrów oraz zdjęć składników. Usługa ma charakter informacyjny i inspiracyjny.`,
      },
      {
        heading: "2. Operator serwisu",
        text: `${COMPANY_PROFILE.operatorName} odpowiada za rozwój i utrzymanie serwisu. ${COMPANY_PROFILE.operatorNote} W sprawach formalnych lub dotyczących działania usługi skontaktuj się przez ${COMPANY_PROFILE.supportEmail}.`,
      },
      {
        heading: "3. Jak działa AI",
        text: "Sugestie są generowane automatycznie na podstawie treści wpisanej przez użytkownika, aktywnych filtrów, historii rozmowy oraz - jeśli użytkownik skorzysta z tej opcji - rozpoznanych składników ze zdjęcia. Wyniki mogą wymagać dodatkowej weryfikacji przez użytkownika.",
      },
      {
        heading: "4. Ograniczenia odpowiedzialności",
        text: "Propozycje nie stanowią porady dietetycznej, medycznej ani gwarancji bezpieczeństwa żywności. Przy alergiach, nietolerancjach i szczególnych potrzebach żywieniowych zawsze zweryfikuj składniki, zamienniki i sposób przygotowania przed gotowaniem.",
      },
      {
        heading: "5. Zdjęcia i treści użytkownika",
        text: "Zdjęcia są wykorzystywane wyłącznie do rozpoznawania składników i wygenerowania sugestii. Nie przesyłaj materiałów naruszających prawo, prawa osób trzecich ani zawierających dane, których nie chcesz przekazywać do analizy przez usługę AI.",
      },
      {
        heading: "6. Zmiany w serwisie",
        text: `Serwis jest rozwijany iteracyjnie. Możemy aktualizować zakres funkcji, sposób prezentacji wyników i niniejsze zasady. Aktualna wersja regulaminu obowiązuje od ${COMPANY_PROFILE.lastUpdated}.`,
      },
    ],
  },
  privacy: {
    title: "Polityka prywatności",
    intro:
      "Opisujemy, jakie dane przetwarzamy, po co są potrzebne i jak dbamy o bezpieczeństwo użytkowników.",
    sections: [
      {
        heading: "1. Administrator i kontakt",
        text: `${COMPANY_PROFILE.operatorName} odpowiada za organizację przetwarzania danych w serwisie. Kontakt w sprawach prywatności i bezpieczeństwa: ${COMPANY_PROFILE.supportEmail}. ${COMPANY_PROFILE.formalAddress}`,
      },
      {
        heading: "2. Jakie dane przetwarzamy",
        text: "Przetwarzamy treść wpisywanych zapytań, informacje o aktywnych filtrach, anonimowe dane sesyjne, podstawowe logi bezpieczeństwa oraz zdjęcia przesłane do analizy składników. Dane są ograniczane do zakresu potrzebnego do działania aplikacji i ochrony przed nadużyciami.",
      },
      {
        heading: "3. Cel przetwarzania",
        text: "Dane są wykorzystywane do wygenerowania sugestii kulinarnych, rozpoznawania produktów ze zdjęć, utrzymania sesji, ograniczania nadużyć, diagnozowania błędów oraz poprawy jakości działania produktu.",
      },
      {
        heading: "4. Modele AI i podwykonawcy",
        text: "Treść zapytań i zdjęcia mogą być przekazywane zewnętrznym dostawcom modeli AI wyłącznie w celu wygenerowania odpowiedzi. Nie wykorzystujemy tych danych do budowania profilu reklamowego użytkownika.",
      },
      {
        heading: "5. Okres przechowywania",
        text: "Dane sesyjne i techniczne są przechowywane przez ograniczony czas potrzebny do działania serwisu i bezpieczeństwa. Zdjęcia służą do jednorazowej analizy składników i nie są przechowywane dłużej niż wymaga tego obsługa pojedynczego żądania.",
      },
      {
        heading: "6. Twoje prawa",
        text: `Możesz skontaktować się z nami w sprawie dostępu do danych, sprostowania, ograniczenia przetwarzania lub usunięcia danych. Najszybsza droga kontaktu: ${COMPANY_PROFILE.supportEmail}.`,
      },
    ],
  },
  cookies: {
    title: "Polityka cookies",
    intro:
      "Serwis wykorzystuje wyłącznie mechanizmy potrzebne do poprawnego działania sesji i zapamiętania podstawowych preferencji.",
    sections: [
      {
        heading: "1. Jakie pliki stosujemy",
        text: "Używamy wyłącznie cookies lub równoważnych mechanizmów niezbędnych do działania aplikacji: utrzymania sesji użytkownika, ochrony limitów zapytań oraz zapamiętania decyzji dotyczącej banera cookies.",
      },
      {
        heading: "2. Czego nie stosujemy",
        text: "Nie używamy cookies marketingowych, reklamowych ani zewnętrznych trackerów do śledzenia zachowań między stronami.",
      },
      {
        heading: "3. Jak zarządzać ustawieniami",
        text: "Możesz usunąć lub zablokować cookies w ustawieniach przeglądarki. Pamiętaj, że wyłączenie cookies sesyjnych może ograniczyć działanie czatu, uploadu zdjęć i zabezpieczeń antynadużyciowych.",
      },
      {
        heading: "4. Kontakt",
        text: `W pytaniach dotyczących cookies lub prywatności napisz na ${COMPANY_PROFILE.supportEmail}. Aktualizacja polityki: ${COMPANY_PROFILE.lastUpdated}.`,
      },
    ],
  },
};

export const INFO_PAGE_CONTENT = {
  faq: {
    title: "FAQ",
    intro: "Najczęstsze pytania użytkowników i krótkie odpowiedzi bez prawniczego języka.",
    sections: [
      {
        heading: "Co mogę wpisać?",
        text: "Najlepiej działają krótkie, naturalne wiadomości: składniki z lodówki, oczekiwany czas, typ dania albo ograniczenia typu bez glutenu czy do 20 minut.",
      },
      {
        heading: "Czy mogę dodać zdjęcie?",
        text: "Tak. Możesz dodać zdjęcie lodówki, blatu lub samych składników. AI spróbuje rozpoznać produkty i na tej podstawie zaproponuje kierunek przepisu.",
      },
      {
        heading: "Czy filtry naprawdę wpływają na wynik?",
        text: "Tak. Aktywne filtry trafiają do logiki generowania odpowiedzi i mają priorytet nad ogólnym opisem w wiadomości, gdy oba źródła są ze sobą sprzeczne.",
      },
      {
        heading: "Skąd pochodzą propozycje?",
        text: "Część wyników pochodzi z naszej bazy przepisów, a część z generowania wspieranego przez modele AI. Gdy szczegóły przepisu są niepełne, pokazujemy bezpieczny fallback zamiast pustego ekranu.",
      },
      {
        heading: "Czy to porada dietetyczna?",
        text: "Nie. To narzędzie do inspiracji kulinarnych. Przy alergiach, chorobach lub specjalistycznych dietach skonsultuj wynik z odpowiednim specjalistą i sprawdź składniki samodzielnie.",
      },
      {
        heading: "Czy mogę zapisać przepis?",
        text: "Tak, w obecnej wersji możesz zapisać ulubione, ostatnie wyszukiwania i listę zakupów lokalnie na swoim urządzeniu. To fundament pod późniejsze konto użytkownika.",
      },
    ],
  },
  how: {
    title: "Jak to działa",
    intro: "Krótki przewodnik po tym, co dzieje się po wpisaniu wiadomości lub dodaniu zdjęcia.",
    sections: [
      {
        heading: "1. Dane wejściowe od użytkownika",
        text: "Wybierasz tryb posiłku lub deseru, wpisujesz wiadomość, opcjonalnie ustawiasz filtry i możesz dodać zdjęcie składników.",
      },
      {
        heading: "2. Rola AI",
        text: "AI porządkuje kontekst, rozpoznaje składniki ze zdjęcia i generuje 2 propozycje dań albo deserów zgodnych z aktywnymi ograniczeniami.",
      },
      {
        heading: "3. Jak działają filtry",
        text: "Filtry takie jak dieta, czas, trudność, budżet i limit składników są przekazywane do warstwy generowania. Jeśli są sprzeczne z ogólną wiadomością, pierwszeństwo mają ustawione filtry.",
      },
      {
        heading: "4. Ograniczenia systemu",
        text: "Model może się mylić, dlatego przy nietypowych ograniczeniach lub nieczytelnym zdjęciu czasem poprosimy o doprecyzowanie. Wyniki są sugestiami, a nie gwarancją zgodności dietetycznej.",
      },
      {
        heading: "5. Co robi funkcja zdjęcia",
        text: "Zdjęcie służy do rozpoznania widocznych składników. Po analizie pokazujemy podgląd, status przetwarzania i listę wykrytych produktów, które możesz poprawić przed kolejną wiadomością.",
      },
    ],
  },
  about: {
    title: "O projekcie",
    intro:
      "Co mogę zjeść? powstało po to, żeby skrócić drogę od \"mam kilka składników\" do konkretnego pomysłu na posiłek.",
    sections: [
      {
        heading: "Po co istnieje ten produkt",
        text: "Chcemy ułatwiać codzienne decyzje kulinarne, ograniczać marnowanie jedzenia i obniżać próg wejścia dla osób, które nie chcą przeglądać dziesiątek stron z przepisami.",
      },
      {
        heading: "Jak podchodzimy do jakości",
        text: "Stawiamy na prosty interfejs, czytelne stany błędów, możliwie mało martwych ekranów i jasne komunikaty, kiedy wynik wymaga dodatkowej weryfikacji.",
      },
      {
        heading: "Na jakim etapie jest projekt",
        text: `${COMPANY_PROFILE.operatorNote} W tej wersji skupiamy się na trafniejszym dopasowaniu propozycji, lepszym flow zdjęcia i fundamentach pod funkcje retencyjne.`,
      },
    ],
  },
  contact: {
    title: "Kontakt",
    intro: "Najprościej skontaktować się z nami mailowo. Zbieramy pytania produktowe, zgłoszenia błędów i tematy związane z prywatnością.",
    sections: [
      {
        heading: "Kontakt główny",
        text: `${COMPANY_PROFILE.operatorName}\nE-mail: ${COMPANY_PROFILE.supportEmail}\nCzas odpowiedzi: do ${COMPANY_PROFILE.responseTime}`,
      },
      {
        heading: "W jakich sprawach pisać",
        list: [
          "błędy w działaniu czatu lub uploadu zdjęcia",
          "uwagi do jakości propozycji dań i deserów",
          "pytania o prywatność i bezpieczeństwo danych",
          "współpraca lub testy produktu",
        ],
      },
      {
        heading: "Informacja formalna",
        text: `${COMPANY_PROFILE.formalAddress}\n${COMPANY_PROFILE.taxIdNote}`,
      },
    ],
  },
};
