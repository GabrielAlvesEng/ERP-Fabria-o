import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Car, Fuel, History, Plus, Trash2, Truck } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { dataBR, dataHoraBR, mensagemErro, moeda } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Campo, CampoData, CampoNumero, Cartao, Entrada, EsqueletoCartoes, Modal, Selecao, Selo, Vazio } from '@/shared/ui';

// Administração → Frota (decisões 42 e 55): preço dos 3 combustíveis com histórico e ficha completa de cada veículo
// (placa, tipo, eixos, combustível, documentos, até 3 fotos). Os custos das propostas usam o veículo, o consumo e o preço.

type Combustivel = 'gasolina' | 'etanol' | 'diesel';
const COMBUSTIVEIS: Combustivel[] = ['gasolina', 'etanol', 'diesel'];
const NOME_COMB: Record<string, string> = { gasolina: 'Gasolina', etanol: 'Etanol', diesel: 'Diesel', flex: 'Flex (cálculo com gasolina)' };
const TIPOS = { carro: 'Carro', utilitario: 'Utilitário', caminhao: 'Caminhão', munck: 'Caminhão munck', outro: 'Outro' } as const;
const SITUACOES = { ativo: 'Ativo', manutencao: 'Em manutenção', vendido: 'Vendido / inativo' } as const;

interface Veiculo {
  id: string; nome: string; placa: string; tipo: keyof typeof TIPOS; marca: string; modelo: string; ano: number | null; cor: string;
  renavam: string; chassi: string; eixos: number; combustivel: Combustivel | 'flex'; consumo_km_l: number; capacidade_kg: number | null;
  passageiros: number | null; licenciamento_vence: string | null; seguro_vence: string | null; revisao_km: number | null; revisao_data: string | null;
  situacao: keyof typeof SITUACOES; observacoes: string;
}
interface Foto { id: string; veiculo_id: string; caminho: string; nome: string; url?: string }
const MAX_FOTOS = 3;

const VAZIO: Omit<Veiculo, 'id'> = {
  nome: '', placa: '', tipo: 'carro', marca: '', modelo: '', ano: null, cor: '', renavam: '', chassi: '', eixos: 2, combustivel: 'flex', consumo_km_l: 10,
  capacidade_kg: null, passageiros: null, licenciamento_vence: null, seguro_vence: null, revisao_km: null, revisao_data: null, situacao: 'ativo', observacoes: '',
};

