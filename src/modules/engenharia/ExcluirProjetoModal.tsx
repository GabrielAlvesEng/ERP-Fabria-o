import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, Entrada, Modal } from '@/shared/ui';

// Exclusão do projeto (decisão 60), igual à da proposta: projeto vazio só pede justificativa; com peças ou
// conjuntos pede também a senha "Excluir Projeto". O projeto vai para a Lixeira da Administração por 30 dias.
export function ExcluirProjetoModal({ projeto, onFechar, onExcluido }: { projeto: { id: string; codigo: string }; onFechar: () => void; onExcluido: () => void }) {
  const qc = useQueryClient();
  const [just, setJust] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const { data: exigeSenha, isLoading } = useQuery({
    queryKey: ['projeto_exclusao_exige_senha', projeto.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('projeto_exclusao_exige_senha', { p_id: projeto.id });
      if (error) throw error;
      return Boolean(data);
    },
  });

  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('excluir_projeto', { p_id: projeto.id, p_justificativa: just, p_senha: exigeSenha ? senha : null });
      if (error) throw error;
      if (data === 'senha_incorreta') throw new Error('Senha administrativa incorreta. Depois de 5 tentativas erradas, a exclusão fica bloqueada por 15 minutos.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eng'] });
      onExcluido();
    },
    onError: (e) => { setErro(mensagemErro(e)); setSenha(''); },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (just.trim().length < 5) return setErro('Informe a justificativa (mínimo de 5 caracteres).');
    if (exigeSenha && !senha) return setErro('Informe a senha administrativa.');
    m.mutate();
  }

  return (
    <Modal aberto titulo={`Excluir o projeto ${projeto.codigo}?`} onFechar={onFechar}>
      <form className="space-y-3" onSubmit={enviar}>
        <Aviso tipo="info">
          O projeto vai para a Lixeira da Administração. Lá ele pode ser restaurado ou excluído definitivamente; se ninguém fizer nada, é apagado sozinho em 30 dias. A proposta continua aprovada.
        </Aviso>
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="Justificativa *"><AreaTexto value={just} onChange={(e) => setJust(e.target.value)} placeholder="Ex.: projeto criado em duplicidade" /></Campo>
        {isLoading ? null : exigeSenha ? (
          <Campo rotulo="Senha administrativa (Excluir Projeto) *">
            <Entrada type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Campo>
        ) : (
          <div className="text-xs text-suave">Este projeto ainda não tem peças nem conjuntos, por isso não pede senha.</div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit" variante="perigo" disabled={m.isPending || isLoading}>{m.isPending ? 'Excluindo…' : 'Excluir projeto'}</Botao>
        </div>
      </form>
    </Modal>
  );
}
