import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Download, ImageUp } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Campo, Entrada, Modal } from '@/shared/ui';
import type { Funcionario } from '../api';
import { faltaParaAssinatura, montarHtmlAssinatura, type DadosAssinatura } from './assinatura';
import { canvasParaBlob, desenharBanner, fotoDeBlob } from './banner';

const paraDataUrl = (b: Blob) => new Promise<string>((ok, falha) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => falha(new Error('Não foi possível ler a imagem.'));
  r.readAsDataURL(b);
});

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// RH → ficha → "Assinatura de e-mail" (decisão 89): gera a imagem no padrão da Fabriaço com os dados da ficha
// e a foto do perfil. Os campos aqui ajustam só a assinatura; a ficha não muda.
export default function AssinaturaGeradaModal({ funcionario, cargo, onFechar }: { funcionario: Funcionario; cargo: string; onFechar: () => void }) {
  const qc = useQueryClient();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [d, setD] = useState<DadosAssinatura>({
    nome: funcionario.nome,
    cargo,
    email: funcionario.email_corporativo || funcionario.usuarios?.email || '',
    telefone: funcionario.telefone,
  });
  const [foto, setFoto] = useState<HTMLImageElement | null>(null);
  const [carregandoFoto, setCarregandoFoto] = useState(Boolean(funcionario.usuarios?.foto_caminho));
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState('');
  const falta = faltaParaAssinatura(d);

  // Foto do Meu perfil do funcionário (baixada como blob para poder virar imagem).
  useEffect(() => {
    const caminho = funcionario.usuarios?.foto_caminho;
    if (!caminho) return;
    let vivo = true;
    supabase.storage.from('perfis').download(caminho)
      .then(async ({ data, error }) => { if (error || !data) throw error; const img = await fotoDeBlob(data); if (vivo) setFoto(img); })
      .catch(() => vivo && setAviso('Não foi possível carregar a foto do perfil. Escolha uma foto ou gere sem foto.'))
      .finally(() => vivo && setCarregandoFoto(false));
    return () => { vivo = false; };
  }, [funcionario.usuarios?.foto_caminho]);

  // Prévia: redesenha meio segundo depois da última alteração.
  useEffect(() => {
    if (carregandoFoto || !canvas.current) return;
    const t = setTimeout(() => { desenharBanner(canvas.current!, d, foto, 1).catch((e) => setErro(mensagemErro(e))); }, 300);
    return () => clearTimeout(t);
  }, [d, foto, carregandoFoto]);

  async function gerar(escala: number, tipo: 'image/png' | 'image/jpeg') {
    const c = document.createElement('canvas');
    await desenharBanner(c, d, foto, escala);
    return canvasParaBlob(c, tipo, 0.9);
  }
  // Para o e-mail vai em JPEG 1200 px (nítido na largura de 15 cm e leve).
  const htmlAssinatura = async () => montarHtmlAssinatura(d, await paraDataUrl(await gerar(1, 'image/jpeg')));

  async function executar(acao: string, f: () => Promise<string>) {
    setErro(''); setAviso(''); setOcupado(acao);
    try { setAviso(await f()); } catch (e) { setErro(mensagemErro(e)); }
    setOcupado('');
  }

  const nomeArquivo = `Assinatura de e-mail ${d.nome.trim()}`;
  const campo = (k: keyof DadosAssinatura) => ({ value: d[k], onChange: (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value }) });

  return (
    <Modal aberto titulo="Assinatura de e-mail" onFechar={onFechar} largura="max-w-4xl">
      <div className="space-y-4 text-sm">
        <p className="text-suave">Gerada no padrão da Fabriaço com os dados da ficha e a foto do Meu perfil. Ajustes aqui valem só para a assinatura.</p>
        {erro && <Aviso>{erro}</Aviso>}
        {aviso && <Aviso tipo="info">{aviso}</Aviso>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome"><Entrada {...campo('nome')} /></Campo>
          <Campo rotulo="Função"><Entrada {...campo('cargo')} /></Campo>
          <Campo rotulo="E-mail"><Entrada type="email" {...campo('email')} /></Campo>
          <Campo rotulo="Telefone"><Entrada {...campo('telefone')} /></Campo>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-lg bg-superficie px-2.5 text-xs font-medium shadow-sm ring-1 ring-borda hover:bg-pagina">
            <ImageUp size={14} /> {foto ? 'Trocar a foto' : 'Escolher uma foto'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { try { setFoto(await fotoDeBlob(f)); } catch (x) { setErro(mensagemErro(x)); } } }} />
          </label>
          {foto && <Botao variante="fantasma" tamanho="sm" onClick={() => setFoto(null)}>Sem foto</Botao>}
          <span className="text-xs text-suave">{carregandoFoto ? 'Carregando a foto do perfil…' : 'Foto em pé (retrato), com o rosto na parte de cima, fica melhor.'}</span>
        </div>

        <canvas ref={canvas} className="aspect-[1200/512] w-full rounded-xl bg-pagina ring-1 ring-borda" />

        {falta.length > 0 && <Aviso>Falta preencher: {falta.join(', ')}.</Aviso>}

        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="secundario" disabled={Boolean(ocupado) || falta.length > 0}
            onClick={() => executar('png', async () => { baixar(await gerar(2, 'image/png'), `${nomeArquivo}.png`); return 'Imagem baixada.'; })}>
            <Download size={15} /> {ocupado === 'png' ? 'Gerando…' : 'Baixar imagem (PNG)'}
          </Botao>
          <Botao variante="secundario" disabled={Boolean(ocupado) || falta.length > 0}
            onClick={() => executar('copiar', async () => {
              const html = await htmlAssinatura();
              await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([d.nome], { type: 'text/plain' }) })]);
              return 'Assinatura copiada. No Outlook: Arquivo → Opções → Email → Assinaturas → Nova, e cole (Ctrl+V).';
            })}>
            <Copy size={15} /> {ocupado === 'copiar' ? 'Copiando…' : 'Copiar para o Outlook'}
          </Botao>
          {funcionario.usuario_id ? (
            <Botao disabled={Boolean(ocupado) || falta.length > 0}
              onClick={() => executar('usar', async () => {
                const { error } = await supabase.rpc('salvar_assinatura_gerada', { p_usuario: funcionario.usuario_id, p_html: await htmlAssinatura() });
                if (error) throw error;
                await qc.invalidateQueries({ queryKey: ['minha_assinatura'] });
                return 'Pronto: esta assinatura vai no fim dos e-mails de proposta enviados por esta pessoa no ERP.';
              })}>
              <Check size={15} /> {ocupado === 'usar' ? 'Salvando…' : 'Usar nos e-mails do ERP'}
            </Botao>
          ) : <span className="self-center text-xs text-suave">Sem login no ERP: dá para baixar ou copiar, mas não usar nos e-mails do ERP.</span>}
        </div>
      </div>
    </Modal>
  );
}
