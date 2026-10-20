import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { mensagemErro, moeda } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, Caixa, Campo, CampoCelula, CampoNumero, Cartao, Entrada, Vazio } from '@/shared/ui';

interface Veiculo { id: string; nome: string; consumo_km_l: number; ativo: boolean }

// Administração → Frota (decisão 42): veículos com consumo e preço padrão do combustível,
// usados na seção "Frota e fretes" dos custos da proposta.
export function FrotaPage() {
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState({ nome: '', consumo: 0 });
  const { data: veiculos = [], isLoading } = useQuery({
    queryKey: ['admin_veiculos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ref_veiculos').select('id, nome, consumo_km_l, ativo').order('ativo', { ascending: false }).order('nome');
      if (error) throw error;
      return data as Veiculo[];
    },
  });
  const { data: preco } = useQuery({
    queryKey: ['admin_combustivel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracoes').select('valor').eq('chave', 'combustivel_preco_padrao').maybeSingle();
      if (error) throw error;
      return data ? Number(data.valor) : 0;
    },
  });
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ['admin_veiculos'] });
    qc.invalidateQueries({ queryKey: ['admin_combustivel'] });
    qc.invalidateQueries({ queryKey: ['ref_veiculos'] });
  };
  const tentar = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setErro('');
    const { error } = await fn();
    if (error) setErro(mensagemErro(error)); else recarregar();
  };
  const adicionar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ref_veiculos').insert({ nome: novo.nome.trim(), consumo_km_l: novo.consumo });
      if (error) throw error;
    },
    onSuccess: () => { setNovo({ nome: '', consumo: 0 }); recarregar(); },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (novo.nome.trim().length < 2) return setErro('Informe o nome do veículo.');
    if (!(novo.consumo > 0)) return setErro('Informe o consumo em km/l.');
    adicionar.mutate();
  }

  return (
    <>
      <Cabecalho titulo="Frota (custos)" subtitulo="Veículos e combustível usados na seção Frota e fretes das propostas. Mudar aqui não altera propostas já lançadas." />
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Cartao className="p-0">
          {isLoading ? <Vazio>Carregando…</Vazio> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-marinho-700/50">
                <tr><th className="px-4 py-2">Veículo</th><th className="w-32 px-4 py-2 text-right">Consumo (km/l)</th><th className="w-24 px-4 py-2">Ativo</th></tr>
              </thead>
              <tbody>
                {veiculos.length === 0 && <tr><td colSpan={3}><Vazio>Nenhum veículo cadastrado.</Vazio></td></tr>}
                {veiculos.map((v) => (
                  <tr key={v.id} className={`border-t border-slate-100 dark:border-marinho-700 ${v.ativo ? '' : 'text-slate-400'}`}>
                    <td className="px-2 py-1"><CampoCelula valor={v.nome} onConfirmar={(nome) => nome.trim().length >= 2 && tentar(() => supabase.from('ref_veiculos').update({ nome: nome.trim() }).eq('id', v.id))} /></td>
                    <td className="px-2 py-1"><CampoNumero valor={Number(v.consumo_km_l)} casas={2} onConfirmar={(n) => n > 0 && tentar(() => supabase.from('ref_veiculos').update({ consumo_km_l: n }).eq('id', v.id))} /></td>
                    <td className="px-4 py-1"><Caixa marcado={v.ativo} onChange={(ativo) => tentar(() => supabase.from('ref_veiculos').update({ ativo }).eq('id', v.id))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form onSubmit={enviar} className="flex flex-wrap items-end gap-2 border-t border-slate-200 p-3 dark:border-marinho-700">
            <Campo rotulo="Novo veículo" className="min-w-[200px] flex-1"><Entrada value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="ex.: Caminhão munck" /></Campo>
            <Campo rotulo="Consumo (km/l)" className="w-36">
              <div className="rounded-lg border border-slate-300 bg-white dark:border-marinho-500 dark:bg-marinho-800"><CampoNumero valor={novo.consumo} casas={2} onConfirmar={(n) => setNovo({ ...novo, consumo: n })} className="py-1.5" /></div>
            </Campo>
            <Botao type="submit" disabled={adicionar.isPending}><Plus size={15} /> Adicionar</Botao>
          </form>
        </Cartao>
        <Cartao className="self-start">
          <div className="mb-1 font-semibold">Preço padrão do combustível</div>
          <p className="mb-3 text-sm text-slate-500">Preenche o R$/l dos novos trechos com veículo próprio. Pode ser alterado em cada linha.</p>
          <div className="flex items-center gap-2">
            <div className="w-32 rounded-lg border border-slate-300 bg-white dark:border-marinho-500 dark:bg-marinho-800">
              <CampoNumero valor={preco ?? 0} casas={3} className="py-1.5"
                onConfirmar={(n) => n >= 0 && tentar(() => supabase.from('configuracoes').upsert({ chave: 'combustivel_preco_padrao', valor: n, atualizado_em: new Date().toISOString() }))} />
            </div>
            <span className="text-sm text-slate-500">R$/l {preco ? `(${moeda(preco)})` : '(não definido)'}</span>
          </div>
        </Cartao>
      </div>
    </>
  );
}
