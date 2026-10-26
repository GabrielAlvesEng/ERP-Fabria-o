import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Aviso, Cabecalho } from '@/shared/ui';
import { FornecedoresAba, MaoObraAba, MaquinarioAba } from './OutrasAbas';
import { SubAbas } from './comum';

const ABAS = ['Fornecedores', 'Mão de obra', 'Maquinário'] as const;

// Administração → Predefinições (decisões 48, 49 e 107): Fornecedores, Mão de obra e Maquinário.
// A Biblioteca de Materiais saiu daqui: quem cadastra e organiza é Compras (Compras → Produtos).
export function PredefinicoesPage() {
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Fornecedores');
  return (
    <>
      <Cabecalho titulo="Predefinições" subtitulo="Tabelas usadas nas propostas. Mudar aqui não altera custos já lançados." />
      <div className="mb-4"><Aviso tipo="info">A Biblioteca de Materiais (chapas, perfis, itens comerciais, fixadores, consumíveis e densidades) agora fica em <Link to="/compras/produtos" className="font-medium underline">Compras → Produtos</Link>. Só Compras cadastra e organiza; os outros setores continuam usando.</Aviso></div>
      <SubAbas abas={ABAS} ativa={aba} onTrocar={setAba} />
      <div key={aba} className="entrar">
        {aba === 'Fornecedores' && <FornecedoresAba />}
        {aba === 'Mão de obra' && <MaoObraAba />}
        {aba === 'Maquinário' && <MaquinarioAba />}
      </div>
    </>
  );
}
