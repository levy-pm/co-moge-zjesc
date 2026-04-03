export const COMPANY_PROFILE = {
  brandName: "ZjedzTo",
  canonicalUrl: "https://co-moge-zjesc.pl",
  supportEmail: "kontakt@co-moge-zjesc.pl",
  operatorName: "Operator serwisu ZjedzTo",
  operatorNote:
    "Serwis prowadzony jest przez osobę prywatną. Pełne dane rejestrowe udostępniamy na żądanie w sprawach formalnych i prawnych.",
  formalAddress: "Dane adresowe podajemy mailowo w sprawach formalnych i prawnych.",
  taxIdNote:
    "Dane identyfikacyjne operatora są udostępniane w sprawach wymagających ich podania z mocy prawa.",
  responseTime: "2 dni robocze",
  lastUpdated: "1 kwietnia 2026",
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
      "Poniżej znajdziesz zasady korzystania z serwisu ZjedzTo — napisane po ludzku, bez prawniczego żargonu.",
    sections: [
      {
        heading: "1. Postanowienia ogólne",
        text: `Regulamin określa warunki korzystania z serwisu ${COMPANY_PROFILE.brandName} dostępnego pod adresem ${COMPANY_PROFILE.canonicalUrl} i stanowi umowę o świadczenie usług drogą elektroniczną w rozumieniu ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną (t.j. Dz.U. z 2020 r. poz. 344 ze zm.). Korzystanie z serwisu oznacza akceptację niniejszego regulaminu w obowiązującej wersji.`,
      },
      {
        heading: "2. Operator serwisu",
        text: `Serwis jest prowadzony przez osobę prywatną — ${COMPANY_PROFILE.operatorNote} W sprawach formalnych oraz dotyczących działania usługi skontaktuj się przez ${COMPANY_PROFILE.supportEmail}.`,
      },
      {
        heading: "3. Zakres usługi",
        text: `${COMPANY_PROFILE.brandName} to bezpłatny asystent kulinarny oparty na sztucznej inteligencji. Serwis umożliwia: generowanie propozycji dań i deserów na podstawie wpisanego opisu, zdjęcia składników lub zestawu filtrów (dieta, czas gotowania, poziom trudności, budżet, liczba składników); rozpoznawanie składników ze zdjęcia; zapisywanie historii zapytań, ulubionych propozycji i listy zakupów (po zalogowaniu). Usługa ma charakter informacyjny i inspiracyjny.`,
      },
      {
        heading: "4. Wymagania techniczne",
        text: "Do korzystania z serwisu wystarczy aktualna przeglądarka internetowa z obsługą JavaScript i dostęp do internetu. Korzystanie z funkcji przesyłania zdjęć wymaga możliwości dostępu przeglądarki do kamery lub plików na urządzeniu. Operator nie gwarantuje działania serwisu w przestarzałych przeglądarkach.",
      },
      {
        heading: "5. Treści generowane przez AI",
        text: "Propozycje dań i deserów są generowane automatycznie przez modele językowe i mogą zawierać błędy lub nieścisłości. Nie stanowią porady dietetycznej, medycznej ani gwarancji bezpieczeństwa żywności. Przy alergiach, nietolerancjach pokarmowych, chorobach lub specjalistycznych dietach zawsze samodzielnie weryfikuj składniki i sposób przygotowania oraz konsultuj się z odpowiednim specjalistą.",
      },
      {
        heading: "6. Konto użytkownika",
        text: "Rejestracja konta jest dobrowolna i bezpłatna. Konto umożliwia przechowywanie historii zapytań, ulubionych propozycji i listy zakupów. Użytkownik jest odpowiedzialny za poufność danych logowania i niezwłoczne poinformowanie operatora o podejrzeniu nieuprawnionego dostępu do konta. Operator może zawiesić lub usunąć konto w przypadku naruszenia regulaminu.",
      },
      {
        heading: "7. Zdjęcia i treści przesyłane przez użytkownika",
        text: "Przesyłając zdjęcie lub inne treści, użytkownik oświadcza, że jest uprawniony do ich udostępnienia i że nie naruszają one praw osób trzecich ani przepisów prawa. Zdjęcia są przetwarzane wyłącznie jednorazowo w celu rozpoznania składników. Nie przesyłaj zdjęć zawierających wizerunki osób, danych wrażliwych ani materiałów, których nie chcesz przekazywać do analizy przez zewnętrzne usługi AI.",
      },
      {
        heading: "8. Ograniczenie odpowiedzialności",
        text: "Operator nie ponosi odpowiedzialności za szkody wynikające z korzystania z propozycji wygenerowanych przez AI, w szczególności za skutki zastosowania sugerowanych przepisów bez samodzielnej weryfikacji składników i alergenów. Operator nie odpowiada za przerwy w dostępie do serwisu wynikające z przyczyn technicznych lub działania podmiotów zewnętrznych.",
      },
      {
        heading: "9. Zmiany regulaminu",
        text: `Operator zastrzega sobie prawo do zmiany regulaminu. O istotnych zmianach poinformujemy użytkowników zalogowanych drogą e-mailową lub komunikatem w serwisie. Zmiany wchodzą w życie z dniem wskazanym przy aktualizacji. Aktualna wersja regulaminu obowiązuje od ${COMPANY_PROFILE.lastUpdated}.`,
      },
    ],
  },
  privacy: {
    title: "Polityka prywatności",
    intro:
      "Przejrzyście opisujemy, jakie dane przetwarzamy, po co, jak długo i jakie masz prawa. Bez ukrytego druku.",
    sections: [
      {
        heading: "1. Administrator danych osobowych",
        text: `Administratorem danych osobowych użytkowników serwisu ${COMPANY_PROFILE.brandName} jest osoba prywatna prowadząca projekt. Kontakt w sprawach dotyczących prywatności i ochrony danych: ${COMPANY_PROFILE.supportEmail}. ${COMPANY_PROFILE.formalAddress}`,
      },
      {
        heading: "2. Jakie dane przetwarzamy",
        text: "Przetwarzamy wyłącznie dane niezbędne do działania serwisu: treść wpisywanych zapytań i wiadomości, informacje o aktywnych filtrach, zdjęcia przesłane do analizy składników (przetwarzane jednorazowo), adres e-mail i dane konta (jeśli użytkownik się zarejestruje), historię zapytań i listę ulubionych (dla zalogowanych użytkowników), dane sesyjne (identyfikator sesji, czas aktywności), logi bezpieczeństwa i techniczne (adres IP, znaczniki czasu). Nie zbieramy danych wrażliwych w rozumieniu art. 9 RODO.",
      },
      {
        heading: "3. Cel i podstawy prawne przetwarzania",
        text: "Dane przetwarzamy w następujących celach: świadczenie usługi generowania propozycji kulinarnych (art. 6 ust. 1 lit. b RODO — niezbędność do wykonania umowy/usługi), obsługa konta użytkownika (art. 6 ust. 1 lit. b RODO), zapewnienie bezpieczeństwa serwisu i ochrona przed nadużyciami (art. 6 ust. 1 lit. f RODO — uzasadniony interes administratora), diagnozowanie błędów i poprawa jakości usługi (art. 6 ust. 1 lit. f RODO). Nie przetwarzamy danych w celach marketingowych ani nie budujemy profili reklamowych.",
      },
      {
        heading: "4. Przekazywanie danych dostawcom AI",
        text: "Treść zapytań oraz zdjęcia przesłane do analizy mogą być przekazywane zewnętrznym dostawcom modeli AI wyłącznie w celu wygenerowania odpowiedzi. Dostawcy działają jako podmioty przetwarzające na podstawie stosownych umów. Dane przekazywane są w zakresie niezbędnym do realizacji usługi i nie są przez nich wykorzystywane do innych celów, w tym do budowania profili reklamowych.",
      },
      {
        heading: "5. Jak długo przechowujemy dane",
        text: "Zdjęcia przesłane do analizy są przetwarzane jednorazowo i nie są przechowywane dłużej niż wymaga obsługa pojedynczego żądania. Dane sesyjne są usuwane po wygaśnięciu sesji lub wyczyszczeniu ciasteczek. Historia zapytań i dane konta są przechowywane przez czas posiadania konta i usuwane na żądanie lub po 12 miesiącach od ostatniej aktywności. Logi bezpieczeństwa są przechowywane przez okres niezbędny do ochrony przed nadużyciami, nie dłużej niż 6 miesięcy.",
      },
      {
        heading: "6. Twoje prawa (RODO)",
        text: `Na podstawie RODO przysługują Ci: prawo dostępu do danych (art. 15), prawo do sprostowania danych (art. 16), prawo do usunięcia danych (art. 17), prawo do ograniczenia przetwarzania (art. 18), prawo do przenoszenia danych (art. 20), prawo do sprzeciwu wobec przetwarzania (art. 21). Aby skorzystać z któregokolwiek z tych praw, skontaktuj się z nami: ${COMPANY_PROFILE.supportEmail}. Odpowiemy w ciągu ${COMPANY_PROFILE.responseTime}.`,
      },
      {
        heading: "7. Prawo do skargi — Prezes UODO",
        text: "Jeśli uważasz, że przetwarzanie Twoich danych osobowych narusza przepisy RODO, masz prawo wnieść skargę do organu nadzorczego: Prezesa Urzędu Ochrony Danych Osobowych (UODO), ul. Stawki 2, 00-193 Warszawa, e-mail: kancelaria@uodo.gov.pl.",
      },
      {
        heading: "8. Bezpieczeństwo danych",
        text: "Stosujemy środki techniczne i organizacyjne odpowiednie do ryzyka związanego z przetwarzaniem danych, w tym szyfrowanie połączeń (HTTPS), kontrolę dostępu do danych i ograniczenie zakresu przetwarzanych informacji do niezbędnego minimum. Regularnie weryfikujemy stosowane zabezpieczenia.",
      },
    ],
  },
  cookies: {
    title: "Polityka cookies",
    intro:
      "Serwis stosuje wyłącznie pliki niezbędne do działania aplikacji. Zero śledzenia, zero reklam.",
    sections: [
      {
        heading: "1. Jakie pliki cookie stosujemy",
        text: "Stosujemy wyłącznie pliki cookie i równoważne mechanizmy techniczne niezbędne do działania serwisu: cookie sesyjne identyfikujące aktywną sesję użytkownika, cookie rate-limitujące chroniące przed nadmierną liczbą zapytań, cookie zapamiętujące decyzję dotyczącą banera informacyjnego o cookies. Wszystkie wymienione mechanizmy są niezbędne technicznie i nie wymagają dodatkowej zgody zgodnie z art. 173 ust. 3 ustawy Prawo telekomunikacyjne.",
      },
      {
        heading: "2. Czego NIE stosujemy",
        text: "Serwis nie używa plików cookie reklamowych, marketingowych ani zewnętrznych trackerów analitycznych (jak Google Analytics, Meta Pixel, Hotjar itp.). Nie śledzisz swoich użytkowników między stronami. Nie sprzedajemy ani nie udostępniamy danych o zachowaniach użytkowników podmiotom trzecim w celach reklamowych.",
      },
      {
        heading: "3. Zarządzanie plikami cookie",
        text: "Możesz usunąć lub zablokować pliki cookie w ustawieniach swojej przeglądarki. Pamiętaj, że wyłączenie cookie sesyjnych może uniemożliwić korzystanie z czatu, uploadu zdjęć i funkcji konta, a wyłączenie cookie rate-limitujących może skutkować blokadą ochrony antynadużyciowej. Instrukcje zarządzania cookies znajdziesz w dokumentacji swojej przeglądarki (Chrome, Firefox, Safari, Edge).",
      },
      {
        heading: "4. Aktualizacja polityki",
        text: `W przypadku wprowadzenia nowych mechanizmów śledzenia lub zmiany zakresu stosowanych cookies zaktualizujemy niniejszą politykę i poinformujemy o tym w serwisie. Aktualna wersja polityki cookies obowiązuje od ${COMPANY_PROFILE.lastUpdated}. Pytania: ${COMPANY_PROFILE.supportEmail}.`,
      },
    ],
  },
};

