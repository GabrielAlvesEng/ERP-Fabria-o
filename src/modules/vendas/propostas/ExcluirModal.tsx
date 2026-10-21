import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, Entrada, Modal } from '@/shared/ui';
import type { Proposta } from '../types';

// Exclusão lógica (planejamento 4.8): rascunho nunca enviado só pede justificativa; enviada pede a senha administrativa.
export function ExcluirModal({ proposta, onFechar, onExcluida }: { proposta: Proposta; onFechar: () => void; onExcluida: () => void }) {
  const qc = useQueryClient();
  const [just, setJust] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const { data: exigeSenha, isLoading } = useQuery({
    queryKey: ['exclusao_exige_senha', proposta.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('exclusao_exige_senha', { p_id: proposta.id });
      if (error) throw error;
      return Boolean(data);
    },
  });

  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('excluir_proposta', { p_id: proposta.id, p_justificativa: just, p_senha: exigeSenha ? senha : null });
      if (error) throw error;
      if (data === 'senha_incorreta') throw new Error('Senha administrativa incorreta. Depois de 5 tentativas erradas, a exclusão fica bloqueada por 15 minutos.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propostas'] });
      onExcluida();
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
    <Modal aberto titulo={`Excluir a proposta ${proposta.codigo}?`} onFechar={onFechar}>
      <form className="space-y-3" onSubmit={enviar}>
        <Aviso tipo="info">
          A proposta sai das listas, mas nada é apagado: histórico, revisões e arquivos ficam guardados, e a Administração pode restaurá-la. O código {proposta.codigo} não é reaproveitado.
        </Aviso>
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="Justificativa *"><AreaTexto value={just} onChange={(e) => setJust(e.target.value)} placeholder="Ex.: proposta criada em duplicidade" /></Campo>
        {isLoading ? null : exigeSenha ? (
          <Campo rotulo="Senha administrativa (Excluir Proposta) *">
            <Entrada type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Campo>
        ) : (
          <div className="text-xs text-suave">Esta proposta nunca foi enviada ao cliente, por isso não pede senha.</div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit" variante="perigo" disabled={m.isPending || isLoading}>{m.isPending ? 'Excluindo…' : 'Excluir proposta'}</Botao>
        </div>
      </form>
    </Modal>
  );
}
