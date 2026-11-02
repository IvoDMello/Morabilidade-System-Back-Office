import { Navbar } from "@/components/layout/Navbar";

// Só aparece ao chegar de outra página. Dentro da MoraMétrica, busca e filtros
// mantêm o resultado anterior esmaecido até o novo chegar (ver Navegacao.tsx).
export default function Carregando() {
  return (
    <>
      <Navbar marcaMobile />
      <div className="bg-[#585a4f]">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-8 pb-10 sm:pt-14 sm:pb-16 text-center">
          <p className="text-[11px] sm:text-xs font-bold tracking-[0.28em] uppercase text-[#d8cb6a]">
            Vendas registradas no Rio
          </p>
          <h1 className="font-serif text-white text-[42px] sm:text-6xl leading-none mt-3">MoraMétrica</h1>
          <div className="mt-10 max-w-2xl mx-auto h-[60px] rounded-2xl bg-white/90 animate-pulse" />
        </div>
      </div>
      <main className="bg-[#f7f6f2]" aria-busy="true">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-5">
          <span className="sr-only">Carregando</span>
          <div className="h-56 rounded-2xl bg-white border border-[#e4e1d6] animate-pulse" />
          <div className="h-24 rounded-2xl bg-white border border-[#e4e1d6] animate-pulse" />
          <div className="h-72 rounded-2xl bg-white border border-[#e4e1d6] animate-pulse" />
        </div>
      </main>
    </>
  );
}
