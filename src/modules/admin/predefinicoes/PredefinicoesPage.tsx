import { useState } from 'react';
import { Cabecalho } from '@/shared/ui';
import { ChapasAba } from './ChapasAba';
import { PerfisAba } from './PerfisAba';
import { FornecedoresAba, ItensAba, MaoObraAba, MaquinarioAba, MateriaisBaseAba, RevisarAba } from './OutrasAbas';
import { FixadoresAba } from './FixadoresAba';
import { SubAbas } from './comum';

const ABAS = ['Materiais', 'Fornecedores', 'Mão de obra', 'Maquinário'] as const;
const ABAS_MATERIAIS = ['Chapas', 'Perfis', 'Itens comerciais', 'Fixadores', 'Consumíveis', 'Materiais e densidades', 'A revisar'] as const;

// Administração → Predefinições (decisões 48 e 49): Biblioteca de Materiais, Fornecedores, Mão de obra e Maquinário.
// Comercial lê (usa nas propostas); só a Administração grava (RLS no banco).
export function PredefinicoesPage() {
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Materiais');
  const [sub, setSub] = useState<(typeof ABAS_MATERIAIS)[number]>('Chapas');
  return (
    <>
      <Cabecalho titulo="Predefinições" subtitulo="Tabelas usadas nas propostas e, depois, na Engenharia e em Compras. Mudar aqui não altera custos já lançados." />
      <SubAbas abas={ABAS} ativa={aba} onTrocar={setAba} />
      <div key={aba} className="entrar">
      {aba === 'Materiais' && (
        <>
          <SubAbas abas={ABAS_MATERIAIS} ativa={sub} onTrocar={setSub} />
          <div key={sub} className="entrar">
          {sub === 'Chapas' && <ChapasAba />}
          {sub === 'Perfis' && <PerfisAba />}
          {sub === 'Itens comerciais' && <ItensAba grupo="Comerciais" />}
          {sub === 'Fixadores' && <FixadoresAba />}
          {sub === 'Consumíveis' && <ItensAba grupo="Consumíveis" />}
          {sub === 'Materiais e densidades' && <MateriaisBaseAba />}
          {sub === 'A revisar' && <RevisarAba />}
          </div>
        </>
      )}
      {aba === 'Fornecedores' && <FornecedoresAba />}
      {aba === 'Mão de obra' && <MaoObraAba />}
      {aba === 'Maquinário' && <MaquinarioAba />}
      </div>
    </>
  );
}