export function FrotaPage() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState<Veiculo | 'novo' | null>(null);
  const { data: veiculos = [], isLoading } = useQuery({
    queryKey: ['admin_veiculos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ref_veiculos').select('*').order('ativo', { ascending: false }).order('nome');
      if (error) throw error;
      return data as Veiculo[];
    },
  });
  const { data: fotos = [] } = useQuery({
    queryKey: ['admin_veiculo_fotos', veiculos.map((v) => v.id).join()],
    enabled: veiculos.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('veiculo_fotos').select('id, veiculo_id, caminho, nome').order('ordem').order('criado_em');
      if (error) throw error;
      const lista = data as Foto[];
      if (!lista.length) return lista;
      const { data: urls } = await supabase.storage.from('frota').createSignedUrls(lista.map((f) => f.caminho), 3600);
      return lista.map((f, i) => ({ ...f, url: urls?.[i]?.signedUrl }));
    },
  });
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ['admin_veiculos'] });
    qc.invalidateQueries({ queryKey: ['admin_veiculo_fotos'] });
    qc.invalidateQueries({ queryKey: ['ref_veiculos'] });
  };

  return (
    <>
      <Cabecalho titulo="Frota" subtitulo="Veículos da empresa e preço dos combustíveis, usados na seção Viagem das propostas. Mudar aqui não altera propostas já lançadas."
        acoes={<Botao onClick={() => setAberto('novo')}><Plus size={15} /> Novo veículo</Botao>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {isLoading ? <EsqueletoCartoes /> : veiculos.length === 0 ? <Vazio>Nenhum veículo cadastrado.</Vazio> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {veiculos.map((v) => {
                const capa = fotos.find((f) => f.veiculo_id === v.id);
                const Icone = v.tipo === 'caminhao' || v.tipo === 'munck' ? Truck : Car;
                return (
                  <button key={v.id} type="button" onClick={() => setAberto(v)}
                    className={`overflow-hidden rounded-xl bg-superficie text-left shadow-sm ring-1 ring-borda transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md hover:ring-roxo-300 ${v.situacao !== 'ativo' ? 'opacity-70' : ''}`}>
                    <div className="flex h-32 items-center justify-center bg-pagina">
                      {capa?.url ? <img src={capa.url} alt={v.nome} className="h-full w-full object-cover" /> : <Icone size={40} className="text-suave" />}
                    </div>
                    <div className="space-y-1 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{v.nome}</span>
                        {v.placa && <span className="shrink-0 rounded bg-pagina px-1.5 py-0.5 font-mono text-xs ring-1 ring-borda">{v.placa}</span>}
                      </div>
                      <div className="text-xs text-suave">{[TIPOS[v.tipo], [v.marca, v.modelo].filter(Boolean).join(' '), v.ano].filter(Boolean).join(' · ')}</div>
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <Selo cor="azul">{NOME_COMB[v.combustivel].split(' ')[0]}</Selo>
                        <Selo>{Number(v.consumo_km_l).toLocaleString('pt-BR')} km/l</Selo>
                        <Selo>{v.eixos} eixos</Selo>
                        {v.situacao !== 'ativo' && <Selo cor="amarelo">{SITUACOES[v.situacao]}</Selo>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <CartaoCombustiveis />
      </div>
      {aberto && <FichaVeiculo veiculo={aberto === 'novo' ? null : aberto} fotos={aberto === 'novo' ? [] : fotos.filter((f) => f.veiculo_id === aberto.id)}
        onFechar={() => setAberto(null)} onSalvo={(v) => { recarregar(); if (v) setAberto(v); }} onFotos={recarregar} />}
    </>
  );
}

// Preço de gasolina, etanol e diesel; cada alteração vira uma nova linha (histórico).
function CartaoCombustiveis() {
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const [verHistorico, setVerHistorico] = useState(false);
  const { data: historico = [] } = useQuery({
    queryKey: ['admin_combustiveis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('combustivel_precos').select('id, combustivel, preco, vigente_desde').order('vigente_desde', { ascending: false }).limit(60);
      if (error) throw error;
      return data as { id: string; combustivel: Combustivel; preco: number; vigente_desde: string }[];
    },
  });
  const atual = (c: Combustivel) => historico.find((h) => h.combustivel === c);
  async function salvar(c: Combustivel, preco: number) {
    setErro('');
    if (!(preco > 0) || preco === Number(atual(c)?.preco)) return;
    const { error } = await supabase.from('combustivel_precos').insert({ combustivel: c, preco });
    if (error) setErro(mensagemErro(error));
    qc.invalidateQueries({ queryKey: ['admin_combustiveis'] });
    qc.invalidateQueries({ queryKey: ['ref_veiculos'] });
  }
  return (
    <Cartao className="self-start">
      <div className="mb-1 flex items-center gap-2 font-semibold"><Fuel size={16} className="text-suave" /> Preço dos combustíveis</div>
      <p className="mb-3 text-sm text-suave">Preenche o R$/l dos trechos da seção Viagem conforme o combustível do veículo. Flex usa sempre gasolina.</p>
      {erro && <div className="mb-2"><Aviso>{erro}</Aviso></div>}
      <div className="space-y-2">
        {COMBUSTIVEIS.map((c) => (
          <div key={c} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-sm font-medium">{NOME_COMB[c]}</span>
            <div className="w-32 shrink-0 rounded-lg border border-slate-300 bg-superficie dark:border-marinho-500">
              <CampoNumero moeda valor={Number(atual(c)?.preco ?? 0)} casas={3} className="py-1.5" onConfirmar={(n) => salvar(c, n)} />
            </div>
            <span className="min-w-0 flex-1 text-xs text-suave">{atual(c) ? `desde ${dataBR(atual(c)!.vigente_desde)}` : 'não definido'}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setVerHistorico(!verHistorico)} className="mt-3 inline-flex items-center gap-1 text-xs text-roxo-600 hover:underline dark:text-roxo-100">
        <History size={13} /> {verHistorico ? 'Esconder histórico' : 'Ver histórico de preços'}
      </button>
      {verHistorico && (
        <ul className="mt-2 max-h-56 divide-y divide-borda overflow-y-auto text-xs">
          {historico.map((h) => <li key={h.id} className="flex justify-between py-1"><span>{NOME_COMB[h.combustivel]} · {dataHoraBR(h.vigente_desde)}</span><span className="tabular-nums">{moeda(h.preco)}</span></li>)}
        </ul>
      )}
    </Cartao>
  );
}

function FichaVeiculo({ veiculo, fotos, onFechar, onSalvo, onFotos }: {
  veiculo: Veiculo | null; fotos: Foto[]; onFechar: () => void; onSalvo: (v: Veiculo | null) => void; onFotos: () => void;
}) {
  const [f, setF] = useState<Omit<Veiculo, 'id'>>(veiculo ?? VAZIO);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => setF(veiculo ?? VAZIO), [veiculo]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const texto = (k: 'nome' | 'placa' | 'marca' | 'modelo' | 'cor' | 'renavam' | 'chassi') => ({ value: f[k], onChange: (e: { target: { value: string } }) => set(k, e.target.value) });

  async function salvar() {
    setErro('');
    if (f.nome.trim().length < 2) return setErro('Informe o nome (apelido) do veículo.');
    if (!(Number(f.consumo_km_l) > 0)) return setErro('Informe o consumo em km/l.');
    if (f.placa.trim() && !/^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/i.test(f.placa.trim())) return setErro('Placa inválida. Use o padrão ABC1D23 ou ABC-1234.');
    setSalvando(true);
    // Só os campos da ficha (o "ativo" é calculado pela situação no banco).
    const dados = Object.fromEntries(Object.keys(VAZIO).map((k) => [k, f[k as keyof typeof f]]));
    Object.assign(dados, { nome: f.nome.trim(), placa: f.placa.trim().toUpperCase().replace('-', '') });
    const r = veiculo
      ? await supabase.from('ref_veiculos').update(dados).eq('id', veiculo.id).select().single()
      : await supabase.from('ref_veiculos').insert(dados).select().single();
    setSalvando(false);
    if (r.error) return setErro(r.error.code === '23505' ? 'Já existe um veículo com esta placa.' : mensagemErro(r.error));
    onSalvo(r.data as Veiculo);
  }

  async function enviarFotos(arquivos: FileList | null) {
    if (!veiculo || !arquivos?.length) return;
    setErro('');
    const livres = MAX_FOTOS - fotos.length;
    const lista = [...arquivos].slice(0, livres);
    if (arquivos.length > livres) setErro(`Cada veículo pode ter no máximo ${MAX_FOTOS} fotos.`);
    setEnviando(true);
    for (const a of lista) {
      if (a.size > 5 * 1024 * 1024) { setErro(`"${a.name}" passa de 5 MB.`); continue; }
      const caminho = `veiculos/${veiculo.id}/${Date.now()}-${a.name.normalize('NFD').replace(/[^\w.-]+/g, '_')}`;
      const up = await supabase.storage.from('frota').upload(caminho, a, { contentType: a.type });
      if (up.error) { setErro(mensagemErro(up.error)); continue; }
      const ins = await supabase.from('veiculo_fotos').insert({ veiculo_id: veiculo.id, caminho, nome: a.name });
      if (ins.error) { await supabase.storage.from('frota').remove([caminho]); setErro(mensagemErro(ins.error)); }
    }
    setEnviando(false);
    onFotos();
  }

  async function removerFoto(foto: Foto) {
    setErro('');
    const r = await supabase.from('veiculo_fotos').delete().eq('id', foto.id);
    if (r.error) return setErro(mensagemErro(r.error));
    await supabase.storage.from('frota').remove([foto.caminho]);
    onFotos();
  }

  return (
    <Modal aberto titulo={veiculo ? `Veículo · ${veiculo.nome}` : 'Novo veículo'} onFechar={onFechar} largura="max-w-3xl">
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Nome (apelido)" className="sm:col-span-2"><Entrada {...texto('nome')} placeholder="ex.: Saveiro branca" /></Campo>
        <Campo rotulo="Placa"><Entrada {...texto('placa')} placeholder="ABC1D23" className="uppercase" /></Campo>
        <Campo rotulo="Tipo">
          <Selecao value={f.tipo} onChange={(e) => set('tipo', e.target.value as Veiculo['tipo'])}>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Marca"><Entrada {...texto('marca')} /></Campo>
        <Campo rotulo="Modelo"><Entrada {...texto('modelo')} /></Campo>
        <Campo rotulo="Ano"><div className="rounded-lg border border-slate-300 bg-superficie dark:border-marinho-500"><CampoNumero valor={f.ano ?? 0} casas={0} className="py-1.5" onConfirmar={(n) => set('ano', n || null)} /></div></Campo>
        <Campo rotulo="Cor"><Entrada {...texto('cor')} /></Campo>
        <Campo rotulo="Eixos (define o pedágio)">
          <Selecao value={f.eixos} onChange={(e) => set('eixos', Number(e.target.value))}>
            {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n} eixos</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Combustível">
          <Selecao value={f.combustivel} onChange={(e) => set('combustivel', e.target.value as Veiculo['combustivel'])}>
            {['gasolina', 'etanol', 'diesel', 'flex'].map((c) => <option key={c} value={c}>{NOME_COMB[c]}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Consumo (km/l)"><div className="rounded-lg border border-slate-300 bg-superficie dark:border-marinho-500"><CampoNumero valor={f.consumo_km_l} casas={2} className="py-1.5" onConfirmar={(n) => set('consumo_km_l', n)} /></div></Campo>
        <Campo rotulo="Situação">
          <Selecao value={f.situacao} onChange={(e) => set('situacao', e.target.value as Veiculo['situacao'])}>
            {Object.entries(SITUACOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Capacidade de carga (kg)"><div className="rounded-lg border border-slate-300 bg-superficie dark:border-marinho-500"><CampoNumero valor={f.capacidade_kg ?? 0} casas={1} className="py-1.5" onConfirmar={(n) => set('capacidade_kg', n || null)} /></div></Campo>
        <Campo rotulo="Passageiros"><div className="rounded-lg border border-slate-300 bg-superficie dark:border-marinho-500"><CampoNumero valor={f.passageiros ?? 0} casas={0} className="py-1.5" onConfirmar={(n) => set('passageiros', n || null)} /></div></Campo>
        <Campo rotulo="RENAVAM"><Entrada {...texto('renavam')} /></Campo>
        <Campo rotulo="Chassi" className="sm:col-span-2"><Entrada {...texto('chassi')} className="uppercase" /></Campo>
        <Campo rotulo="Licenciamento vence"><CampoData value={f.licenciamento_vence} onChange={(v) => set('licenciamento_vence', v || null)} /></Campo>
        <Campo rotulo="Seguro vence"><CampoData value={f.seguro_vence} onChange={(v) => set('seguro_vence', v || null)} /></Campo>
        <Campo rotulo="Próxima revisão (data)"><CampoData value={f.revisao_data} onChange={(v) => set('revisao_data', v || null)} /></Campo>
        <Campo rotulo="Próxima revisão (km)"><div className="rounded-lg border border-slate-300 bg-superficie dark:border-marinho-500"><CampoNumero valor={f.revisao_km ?? 0} casas={0} className="py-1.5" onConfirmar={(n) => set('revisao_km', n || null)} /></div></Campo>
        <Campo rotulo="Observações" className="sm:col-span-3"><AreaTexto value={f.observacoes} onChange={(e) => set('observacoes', e.target.value)} /></Campo>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Camera size={15} className="text-suave" /> Fotos <Selo>{fotos.length}/{MAX_FOTOS}</Selo></div>
        {!veiculo ? <p className="text-sm text-suave">Salve o veículo para adicionar fotos.</p> : (
          <div className="flex flex-wrap gap-2">
            {fotos.map((foto) => (
              <div key={foto.id} className="group relative h-24 w-32 overflow-hidden rounded-lg bg-pagina ring-1 ring-borda">
                {foto.url ? <img src={foto.url} alt={foto.nome} className="h-full w-full object-cover" /> : <span className="p-2 text-xs text-suave">{foto.nome}</span>}
                <button type="button" onClick={() => removerFoto(foto)} title="Remover foto"
                  className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"><Trash2 size={13} /></button>
              </div>
            ))}
            {fotos.length < MAX_FOTOS && (
              <label className="flex h-24 w-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-xs text-suave hover:border-roxo-400 hover:text-roxo-600 dark:border-marinho-500">
                <Plus size={16} /> {enviando ? 'Enviando…' : 'Adicionar foto'}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" disabled={enviando} onChange={(e) => { enviarFotos(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>
        )}
        <p className="mt-1 text-xs text-suave">Até {MAX_FOTOS} fotos (JPG, PNG ou WEBP, até 5 MB cada).</p>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Botao variante="secundario" onClick={onFechar}>Fechar</Botao>
        <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : veiculo ? 'Salvar alterações' : 'Cadastrar veículo'}</Botao>
      </div>
    </Modal>
  );
}
