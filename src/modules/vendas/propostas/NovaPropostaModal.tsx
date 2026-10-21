import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hojeISO, mensagemErro, numeroBR } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, Entrada, Modal, Selecao, EntradaMoeda } from '@/shared/ui';
import { criarProposta, listarContatos, listarEmpresas, sugerirCodigoProposta } from '../api';
import { validadeAte } from './regras';

const FORMATO = /^\d{2}-\d{2,}-\d{3,}$/;

export function NovaPropostaModal({ ano, onFechar, onCriada }: { ano: number; onFechar: () => void; onCriada: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: empresas = [] } = useQuery({ queryKey: ['empresas'], queryFn: listarEmpresas });
  const { data: contatos = [] } = useQuery({ queryKey: ['contatos'], queryFn: listarContatos });
  const [f, setF] = useState({ empresa_id: '', contato_id: '', titulo: '', descricao: '', valor: '', prazo_previsto: '', validade_dias: '', condicoes_comerciais: '' });
  // Código semi-automático (decisão 44): o ERP sugere; só vai para o banco se o usuário editar.
  const [sugestao, setSugestao] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const contatosEmpresa = contatos.filter((c) => c.empresa_id === f.empresa_id);
  const contato = contatos.find((c) => c.id === f.contato_id);
  const ccAtual = contato?.contato_anos?.find((a) => a.ano === ano)?.codigo_comercial;

  useEffect(() => {
    setSugestao('');
    setCodigo('');
    if (!f.contato_id) return;
    let vivo = true;
    sugerirCodigoProposta(f.contato_id, ano).then((c) => { if (vivo) { setSugestao(c); setCodigo(c); } }).catch((e) => setErro(mensagemErro(e)));
    return () => { vivo = false; };
  }, [f.contato_id, ano]);

  const editado = codigo.trim() !== '' && codigo.trim() !== sugestao;
  const ccDigitado = codigo.split('-')[1];
  const avisoCc = editado && ccAtual !== undefined && FORMATO.test(codigo.trim()) && Number(ccDigitado) !== ccAtual
    ? `O código do cliente de ${contato?.nome} em ${ano} é ${String(ccAtual).padStart(2, '0')}, mas o código digitado usa ${ccDigitado}.`
    : '';

  const m = useMutation({
    mutationFn: () => criarProposta({ ...f, ano, valor: numeroBR(f.valor), validade_dias: f.validade_dias || null, ...(editado ? { codigo: codigo.trim() } : {}) }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['propostas'] });
      qc.invalidateQueries({ queryKey: ['contatos'] });
      onCriada(p.id);
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!f.empresa_id || !f.contato_id) return setErro('Escolha a empresa e o contato.');
    if (f.titulo.trim().length < 3) return setErro('Informe o título do fornecimento.');
    if (editado && !FORMATO.test(codigo.trim())) return setErro('Código fora do formato AA-CC-NNN (ex.: 26-04-003).');
    if (editado && !codigo.trim().startsWith(String(ano).slice(2) + '-')) return setErro(`O código deve começar com o ano da proposta (${String(ano).slice(2)}).`);
    m.mutate();
  }

  return (
    <Modal aberto titulo={`Nova proposta (${ano})`} onFechar={onFechar} largura="max-w-2xl">
      <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
        {erro && <div className="sm:col-span-2"><Aviso>{erro}</Aviso></div>}
        <Campo rotulo="Empresa *">
          <Selecao value={f.empresa_id} onChange={(e) => setF({ ...f, empresa_id: e.target.value, contato_id: '' })}>
            <option value="">Selecione…</option>
            {empresas.filter((e) => e.ativo).map((e) => <option key={e.id} value={e.id}>{e.nome_fantasia}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Contato *">
          <Selecao value={f.contato_id} onChange={set('contato_id')} disabled={!f.empresa_id}>
            <option value="">Selecione…</option>
            {contatosEmpresa.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Selecao>
        </Campo>
        {contato && (
          <>
            <Campo rotulo="Código da proposta">
              <div className="flex items-center gap-2">
                <Entrada className="font-mono" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder={sugestao || 'AA-CC-NNN'} />
                {editado && <button type="button" className="shrink-0 text-xs text-roxo-600 hover:underline" onClick={() => setCodigo(sugestao)}>usar sugerido</button>}
              </div>
            </Campo>
            <div className="self-end pb-2 text-xs text-suave">
              {editado
                ? 'Código definido por você. O sistema recusa se já existir.'
                : ccAtual !== undefined
                  ? `Sugerido pelo sistema (cliente ${String(ccAtual).padStart(2, '0')} em ${ano}). Pode alterar.`
                  : `${contato.nome} ainda não tem código em ${ano}: recebe o próximo ao salvar. Pode alterar.`}
            </div>
            {avisoCc && <div className="sm:col-span-2"><Aviso tipo="info">{avisoCc}</Aviso></div>}
          </>
        )}
        <Campo rotulo="Título do fornecimento *" className="sm:col-span-2"><Entrada value={f.titulo} onChange={set('titulo')} /></Campo>
        <Campo rotulo="Descrição" className="sm:col-span-2"><AreaTexto value={f.descricao} onChange={set('descricao')} /></Campo>
        <Campo rotulo="Valor (R$)"><EntradaMoeda value={f.valor} onChange={(v) => setF({ ...f, valor: v })} /></Campo>
        <Campo rotulo="Prazo previsto"><Entrada value={f.prazo_previsto} onChange={set('prazo_previsto')} placeholder="ex.: 30 dias" /></Campo>
        <Campo rotulo="Validade da proposta (dias)">
          <div className="flex items-center gap-2">
            <Entrada type="number" min={1} max={3650} className="w-24" value={f.validade_dias} onChange={set('validade_dias')} placeholder="ex.: 15" />
            <span className="text-xs text-suave">{validadeAte(hojeISO(), Number(f.validade_dias) || null)}</span>
          </div>
        </Campo>
        <Campo rotulo="Condições comerciais" className="sm:col-span-2"><AreaTexto value={f.condicoes_comerciais} onChange={set('condicoes_comerciais')} /></Campo>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={m.isPending}>{m.isPending ? 'Criando…' : 'Criar proposta (R0)'}</Botao>
        </div>
      </form>
    </Modal>
  );
}
