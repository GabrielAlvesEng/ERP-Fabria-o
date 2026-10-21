import { useEffect, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { DocumentoPdf, type DadosProposta } from './DocumentoPdf';
import type { DadosEmpresaFabriaco, Documento } from './modelo';

// Carregado sob demanda (o gerador de PDF é pesado): prévia A4 e geração do arquivo.

export const gerarBlob = (doc: Documento, dados: DadosProposta, empresa: DadosEmpresaFabriaco) =>
  pdf(<DocumentoPdf doc={doc} dados={dados} empresa={empresa} />).toBlob();

// Prévia: refaz o PDF 700 ms depois da última alteração e mostra no visualizador do navegador.
export default function Previa({ doc, dados, empresa }: { doc: Documento; dados: DadosProposta; empresa: DadosEmpresaFabriaco }) {
  const [url, setUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(true);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let cancelado = false;
    setGerando(true);
    const t = setTimeout(async () => {
      try {
        const blob = await gerarBlob(doc, dados, empresa);
        if (cancelado) return;
        setErro('');
        setUrl((antigo) => { if (antigo) URL.revokeObjectURL(antigo); return URL.createObjectURL(blob); });
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelado) setGerando(false);
      }
    }, 700);
    return () => { cancelado = true; clearTimeout(t); };
  }, [doc, dados, empresa]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <div className="relative h-full min-h-[70vh] overflow-hidden rounded-xl bg-slate-200 ring-1 ring-borda dark:bg-marinho-800">
      {url && <iframe title="Prévia do PDF" src={`${url}#view=FitH`} className="h-full min-h-[70vh] w-full" />}
      {gerando && <div className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">Atualizando prévia…</div>}
      {erro && <div className="absolute inset-x-3 top-3 rounded-lg bg-red-600 px-3 py-2 text-xs text-white">Erro ao montar o PDF: {erro}</div>}
      <div className="absolute inset-x-0 bottom-0 bg-black/50 px-3 py-1 text-center text-[11px] text-white lg:hidden">No celular a prévia pode não aparecer: use “Baixar PDF”.</div>
    </div>
  );
}
