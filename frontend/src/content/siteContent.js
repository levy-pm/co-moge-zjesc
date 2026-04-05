export const COMPANY_PROFILE = {
  brandName: "ZjedzTo",
  canonicalUrl: "https://co-moge-zjesc.pl",
  supportEmail: "kontakt@co-moge-zjesc.pl",
  operatorName: "Krzysztof Lewandowski",
  operatorAddress: "Grabowiec 68a, 87-124 Złotoria",
  operatorPhone: "+48 514-180-841",
  responseTime: "1 miesiąc",
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
        text: `Operatorem serwisu jest ${COMPANY_PROFILE.operatorName}, ${COMPANY_PROFILE.operatorAddress}. Kontakt: ${COMPANY_PROFILE.supportEmail}, tel. ${COMPANY_PROFILE.operatorPhone}. Operator nie prowadzi działalności gospodarczej wpisanej do rejestru przedsiębiorców. W sprawach formalnych i prawnych odpiszemy w terminie wymaganym przez przepisy.`,
      },
      {
        heading: "3. Zakres usługi",
        text: `${COMPANY_PROFILE.brandName} to bezpłatny asystent kulinarny oparty na sztucznej inteligencji. Serwis umożliwia: generowanie propozycji dań i deserów na podstawie wpisanego opisu, zdjęcia składników lub zestawu filtrów (dieta, czas gotowania, poziom trudności, budżet, liczba składników); rozpoznawanie składników ze zdjęcia; zapisywanie ulubionych propozycji, listy zakupów i własnych przepisów po zalogowaniu. Ostatnie wyszukiwania mogą być przechowywane lokalnie w przeglądarce użytkownika. Usługa ma charakter informacyjny i inspiracyjny.`,
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
        text: "Rejestracja konta jest dobrowolna i bezpłatna. Konto umożliwia zapisywanie ulubionych propozycji, listy zakupów i własnych przepisów. Ostatnie wyszukiwania pozostają lokalnie w przeglądarce użytkownika. Użytkownik jest odpowiedzialny za poufność danych logowania i niezwłoczne poinformowanie operatora o podejrzeniu nieuprawnionego dostępu do konta. Operator może zawiesić lub usunąć konto w przypadku naruszenia regulaminu.",
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
        heading: "9. Zakaz treści bezprawnych",
        text: `Użytkownik zobowiązuje się do nieumieszczania w serwisie treści o charakterze bezprawnym, w szczególności treści naruszających prawa osób trzecich, zawierających mowę nienawiści, treści wulgarnych lub sprzecznych z dobrymi obyczajami, a także do niestosowania serwisu w celach niezgodnych z prawem. Operator, po powzięciu wiadomości o bezprawnym charakterze danych lub treści, podejmuje niezwłoczne działania zmierzające do ich usunięcia albo uniemożliwienia dostępu do nich, zgodnie z art. 14 ustawy o świadczeniu usług drogą elektroniczną.`,
      },
      {
        heading: "10. Tryb reklamacyjny",
        text: `Reklamacje dotyczące niewykonania lub nienależytego wykonania usługi należy składać na adres e-mail: ${COMPANY_PROFILE.supportEmail}. Reklamacja powinna zawierać: opis problemu, datę i okoliczności jego wystąpienia oraz dane kontaktowe zgłaszającego. Operator rozpatruje reklamację w terminie 14 dni od jej otrzymania i informuje zgłaszającego o sposobie jej rozpatrzenia drogą e-mailową. Jeżeli reklamacja nie może być rozpatrzona w tym terminie, Operator powiadomi zgłaszającego o przewidywanym czasie rozpatrzenia.`,
      },
      {
        heading: "11. Rozwiązanie umowy",
        text: `Umowa o świadczenie usługi drogą elektroniczną w zakresie korzystania z serwisu bez rejestracji konta wygasa z chwilą zamknięcia przeglądarki lub zakończenia sesji. Użytkownik posiadający konto może w każdym czasie usunąć konto, co jest równoznaczne z rozwiązaniem umowy o świadczenie usług w zakresie konta — w tym celu należy skontaktować się z Operatorem na adres ${COMPANY_PROFILE.supportEmail} lub skorzystać z funkcji usunięcia konta dostępnej w ustawieniach. Operator może rozwiązać umowę ze skutkiem natychmiastowym w przypadku rażącego naruszenia regulaminu przez użytkownika.`,
      },
      {
        heading: "12. Minimalny wiek użytkownika",
        text: "Korzystanie z serwisu, a w szczególności rejestracja konta, jest dozwolone dla osób, które ukończyły 16 lat. Osoby niepełnoletnie poniżej 16. roku życia mogą korzystać z serwisu wyłącznie za zgodą i pod nadzorem rodzica lub opiekuna prawnego. Rejestrując konto, użytkownik potwierdza, że spełnia powyższy wymóg wiekowy.",
      },
      {
        heading: "13. Zmiany regulaminu",
        text: `Operator zastrzega sobie prawo do zmiany regulaminu. O istotnych zmianach poinformujemy użytkowników zalogowanych drogą e-mailową lub komunikatem w serwisie. Zmiany wchodzą w życie z dniem wskazanym przy aktualizacji. Aktualna wersja regulaminu obowiązuje od ${COMPANY_PROFILE.lastUpdated}.`,
      },
    ],
  },
  privacy: {
    title: "Polityka prywatności",
    intro:
      "Niniejsza Polityka Prywatności opisuje zasady przetwarzania danych osobowych w serwisie ZjedzTo, obowiązuje od 1 kwietnia 2026 r. i została sporządzona zgodnie z wymogami Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (RODO).",
    sections: [
      {
        heading: "1. Administrator danych osobowych i dane kontaktowe",
        text: `Administratorem danych osobowych użytkowników serwisu ${COMPANY_PROFILE.brandName} dostępnego pod adresem ${COMPANY_PROFILE.canonicalUrl} jest ${COMPANY_PROFILE.operatorName}, ${COMPANY_PROFILE.operatorAddress} (dalej: „Administrator"). Kontakt w sprawach dotyczących ochrony danych osobowych: ${COMPANY_PROFILE.supportEmail}, tel. ${COMPANY_PROFILE.operatorPhone}. Administrator nie wyznaczył Inspektora Ochrony Danych Osobowych — w sprawach ochrony danych osobowych należy kontaktować się bezpośrednio z Administratorem.`,
      },
      {
        heading: "2. Zakres przetwarzanych danych osobowych",
        text: "Administrator przetwarza następujące kategorie danych: (a) dane podawane przez użytkownika — treść wpisywanych zapytań i wiadomości, informacje o aktywnych filtrach, zdjęcia przesłane do analizy składników; (b) dane konta — adres e-mail i hasło (wyłącznie w przypadku dobrowolnej rejestracji), lista ulubionych propozycji, lista zakupów i własne przepisy zapisane przez użytkownika; (c) dane techniczne — identyfikator sesji, adres IP, znaczniki czasu, logi bezpieczeństwa; (d) dane przechowywane lokalnie w przeglądarce — ostatnie wyszukiwania oraz informacja o zamknięciu bannera cookies. Administrator nie przetwarza danych osobowych szczególnych kategorii, o których mowa w art. 9 RODO.",
      },
      {
        heading: "3. Cele i podstawy prawne przetwarzania",
        text: "Dane osobowe są przetwarzane w następujących celach i na następujących podstawach prawnych: (1) świadczenie usługi generowania propozycji kulinarnych oraz obsługa konta użytkownika — art. 6 ust. 1 lit. b RODO (niezbędność do wykonania umowy o świadczenie usług drogą elektroniczną); (2) zapewnienie bezpieczeństwa serwisu, ochrona przed nadużyciami oraz zapobieganie nieuprawnionemu dostępowi — art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes Administratora); (3) diagnozowanie błędów i poprawa jakości usługi — art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes Administratora). Dane nie są przetwarzane w celach marketingowych ani w celu profilowania na potrzeby reklamy.",
      },
      {
        heading: "4. Zewnętrzni dostawcy AI i transfer danych do państw trzecich",
        text: "Treść zapytań tekstowych oraz zdjęcia przesłane do analizy składników są przekazywane następującym zewnętrznym dostawcom modeli sztucznej inteligencji: (1) Groq, Inc. z siedzibą w USA — dostawca infrastruktury obliczeniowej do obsługi modeli językowych; (2) Google LLC z siedzibą w USA — dostawca modeli Gemini, w tym funkcji rozpoznawania składników ze zdjęcia. Obaj dostawcy mają siedzibę w Stanach Zjednoczonych, czyli poza Europejskim Obszarem Gospodarczym (EOG). Transfer danych do tych podmiotów odbywa się na podstawie Standardowych Klauzul Umownych (SCC) zatwierdzonych przez Komisję Europejską zgodnie z art. 46 ust. 2 lit. c RODO. Użytkownik może zapoznać się z politykami prywatności tych dostawców: Groq — https://groq.com/privacy-policy; Google — https://policies.google.com/privacy. Zakres przekazywanych danych ograniczamy do treści niezbędnych do obsługi pojedynczego żądania — dane nie są przekazywane w celach reklamowych ani analitycznych.",
      },
      {
        heading: "5. Zewnętrzne zasoby strony — Google Fonts",
        text: "Serwis ładuje kroje pisma (czcionki) z zewnętrznych serwerów Google LLC (fonts.googleapis.com, fonts.gstatic.com). Przy każdym wywołaniu strony przeglądarka użytkownika nawiązuje połączenie z serwerami Google, co wiąże się z przekazaniem adresu IP użytkownika do Google LLC z siedzibą w USA. Przetwarzanie danych przez Google w związku z usługą Google Fonts odbywa się na podstawie polityki prywatności Google (https://policies.google.com/privacy). Przekazanie adresu IP następuje na podstawie uzasadnionego interesu Administratora (art. 6 ust. 1 lit. f RODO) polegającego na zapewnieniu jednolitego wyglądu serwisu. Administrator rozważa migrację na lokalne serwowanie czcionek w celu wyeliminowania tego transferu.",
      },
      {
        heading: "6. Okresy przechowywania danych",
        text: "Zdjęcia przesłane do analizy przetwarzane są jednorazowo w ramach obsługi pojedynczego żądania i nie są przechowywane po jego zakończeniu. Dane sesyjne przechowywane są przez czas trwania sesji i usuwane niezwłocznie po jej wygaśnięciu. Dane konta użytkownika, ulubione propozycje, listy zakupów i własne przepisy są przechowywane do czasu usunięcia konta albo zgłoszenia żądania usunięcia danych. Ostatnie wyszukiwania i decyzja o zamknięciu bannera cookies mogą być zapisane lokalnie w przeglądarce użytkownika. Logi bezpieczeństwa i techniczne przechowujemy przez okres niezbędny do wykrywania nadużyć i diagnozowania błędów.",
      },
      {
        heading: "7. Dobrowolność podania danych",
        text: "Podanie danych osobowych jest dobrowolne, jednak niezbędne do korzystania z odpowiednich funkcji serwisu: adres e-mail jest wymagany do rejestracji konta i jest warunkiem zawarcia umowy w tym zakresie (bez jego podania rejestracja jest niemożliwa); dane wpisywane w czacie (opisy składników, preferencje) są konieczne do wygenerowania propozycji kulinarnych; zdjęcia składników są wymagane wyłącznie przy korzystaniu z funkcji rozpoznawania składników. Korzystanie z serwisu bez rejestracji konta nie wymaga podawania żadnych danych osobowych.",
      },
      {
        heading: "8. Zautomatyzowane przetwarzanie danych",
        text: "Propozycje dań i deserów generowane są w sposób zautomatyzowany przez modele językowe sztucznej inteligencji na podstawie treści wpisanych przez użytkownika oraz aktywnych filtrów. Przetwarzanie to nie stanowi profilowania w rozumieniu art. 4 pkt 4 RODO ani zautomatyzowanego podejmowania decyzji wywołującego skutki prawne lub w podobny sposób istotnie wpływającego na użytkownika — ma wyłącznie charakter informacyjny i inspiracyjny.",
      },
      {
        heading: "9. Prawa osób, których dane dotyczą",
        text: `Na podstawie przepisów RODO osobie, której dane dotyczą, przysługują następujące prawa: prawo dostępu do danych (art. 15 RODO), prawo do sprostowania danych (art. 16 RODO), prawo do usunięcia danych (art. 17 RODO), prawo do ograniczenia przetwarzania (art. 18 RODO), prawo do przenoszenia danych (art. 20 RODO), prawo do wniesienia sprzeciwu wobec przetwarzania (art. 21 RODO). W celu skorzystania z powyższych praw należy skierować żądanie na adres: ${COMPANY_PROFILE.supportEmail}. Administrator udziela odpowiedzi bez zbędnej zwłoki, nie później niż w terminie ${COMPANY_PROFILE.responseTime} od dnia otrzymania żądania; w uzasadnionych przypadkach termin ten może zostać przedłużony o kolejne dwa miesiące, o czym Administrator powiadomi zgłaszającego (art. 12 ust. 3 RODO).`,
      },
      {
        heading: "10. Prawo wniesienia skargi do organu nadzorczego",
        text: "Osobie, której dane dotyczą, przysługuje prawo wniesienia skargi do organu nadzorczego właściwego w sprawach ochrony danych osobowych, tj. do Prezesa Urzędu Ochrony Danych Osobowych (UODO), ul. Stawki 2, 00-193 Warszawa, e-mail: kancelaria@uodo.gov.pl, w przypadku uznania, że przetwarzanie danych osobowych przez Administratora narusza przepisy RODO.",
      },
      {
        heading: "11. Środki bezpieczeństwa",
        text: "Administrator stosuje techniczne i organizacyjne środki ochrony danych adekwatne do ryzyka związanego z ich przetwarzaniem, w tym szyfrowanie transmisji danych przy użyciu protokołu HTTPS, kontrolę dostępu do systemów przetwarzających dane osobowe oraz ograniczenie zakresu zbieranych informacji do danych niezbędnych do realizacji wskazanych celów (zasada minimalizacji danych, art. 5 ust. 1 lit. c RODO).",
      },
    ],
  },
  cookies: {
    title: "Polityka plików cookie",
    intro:
      "Niniejsza Polityka Plików Cookie określa zasady stosowania plików cookie oraz podobnych technologii w serwisie ZjedzTo, obowiązuje od 1 kwietnia 2026 r. i została sporządzona zgodnie z art. 399 ustawy z dnia 16 listopada 2022 r. Prawo komunikacji elektronicznej (Dz.U. z 2022 r. poz. 2459, dalej: PKE) oraz przepisami RODO.",
    sections: [
      {
        heading: "1. Definicja i podstawa prawna",
        text: "Pliki cookie to niewielkie pliki tekstowe zapisywane na urządzeniu końcowym użytkownika przez serwer serwisu internetowego. Zasady ich stosowania w Polsce reguluje art. 399 ustawy z dnia 16 listopada 2022 r. Prawo komunikacji elektronicznej (PKE), która weszła w życie 10 listopada 2024 r. i zastąpiła w tym zakresie art. 173 poprzedniej ustawy Prawo telekomunikacyjne. Zgodnie z art. 399 ust. 3 PKE zgoda użytkownika nie jest wymagana, jeżeli przechowywanie informacji lub dostęp do niej jest konieczny wyłącznie w celu wykonania transmisji komunikatu lub jest niezbędny do świadczenia usługi żądanej przez użytkownika. Serwis ZjedzTo stosuje wyłącznie pliki cookie oraz mechanizmy lokalnego przechowywania mieszczące się w tej kategorii.",
      },
      {
        heading: "2. Rodzaje stosowanych plików cookie i mechanizmów lokalnego przechowywania",
        text: "Serwis stosuje następujące kategorie plików cookie i równoważnych mechanizmów lokalnego przechowywania danych w przeglądarce: (a) sesyjne pliki cookie HttpOnly — niezbędne do identyfikacji aktywnej sesji użytkownika, utrzymania stanu czatu i funkcji konta; usuwane automatycznie po zamknięciu przeglądarki lub wygaśnięciu sesji; (b) techniczne pliki cookie ochrony przed nadużyciami — służące do egzekwowania limitów zapytań (rate limiting) i zabezpieczenia serwisu przed nieuprawnionym lub nadmiernym użyciem; (c) mechanizm localStorage przeglądarki — serwis zapisuje w localStorage następujące dane: klucz „cookie-consent" (informacja o zapoznaniu się z informacją o cookies, wygasa po 12 miesiącach lub ręcznym wyczyszczeniu danych przeglądarki), klucz „cmz-recent-searches" (ostatnie wyszukiwania użytkownika, przechowywane lokalnie na urządzeniu), klucz „cmz-user-recipes:[id]" (własne przepisy zapisane przez użytkownika w ramach sesji lub konta). Dane z localStorage pozostają wyłącznie na urządzeniu użytkownika i nie są przesyłane na serwer, z wyjątkiem sytuacji gdy użytkownik jest zalogowany i synchronizuje dane konta.",
      },
      {
        heading: "3. Google Fonts — zewnętrzne zasoby strony",
        text: "Serwis ładuje kroje pisma z zewnętrznych serwerów Google LLC (fonts.googleapis.com, fonts.gstatic.com). Przy każdym wywołaniu strony przeglądarka użytkownika nawiązuje połączenie z tymi serwerami, co wiąże się z przekazaniem adresu IP użytkownika do Google LLC z siedzibą w USA. Google może przetwarzać te dane zgodnie ze swoją polityką prywatności (https://policies.google.com/privacy). Transfer ten odbywa się na podstawie uzasadnionego interesu Administratora (art. 6 ust. 1 lit. f RODO). Administrator rozważa zastąpienie zewnętrznych czcionek lokalnie serwowanymi w celu wyeliminowania tego połączenia.",
      },
      {
        heading: "4. Zakres wyłączeń — technologie niestosowane",
        text: "Operator nie stosuje plików cookie reklamowych, behawioralnych ani marketingowych. Serwis nie korzysta z zewnętrznych narzędzi śledzenia aktywności użytkowników (w szczególności: Google Analytics, Meta Pixel, Hotjar, ani równoważnych rozwiązań). Dane o zachowaniu użytkowników nie są przekazywane podmiotom trzecim w celach reklamowych ani analitycznych.",
      },
      {
        heading: "5. Zarządzanie plikami cookie przez użytkownika",
        text: "Użytkownik serwisu może w każdym czasie usunąć pliki cookie lub ograniczyć ich stosowanie za pośrednictwem ustawień przeglądarki internetowej. Wyłączenie sesyjnych plików cookie może uniemożliwić korzystanie z funkcji czatu, przesyłania zdjęć oraz konta użytkownika. Wyłączenie plików cookie ochrony przed nadużyciami może skutkować ograniczeniem dostępu do serwisu z powodu braku możliwości stosowania mechanizmów zabezpieczających. Instrukcje zarządzania plikami cookie dostępne są w dokumentacji przeglądarek: Google Chrome, Mozilla Firefox, Apple Safari oraz Microsoft Edge.",
      },
      {
        heading: "6. Zmiany Polityki i kontakt",
        text: `Operator zastrzega sobie prawo do zmiany niniejszej Polityki Plików Cookie w przypadku wprowadzenia nowych mechanizmów technicznych lub zmiany obowiązujących przepisów prawa. O zmianach Operator poinformuje użytkowników poprzez stosowny komunikat w serwisie. Aktualna wersja Polityki obowiązuje od ${COMPANY_PROFILE.lastUpdated}. W sprawach dotyczących stosowania plików cookie należy kontaktować się pod adresem: ${COMPANY_PROFILE.supportEmail}.`,
      },
    ],
  },
};

export const INFO_PAGE_CONTENT = {
  faq: {
    title: "FAQ",
    intro: "Odpowiedzi na pytania, które pojawiają się najczęściej.",
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
        text: "Tak. Z czatu możesz korzystać bez rejestracji — bieżąca rozmowa działa w ramach aktualnej sesji przeglądarki, a ostatnie wyszukiwania mogą być zapisane lokalnie na urządzeniu. Konto przyda się, jeśli chcesz mieć dostęp do ulubionych, listy zakupów i własnych przepisów na różnych urządzeniach.",
      },
      {
        heading: "Co zyskuję zakładając konto?",
        text: "Synchronizację ulubionych propozycji, listy zakupów i własnych przepisów między urządzeniami po zalogowaniu. Rejestracja jest bezpłatna i dobrowolna — bez niej też działa cały czat.",
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
        text: `${COMPANY_PROFILE.operatorName}, ${COMPANY_PROFILE.operatorAddress}. Tel.: ${COMPANY_PROFILE.operatorPhone}. W sprawach formalnych i prawnych odpiszemy w terminie wymaganym przez przepisy.`,
      },
    ],
  },
};
