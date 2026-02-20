import { useState } from 'react'
import './index.css' // Ważne, żeby style Tailwind działały!

function App() {
  const API_ENDPOINT = '/api/generuj/';
  const [skladniki, setSkladniki] = useState('');
  const [odpowiedz, setOdpowiedz] = useState('');
  const [loading, setLoading] = useState(false);

  const generujPrzepis = async () => {
    if (!skladniki) return alert("Wpisz najpierw jakieś składniki!");
    
    setLoading(true);
    try {
      // Łączymy się z Twoim API w Django
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skladniki: skladniki })
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const raw = await response.text();
        throw new Error(`Serwer nie zwrócił JSON (HTTP ${response.status}): ${raw.slice(0, 120)}`);
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.przepis || `Błąd API (HTTP ${response.status})`);
      }

      setOdpowiedz(data?.przepis || 'Brak odpowiedzi z API.');
    } catch (error) {
      console.error("Błąd:", error);
      const msg = error instanceof Error ? error.message : "Nie udało się połączyć z serwerem Django.";
      setOdpowiedz(msg);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 font-sans">
      <div className="max-w-2xl w-full">
        {/* Nagłówek */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-3">
            🥦 Co mogę <span className="text-green-500">zjeść?</span>
          </h1>
          <p className="text-slate-500 font-medium">React + Django AI App</p>
        </div>

        {/* Formularz */}
        <div className="bg-white p-8 rounded-[32px] shadow-2xl border border-slate-100 mb-8">
          <textarea 
            className="w-full h-40 p-5 rounded-2xl border-2 border-slate-50 focus:border-green-400 focus:ring-4 focus:ring-green-100 outline-none transition-all text-slate-700 text-lg"
            placeholder="Wpisz składniki, np. jajka, awokado, chleb..."
            value={skladniki}
            onChange={(e) => setSkladniki(e.target.value)}
          />
          <button 
            onClick={generujPrzepis}
            disabled={loading}
            className={`mt-6 w-full py-5 rounded-2xl font-bold text-white text-xl shadow-lg transition-all active:scale-95 ${
              loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {loading ? '🤖 AI pracuje...' : 'Generuj Przepis'}
          </button>
        </div>

        {/* Miejsce na przepis */}
        {odpowiedz && (
          <div className="bg-white p-8 rounded-[32px] shadow-xl border-l-8 border-green-500">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Twój Przepis:</h2>
            <div className="text-slate-600 whitespace-pre-line leading-relaxed text-lg">
              {odpowiedz}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