export const INFO_PAGE_CONTENT = {
  faq: {
    title: "FAQ",
    intro: "Najczęstsze pytania i konkretne odpowiedzi. Bez ściemy.",
    sections: [
      {
        heading: "Co najlepiej wpisać, żeby dostać trafne propozycje?",
        text: "Krótkie, naturalne zdanie działa najlepiej: \"mam kurczaka, paprykę i ryż, chcę coś szybkiego\" albo \"śniadanie bez laktozy, do 20 minut\". Im konkretniej opiszesz sytuację, tym lepiej AI dopasuje propozycję. Możesz też po prostu wpisać listę składników.",
      },
      {
        heading: "Jak działa rozpoznawanie składników ze zdjęcia?",
        text: "Wrzuć zdjęcie lodówki, blatu lub samych produktów — AI spróbuje rozpoznać widoczne składniki. Po chwili zobaczysz podgląd wykrytych produktów, które możesz skorygować przed wysłaniem wiadomości. Zdjęcie jest analizowane jednorazowo i nie jest przechowywane.",
      },
      {
        heading: "Czy filtry naprawdę wpływają na wynik?",
        text: "Tak, i to mocno. Aktywne filtry (dieta, czas gotowania, poziom trudności, budżet, liczba składników) mają pierwszeństwo przed treścią wiadomości — AI stosuje je jako twarde ograniczenia, nie tylko sugestie. Jeśli wyniki wydają się niespójne, sprawdź czy jakiś filtr nie jest przypadkowo włączony.",
      },
      {
        heading: "Skąd pochodzą propozycje dań?",
        text: "Propozycje są generowane przez modele językowe AI na podstawie Twojego zapytania, aktywnych filtrów i historii rozmowy. Nie są losowe — AI stara się tworzyć realne, wykonalne przepisy. Mimo to wyniki mogą się różnić przy tym samym zapytaniu, bo tak działają modele generatywne.",
      },
      {
        heading: "Czy to jest porada dietetyczna albo medyczna?",
        text: "Nie. ZjedzTo to narzędzie do inspiracji kulinarnych, a nie serwis dietetyczny. Przy alergiach, nietolerancjach pokarmowych, chorobach lub specjalnych dietach zawsze weryfikuj składniki samodzielnie i konsultuj się z lekarzem lub dietetykiem przed zastosowaniem sugestii.",
      },
      {
        heading: "Czy mogę korzystać bez konta?",
        text: "Tak. Z czatu możesz korzystać bez rejestracji — historia rozmowy jest przechowywana lokalnie w przeglądarce. Konto przyda się, jeśli chcesz mieć dostęp do historii, ulubionych i listy zakupów na różnych urządzeniach.",
      },
      {
        heading: "Co zyskuję zakładając konto?",
        text: "Historia zapytań synchronizowana między urządzeniami, możliwość zapisywania ulubionych propozycji i tworzenia listy zakupów. Rejestracja jest bezpłatna i dobrowolna — bez niej też działa cały czat.",
      },
      {
        heading: "Czy aplikacja jest płatna?",
        text: "Nie. ZjedzTo jest bezpłatne i nie wymaga podawania danych płatniczych. Jeśli w przyszłości pojawią się płatne funkcje, poinformujemy o tym z wyprzedzeniem.",
      },
    ],
  },
  how: {
    title: "Jak to działa",
    intro: "Od składników do pomysłu na danie w kilku krokach — oto co dzieje się po Twojej stronie i za kulisami.",
    sections: [
      {
        heading: "1. Wybierz tryb: posiłek lub deser",
        text: "Na starcie decydujesz, czy szukasz obiadu, kolacji, śniadania — czy może masz ochotę na coś słodkiego. Tryb wpływa na kategorię propozycji i dobór filtrów widocznych w interfejsie.",
      },
      {
        heading: "2. Opisz, co masz lub czego szukasz",
        text: "Wpisz w czacie co masz w lodówce, na co masz ochotę albo jakie masz ograniczenia. Nie musisz pisać formalnie — wystarczy \"kurczak, cebula, trochę śmietany, chcę coś sycącego\" albo \"wegetariańskie, do 30 minut, nie za ostro\".",
      },
      {
        heading: "3. Ustaw filtry (opcjonalnie)",
        text: "Jeśli masz konkretne wymagania, ustaw je filtrami: dieta (wegetariańska, wegańska, keto, bezglutenowa i inne), czas gotowania, poziom trudności, budżet na porcję, maksymalna liczba składników. Filtry działają jak twarde reguły — AI nie naruszy żadnego z aktywnych ograniczeń.",
      },
      {
        heading: "4. Dodaj zdjęcie składników (opcjonalnie)",
        text: "Sfotografuj lodówkę lub blat z produktami — AI rozpozna widoczne składniki i automatycznie uwzględni je w następnej propozycji. Możesz przejrzeć i poprawić listę wykrytych produktów przed wysłaniem wiadomości.",
      },
      {
        heading: "5. AI generuje 2 propozycje",
        text: "Po chwili dostajesz dwie konkretne propozycje dania lub deseru: nazwę, krótki opis, szacowany czas i podstawowe składniki. Możesz dopytać o szczegóły, poprosić o wariant lub po prostu wysłać kolejną wiadomość z nowym pomysłem.",
      },
      {
        heading: "6. Zapisz, co Ci się spodobało",
        text: "Ulubione propozycje możesz dodać do ulubionych i listy zakupów — lokalnie w przeglądarce lub na koncie, jeśli się zalogowałeś. Historia rozmowy zostaje do końca sesji, żebyś mógł wrócić do wcześniejszych pomysłów.",
      },
    ],
  },
  about: {
    title: "O projekcie",
    intro:
      "ZjedzTo powstało z prostego pomysłu: skrócić drogę od \"co tu mam w lodówce\" do gotowania.",
    sections: [
      {
        heading: "Dlaczego powstało ZjedzTo",
        text: "Stanie przed otwartą lodówką i myślenie \"co z tego ugotować\" zajmuje za dużo czasu i kończy się często zamawianiem jedzenia albo zmarnowanymi składnikami. ZjedzTo ma być jak dobry znajomy szef kuchni — mówisz mu co masz, a on w sekundę podaje kilka sensownych pomysłów.",
      },
      {
        heading: "Co chcemy osiągnąć",
        text: "Mniejsze marnowanie jedzenia, szybsze decyzje kulinarne i niższy próg wejścia dla osób, które nie chcą przeglądać dziesiątek przepisów online. Chcemy też, żeby aplikacja działała równie dobrze dla kogoś gotującego codziennie, jak i dla osoby, która dopiero zaczyna przygodę z gotowaniem.",
      },
      {
        heading: "Jak podchodzimy do jakości",
        text: "Stawiamy na prosty, szybki interfejs i minimalizację pustych ekranów. Kiedy AI nie jest pewna wyniku — mówi o tym wprost zamiast zwracać coś byle jakiego. Zbieramy opinie, poprawiamy trafność propozycji i stopniowo dodajemy funkcje, które naprawdę są potrzebne.",
      },
      {
        heading: "Gdzie jesteśmy teraz",
        text: "Kwiecień 2026 — jesteśmy w publicznej wersji beta. Czat działa, zdjęcia działają, filtry działają. Pracujemy nad dokładniejszym dopasowaniem propozycji, lepszą obsługą zdjęć i fundamentami pod trwałe konto użytkownika. Jeśli napotkasz błąd lub masz pomysł — napisz, naprawdę czytamy każdą wiadomość.",
      },
    ],
  },
  contact: {
    title: "Kontakt",
    intro: "Piszemy mailowo — zbieramy pytania, opinie, zgłoszenia błędów i tematy związane z prywatnością.",
    sections: [
      {
        heading: "Kontakt główny",
        text: `${COMPANY_PROFILE.operatorName}\nE-mail: ${COMPANY_PROFILE.supportEmail}\nCzas odpowiedzi: do ${COMPANY_PROFILE.responseTime}`,
      },
      {
        heading: "W jakich sprawach pisać",
        list: [
          "błędy w działaniu czatu, uploadu zdjęcia lub filtrów",
          "uwagi do jakości i trafności propozycji dań i deserów",
          "pytania o prywatność, bezpieczeństwo danych i prawa RODO",
          "prośby o usunięcie konta lub danych",
          "pomysły na nowe funkcje i ogólny feedback",
          "współpraca, testy produktu, kontakt dla mediów",
        ],
      },
      {
        heading: "Informacja formalna",
        text: `Serwis prowadzony jest przez osobę prywatną. ${COMPANY_PROFILE.formalAddress} ${COMPANY_PROFILE.taxIdNote} W sprawach formalnych i prawnych odpiszemy w terminie wymaganym przez przepisy.`,
      },
    ],
  },
};
