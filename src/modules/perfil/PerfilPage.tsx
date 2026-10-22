import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, PenLine, Trash2 } from 'lucide-react';
import { mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, Campo, CampoData, Entrada, Esqueleto, Selo } from '@/shared/ui';
import { AssinaturaModal, PreviaAssinatura, useMinhaAssinatura } from '@/modules/vendas/vendedores/AssinaturaModal';
import { enviarMinhaFoto, salvarMeuPerfil, tirarMinhaFoto, useMeuUsuario } from './api';
import { Avatar } from './Avatar';
import { MinhaFicha } from '@/modules/rh/MinhaFicha';

// Meu perfil (decisão 68): aberto pelo nome no menu lateral, em qualquer módulo. Cada um edita só os próprios dados.
export function PerfilPage() {
  const qc = useQueryClient();
  const { data: eu, isLoading } = useMeuUsuario();
  const { data: assinatura } = useMinhaAssinatura();
  const [f, setF] = useState({ nome: '', telefone: '', nascimento: '' });
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [ocupado, setOcupado] = useState<'' | 'dados' | 'foto'>('');
  const [assinando, setAssinando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (eu) setF({ nome: eu.nome.includes('.') && !eu.nome.includes(' ') ? '' : eu.nome, telefone: eu.telefone, nascimento: eu.nascimento ?? '' });
  }, [eu]);

  const atualizar = async () => {
    await qc.invalidateQueries({ queryKey: ['meu_usuario'] });
    await qc.invalidateQueries({ queryKey: ['vendedores'] });
  };

  async function salvar() {
    setErro(''); setSalvo(false); setOcupado('dados');
    try {
      await salvarMeuPerfil(f.nome.trim(), f.telefone.trim(), f.nascimento || null);
      await atualizar();
      setSalvo(true);
    } catch (e) { setErro(mensagemErro(e)); }
    setOcupado('');
  }

  async function trocarFoto(lista: FileList | null) {
    const a = lista?.[0];
    if (!a || !eu) return;
    setErro(''); setOcupado('foto');
    try { await enviarMinhaFoto(eu.id, a); await atualizar(); } catch (e) { setErro(mensagemErro(e)); }
    setOcupado('');
    if (arquivo.current) arquivo.current.value = '';
  }

  async function tirarFoto() {
    setErro(''); setOcupado('foto');
    try { await tirarMinhaFoto(); await atualizar(); } catch (e) { setErro(mensagemErro(e)); }
    setOcupado('');
  }

  if (isLoading || !eu) return <><Cabecalho titulo="Meu perfil" /><Esqueleto className="h-64" /></>;

  return (
    <>
      <Cabecalho titulo="Meu perfil" subtitulo="Seus dados pessoais, a foto e a assinatura de e-mail. Valem em todos os módulos do ERP." />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col items-center gap-3 rounded-xl bg-superficie p-5 text-center shadow-sm ring-1 ring-borda">
          <Avatar caminho={eu.foto_caminho} versao={eu.foto_atualizada_em} nome={eu.nome} tamanho={120} />
          <div>
            <div className="font-semibold">{eu.nome}</div>
            <div className="text-xs text-suave">{eu.email}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {eu.perfis.length ? eu.perfis.map((p) => <Selo key={p} cor="roxo">{p}</Selo>) : <Selo>Sem perfil de acesso</Selo>}
          </div>
          <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => trocarFoto(e.target.files)} />
          <div className="flex flex-wrap justify-center gap-2">
            <Botao variante="secundario" tamanho="sm" onClick={() => arquivo.current?.click()} disabled={ocupado === 'foto'}>
              <Camera size={14} /> {ocupado === 'foto' ? 'Enviando…' : eu.foto_caminho ? 'Trocar foto' : 'Colocar foto'}
            </Botao>
            {eu.foto_caminho && <Botao variante="fantasma" tamanho="sm" className="text-red-600" onClick={tirarFoto} disabled={ocupado === 'foto'}><Trash2 size={14} /> Tirar</Botao>}
          </div>
          <p className="text-xs text-suave">A foto é recortada no centro, em quadrado, e aparece nos cartões do ERP.</p>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-superficie p-5 shadow-sm ring-1 ring-borda">
            <h2 className="mb-3 font-semibold">Dados pessoais</h2>
            {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
            {salvo && <div className="mb-3"><Aviso tipo="info">Dados salvos.</Aviso></div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome completo *"><Entrada value={f.nome} onChange={(e) => { setF({ ...f, nome: e.target.value }); setSalvo(false); }} placeholder="Ex.: Pedro Vinicius" /></Campo>
              <Campo rotulo="E-mail (login)"><Entrada value={eu.email} disabled /></Campo>
              <Campo rotulo="Telefone / WhatsApp"><Entrada value={f.telefone} onChange={(e) => { setF({ ...f, telefone: e.target.value }); setSalvo(false); }} placeholder="(19) 90000-0000" /></Campo>
              <Campo rotulo="Data de nascimento"><CampoData value={f.nascimento} onChange={(v) => { setF({ ...f, nascimento: v }); setSalvo(false); }} /></Campo>
            </div>
            <div className="mt-4 flex justify-end"><Botao onClick={salvar} disabled={ocupado === 'dados'}>{ocupado === 'dados' ? 'Salvando…' : 'Salvar dados'}</Botao></div>
          </div>

          <div className="rounded-xl bg-superficie p-5 shadow-sm ring-1 ring-borda">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 font-semibold"><PenLine size={16} className="text-roxo-500 dark:text-roxo-300" /> Assinatura de e-mail</h2>
              <Botao variante="secundario" tamanho="sm" onClick={() => setAssinando(true)}>{assinatura?.html ? 'Trocar assinatura' : 'Importar do Outlook'}</Botao>
            </div>
            {assinatura?.html
              ? <PreviaAssinatura html={assinatura.html} />
              : <p className="text-sm text-suave">Ainda sem assinatura. Ela vai no fim dos e-mails de proposta enviados pelo ERP, igual à do seu Outlook.</p>}
          </div>

          <MinhaFicha />
        </div>
      </div>
      {assinando && <AssinaturaModal onFechar={() => setAssinando(false)} />}
    </>
  );
}
