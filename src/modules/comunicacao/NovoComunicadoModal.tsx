import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Search, Send, Smartphone, Users, UsersRound } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Caixa, Campo, CampoArquivo, CampoData, Entrada, Modal, Selo } from '@/shared/ui';
import { anexar, avisarCelulares, enviarComunicado, listarPessoas, listarSetoresAtivos, type Alcance, type Papel, type ResultadoEnvio } from './api';

// Novo comunicado. O líder escolhe o próprio setor ou pessoas dele; quem tem "Comunicado geral" escolhe qualquer um
// ou a empresa toda. O banco confere de novo ao enviar.
export function NovoComunicadoModal({ papel, onFechar }: { papel: Papel; onFechar: () => void }) {
  const { session } = useAuth();
  const eu = session?.user.id;
  const qc = useQueryClient();
  const { data: pessoas = [] } = useQuery({ queryKey: ['comunicacao', 'pessoas'], queryFn: listarPessoas });
  const { data: todosSetores = [] } = useQuery({ queryKey: ['comunicacao', 'setores'], queryFn: listarSetoresAtivos });
  const setores = papel.geral ? todosSetores : todosSetores.filter((s) => papel.setores.includes(s.id));

  const [alcance, setAlcance] = useState<Alcance>(papel.geral ? 'empresa' : 'setores');
  const [setoresSel, setSetoresSel] = useState<string[]>(papel.geral ? [] : papel.setores.slice(0, 1));
  const [pessoasSel, setPessoasSel] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [f, setF] = useState({ titulo: '', texto: '', urgente: false, exige_ciente: false, enviar_email: false, fixado_ate: '' });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ r: ResultadoEnvio | null; falhaAviso: string; falhaAnexo: string } | null>(null);

  // Quem vai receber (o mesmo cálculo do banco: login ativo, sem contar quem envia).
  const alvo = useMemo(() => {
    const ok = pessoas.filter((p) => p.usuario_id && p.usuario_id !== eu);
    if (alcance === 'empresa') return ok;
    if (alcance === 'setores') return ok.filter((p) => setoresSel.includes(p.setor_id));
    return ok.filter((p) => pessoasSel.includes(p.funcionario_id));
  }, [pessoas, alcance, setoresSel, pessoasSel, eu]);
  const semCelular = alvo.filter((p) => !p.aparelhos);
  const semLogin = pessoas.filter((p) => !p.tem_login && (alcance === 'empresa' || (alcance === 'setores' ? setoresSel.includes(p.setor_id) : pessoasSel.includes(p.funcionario_id))));

  const filtradas = pessoas.filter((p) => p.usuario_id !== eu && `${p.nome} ${p.setor} ${p.funcao}`.toLowerCase().includes(busca.toLowerCase()));
  const porSetor = filtradas.reduce<Record<string, typeof pessoas>>((m, p) => ((m[p.setor] ??= []).push(p), m), {});
  const alternar = (lista: string[], id: string) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  async function enviar() {
    setErro('');
    if (f.titulo.trim().length < 3) return setErro('Escreva um título (pelo menos 3 letras).');
    if (!f.texto.trim()) return setErro('Escreva o texto do comunicado.');
    if (alcance === 'setores' && !setoresSel.length) return setErro('Escolha pelo menos um setor.');
    if (alcance === 'pessoas' && !pessoasSel.length) return setErro('Escolha pelo menos uma pessoa.');
    if (!alvo.length) return setErro('Ninguém com login ativo vai receber. Peça ao RH para criar os logins.');
    setEnviando(true);
    try {
      const id = await enviarComunicado({ alcance, setores: setoresSel, pessoas: pessoasSel, ...f, titulo: f.titulo.trim(), texto: f.texto.trim(), fixado_ate: f.fixado_ate || null });
      let falhaAnexo = '';
      if (arquivo) await anexar(id, arquivo).catch((e) => { falhaAnexo = mensagemErro(e); });
      let r: ResultadoEnvio | null = null;
      let falhaAviso = '';
      try { r = await avisarCelulares(id); } catch (e) { falhaAviso = mensagemErro(e); }
      await qc.invalidateQueries({ queryKey: ['comunicacao'] });
      setResultado({ r, falhaAviso, falhaAnexo });
    } catch (e) { setErro(mensagemErro(e)); }
    setEnviando(false);
  }

  if (resultado) {
    const { r, falhaAviso, falhaAnexo } = resultado;
    return (
      <Modal aberto titulo="Comunicado enviado" onFechar={onFechar}>
        <div className="space-y-3 text-sm">
          <p>O comunicado já está na caixa de entrada de {r?.pessoas ?? alvo.length} pessoa{(r?.pessoas ?? alvo.length) === 1 ? '' : 's'}.</p>
          {r && <p className="flex items-center gap-1.5"><Smartphone size={15} className="text-roxo-500" /> Aviso no celular: {r.celular} de {r.pessoas}.</p>}
          {r && f.enviar_email && <p>E-mail: {r.email} enviado{r.email === 1 ? '' : 's'}.</p>}
          {r && r.sem_celular.length > 0 && <Aviso tipo="info">Ainda sem celular ativado: {r.sem_celular.join(', ')}. Essas pessoas veem o comunicado quando abrirem o ERP.</Aviso>}
          {r?.aviso_email && <Aviso>{r.aviso_email}</Aviso>}
          {falhaAviso && <Aviso>O comunicado foi salvo, mas o aviso no celular falhou: {falhaAviso}. Em Enviados, use "Reenviar aviso".</Aviso>}
          {falhaAnexo && <Aviso>O anexo não foi salvo: {falhaAnexo}</Aviso>}
          <div className="flex justify-end"><Botao onClick={onFechar}>Fechar</Botao></div>
        </div>
      </Modal>
    );
  }

  const opcao = (valor: Alcance, rotulo: string, Icone: typeof Users) => (
    <button type="button" onClick={() => setAlcance(valor)} aria-pressed={alcance === valor}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm ring-1 transition-colors ${alcance === valor ? 'bg-roxo-50 font-medium text-roxo-700 ring-roxo-300 dark:bg-roxo-700/30 dark:text-roxo-100' : 'ring-borda hover:bg-pagina'}`}>
      <Icone size={15} /> {rotulo}
    </button>
  );

  return (
    <Modal aberto titulo="Novo comunicado" onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-4">
        {erro && <Aviso>{erro}</Aviso>}
        <div>
          <div className="mb-1.5 text-sm font-medium">Para quem</div>
          <div className="flex flex-wrap gap-2">
            {papel.geral && opcao('empresa', 'Toda a empresa', Building2)}
            {opcao('setores', papel.geral ? 'Setores' : setores.length > 1 ? 'Meus setores' : 'Meu setor', UsersRound)}
            {opcao('pessoas', 'Pessoas', Users)}
          </div>
          {alcance === 'setores' && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {setores.map((s) => <Caixa key={s.id} marcado={setoresSel.includes(s.id)} onChange={() => setSetoresSel(alternar(setoresSel, s.id))}>{s.nome}</Caixa>)}
            </div>
          )}
          {alcance === 'pessoas' && (
            <div className="mt-3 rounded-lg ring-1 ring-borda">
              <div className="relative border-b border-borda">
                <Search size={15} className="absolute left-3 top-2.5 text-suave" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, setor ou função" className="w-full rounded-t-lg bg-transparent py-2 pl-9 pr-3 text-sm outline-none" />
              </div>
              <div className="max-h-56 overflow-y-auto p-2">
                {Object.entries(porSetor).map(([setor, lista]) => (
                  <div key={setor} className="mb-2">
                    <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-suave">{setor}</div>
                    {lista.map((p) => (
                      <div key={p.funcionario_id} className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-pagina">
                        <Caixa marcado={pessoasSel.includes(p.funcionario_id)} disabled={!p.tem_login} onChange={() => setPessoasSel(alternar(pessoasSel, p.funcionario_id))}>
                          <span className={p.tem_login ? '' : 'text-suave'}>{p.nome}</span> <span className="text-xs text-suave">· {p.funcao}</span>
                        </Caixa>
                        {!p.tem_login ? <Selo>sem login</Selo> : !p.aparelhos ? <Selo cor="amarelo">sem celular</Selo> : null}
                      </div>
                    ))}
                  </div>
                ))}
                {!filtradas.length && <div className="p-2 text-sm text-suave">Ninguém encontrado.</div>}
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <Selo cor="azul">{alvo.length} pessoa{alvo.length === 1 ? '' : 's'} vão receber</Selo>
            {semCelular.length > 0 && <Selo cor="amarelo">{semCelular.length} sem celular ativado (veem no ERP{f.enviar_email ? ' e no e-mail' : ''})</Selo>}
            {semLogin.length > 0 && <Selo>{semLogin.length} sem login não recebe{semLogin.length === 1 ? '' : 'm'}</Selo>}
          </div>
        </div>

        <Campo rotulo="Título *"><Entrada value={f.titulo} maxLength={120} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Reunião de segurança amanhã às 7h" /></Campo>
        <Campo rotulo="Texto *"><AreaTexto rows={6} maxLength={5000} value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Anexo (foto ou PDF, opcional)"><CampoArquivo arquivo={arquivo} onChange={setArquivo} accept="application/pdf,image/jpeg,image/png,image/webp" /></Campo>
          <Campo rotulo="Fixar no topo até (opcional)"><CampoData value={f.fixado_ate} onChange={(v) => setF({ ...f, fixado_ate: v })} /></Campo>
        </div>
        <div className="flex flex-col gap-2">
          <Caixa marcado={f.urgente} onChange={(urgente) => setF({ ...f, urgente })}>Urgente (destaque em vermelho e o aviso fica na tela até a pessoa tocar)</Caixa>
          <Caixa marcado={f.exige_ciente} onChange={(exige_ciente) => setF({ ...f, exige_ciente })}>Pedir "Li e estou ciente"</Caixa>
          <Caixa marcado={f.enviar_email} onChange={(enviar_email) => setF({ ...f, enviar_email })}>Também enviar por e-mail</Caixa>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={enviar} disabled={enviando}><Send size={15} /> {enviando ? 'Enviando…' : 'Enviar'}</Botao>
        </div>
      </div>
    </Modal>
  );
}
