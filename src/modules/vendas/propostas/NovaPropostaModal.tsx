import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mensagemErro, numeroBR } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, CampoData, Entrada, Modal, Selecao } from '@/shared/ui';
import { criarProposta, listarContatos, listarEmpresas } from '../api';

export function NovaPropostaModal({ ano, onFechar, onCriada }: { ano: number; onFechar: () => void; onCriada: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: empresas = [] } = useQuery({ queryKey: ['empresas'], queryFn: listarEmpresas });
  const { data: contatos = [] } = useQuery({ queryKey: ['contatos'], queryFn: listarContatos });
  const [f, setF] = useState({ empresa_id: '', contato_id: '', titulo: '', descricao: '', valor: '', prazo_previsto: '', validade: '', condicoes_comerciais: '' });
  const [erro, setErro] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const contatosEmpresa = contatos.filter((c) => c.empresa_id === f.empresa_id);
  const contato = contatos.find((c) => c.id === f.contato_id);
  const ccAtual = contato?.contato_anos?.find((a) => a.ano === ano)?.codigo_comercial;

  const m = useMutation({
    mutationFn: () => criarProposta({ ...f, ano, valor: numeroBR(f.valor) }),
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
          <div className="sm:col-span-2">
            <Aviso tipo="info">
              {ccAtual !== undefined
                ? `Código do cliente em ${ano}: ${String(ccAtual).padStart(2, '0')}. O código da proposta será ${String(ano).slice(2)}-${String(ccAtual).padStart(2, '0')}-NNN.`
                : `${contato.nome} ainda não tem código em ${ano}. Ao salvar, recebe o próximo código do cliente do ano.`}
            </Aviso>
          </div>
        )}
        <Campo rotulo="Título do fornecimento *" className="sm:col-span-2"><Entrada value={f.titulo} onChange={set('titulo')} /></Campo>
        <Campo rotulo="Descrição" className="sm:col-span-2"><AreaTexto value={f.descricao} onChange={set('descricao')} /></Campo>
        <Campo rotulo="Valor (R$)"><Entrada inputMode="decimal" value={f.valor} onChange={set('valor')} placeholder="0,00" /></Campo>
        <Campo rotulo="Prazo previsto"><Entrada value={f.prazo_previsto} onChange={set('prazo_previsto')} placeholder="ex.: 30 dias" /></Campo>
        <Campo rotulo="Validade da proposta"><CampoData value={f.validade} onChange={(v) => setF({ ...f, validade: v })} /></Campo>
        <Campo rotulo="Condições comerciais" className="sm:col-span-2"><AreaTexto value={f.condicoes_comerciais} onChange={set('condicoes_comerciais')} /></Campo>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={m.isPending}>{m.isPending ? 'Criando…' : 'Criar proposta (R0)'}</Botao>
        </div>
      </form>
    </Modal>
  );
}
