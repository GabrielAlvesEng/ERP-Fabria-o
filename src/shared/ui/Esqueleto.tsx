// Skeleton screens: blocos cinza com brilho passando, no formato do conteúdo que está carregando.
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cx('esqueleto rounded-md', className)} />;
}

const larguras = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-2/5', 'w-3/5'];

// Tabelas e listas (empresas, contatos, predefinições, custos).
export function EsqueletoTabela({ linhas = 6, colunas = 5 }: { linhas?: number; colunas?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="overflow-hidden rounded-xl ring-1 ring-borda">
      <div className="flex gap-4 bg-pagina px-4 py-3">
        {Array.from({ length: colunas }, (_, c) => <Esqueleto key={c} className={cx('h-3', c === 0 ? 'w-24' : 'flex-1')} />)}
      </div>
      {Array.from({ length: linhas }, (_, l) => (
        <div key={l} className="flex items-center gap-4 border-t border-borda px-4 py-3.5">
          {Array.from({ length: colunas }, (_, c) => (
            <div key={c} className={c === 0 ? 'w-24' : 'flex-1'}><Esqueleto className={cx('h-3.5', larguras[(l + c) % larguras.length])} /></div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Grade de cartões (vendedores, frota, projetos, fornecedores).
export function EsqueletoCartoes({ quantidade = 6 }: { quantidade?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} className="rounded-xl bg-superficie p-4 ring-1 ring-borda">
          <div className="flex items-center gap-3">
            <Esqueleto className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2"><Esqueleto className="h-3.5 w-2/3" /><Esqueleto className="h-3 w-1/3" /></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">{[0, 1, 2].map((k) => <Esqueleto key={k} className="h-10 rounded-lg" />)}</div>
          <Esqueleto className="mt-3 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// Kanban de propostas.
export function EsqueletoKanban() {
  return (
    <div role="status" aria-label="Carregando" className="flex gap-3 overflow-hidden">
      {[3, 2, 3, 1].map((n, c) => (
        <div key={c} className="w-72 shrink-0 rounded-xl bg-pagina p-3 ring-1 ring-borda">
          <div className="mb-1 flex items-center justify-between"><Esqueleto className="h-4 w-24" /><Esqueleto className="h-4 w-6 rounded-full" /></div>
          <Esqueleto className="mb-3 h-3 w-16" />
          <div className="space-y-2">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="space-y-2 rounded-lg bg-superficie p-3 ring-1 ring-borda">
                <div className="flex justify-between"><Esqueleto className="h-3.5 w-20" /><Esqueleto className="h-4 w-7 rounded-full" /></div>
                <Esqueleto className="h-4 w-3/4" /><Esqueleto className="h-3 w-1/2" /><Esqueleto className="h-3.5 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Fichas e formulários (detalhe da proposta, projeto, documentos, kick-off).
export function EsqueletoDetalhe() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-5 p-1">
      <div className="space-y-2"><Esqueleto className="h-6 w-1/3" /><Esqueleto className="h-3.5 w-1/2" /></div>
      <div className="flex gap-2">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-8 w-24 rounded-lg" />)}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="space-y-1.5"><Esqueleto className="h-3 w-24" /><Esqueleto className="h-9 rounded-lg" /></div>)}
      </div>
      <Esqueleto className="h-24 rounded-lg" />
    </div>
  );
}

// Folha A4 da prévia do PDF.
export function EsqueletoPagina() {
  return (
    <div role="status" aria-label="Carregando a prévia" className="mx-auto aspect-[210/297] w-full max-w-[560px] space-y-4 rounded-lg bg-superficie p-8 shadow-sm ring-1 ring-borda">
      <div className="flex justify-between"><Esqueleto className="h-2.5 w-1/3" /><Esqueleto className="h-2.5 w-1/4" /></div>
      <Esqueleto className="h-7 w-2/3" />
      {Array.from({ length: 4 }, (_, i) => <Esqueleto key={i} className={cx('h-3', larguras[i])} />)}
      <Esqueleto className="h-32 rounded-lg" />
      {Array.from({ length: 5 }, (_, i) => <Esqueleto key={i} className={cx('h-3', larguras[(i + 2) % larguras.length])} />)}
    </div>
  );
}

// Dashboard de Vendas.
export function EsqueletoDashboard() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="space-y-3 rounded-xl p-4 ring-1 ring-borda"><Esqueleto className="h-3 w-1/2" /><Esqueleto className="h-7 w-2/3" /><Esqueleto className="h-2.5 w-1/3" /></div>)}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Esqueleto className="h-64 rounded-xl lg:col-span-2" /><Esqueleto className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
