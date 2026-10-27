// Agenda (decisão 118): o que a tela calcula sozinha, sem banco. Datas na hora local do aparelho (Brasília).
// A repetição fica guardada como regra no compromisso; aqui ela vira os dias em que o compromisso acontece.

export type Repeticao = 'diaria' | 'semanal' | 'mensal' | 'anual';
export type Cor = 'roxo' | 'azul' | 'verde' | 'amarelo' | 'vermelho' | 'cinza';

export interface CompromissoBase {
  id: string; titulo: string | null; inicio: string; fim: string; dia_inteiro: boolean;
  repeticao: Repeticao | null; repetir_intervalo: number; repetir_dias: number[] | null; repetir_ate: string | null; excecoes: string[];
}
export interface Ocorrencia<T extends CompromissoBase = CompromissoBase> { c: T; inicio: Date; fim: Date; dia: string }

export const CORES: { valor: Cor; rotulo: string; fundo: string; ponto: string }[] = [
  { valor: 'roxo', rotulo: 'Roxo', fundo: 'bg-roxo-50 text-roxo-700 dark:bg-roxo-500/25 dark:text-roxo-100', ponto: 'bg-roxo-500' },
  { valor: 'azul', rotulo: 'Azul', fundo: 'bg-sky-50 text-sky-800 dark:bg-sky-500/20 dark:text-sky-100', ponto: 'bg-sky-500' },
  { valor: 'verde', rotulo: 'Verde', fundo: 'bg-petroleo-50 text-petroleo-700 dark:bg-petroleo-600/30 dark:text-teal-100', ponto: 'bg-petroleo-500' },
  { valor: 'amarelo', rotulo: 'Amarelo', fundo: 'bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100', ponto: 'bg-amber-500' },
  { valor: 'vermelho', rotulo: 'Vermelho', fundo: 'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-100', ponto: 'bg-red-600' },
  { valor: 'cinza', rotulo: 'Cinza', fundo: 'bg-slate-100 text-slate-700 dark:bg-marinho-700 dark:text-slate-200', ponto: 'bg-slate-400' },
];
export const corInfo = (c: string | null | undefined) => CORES.find((x) => x.valor === c) ?? CORES[0]!;

export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_SEMANA_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const DIA_MS = 86_400_000;
const p2 = (n: number) => String(n).padStart(2, '0');
// Dia local no formato do banco (AAAA-MM-DD).
export const isoDia = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const deIsoDia = (s: string) => { const [a, m, d] = s.split('-').map(Number); return new Date(a!, m! - 1, d!); };
export const hora = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Os dias em que o compromisso começa, entre de e ate (só os que tocam esse intervalo).
export function expandir<T extends CompromissoBase>(c: T, de: Date, ate: Date): Ocorrencia<T>[] {
  const ini = new Date(c.inicio);
  const dur = new Date(c.fim).getTime() - ini.getTime();
  const oc = (inicio: Date): Ocorrencia<T> => ({ c, inicio, fim: new Date(inicio.getTime() + dur), dia: isoDia(inicio) });
  const toca = (o: Ocorrencia<T>) => o.fim > de && o.inicio < ate;
  if (!c.repeticao) { const o = oc(ini); return toca(o) ? [o] : []; }

  const passo = Math.max(1, c.repetir_intervalo || 1);
  const [y, m, d, h, mi] = [ini.getFullYear(), ini.getMonth(), ini.getDate(), ini.getHours(), ini.getMinutes()];
  const em = (ano: number, mes: number, dia: number) => new Date(ano, mes, dia, h, mi);
  const excecoes = new Set(c.excecoes ?? []);
  const fora = (o: Ocorrencia<T>) => excecoes.has(o.dia) || (c.repetir_ate !== null && o.dia > c.repetir_ate);
  const saida: Ocorrencia<T>[] = [];
  // Pula direto para perto de "de" (compromisso diário de anos atrás não precisa passar dia por dia).
  const pularDias = Math.max(0, Math.floor((de.getTime() - dur - ini.getTime()) / DIA_MS) - 1);

  for (let k = 0, n = 0; n < 5000; k++, n++) {
    let candidatos: Date[] = [];
    if (c.repeticao === 'diaria') {
      const k0 = k + Math.floor(pularDias / passo);
      candidatos = [em(y, m, d + k0 * passo)];
    } else if (c.repeticao === 'semanal') {
      const k0 = k + Math.floor(pularDias / (7 * passo));
      const domingo = d - ini.getDay() + k0 * 7 * passo;
      const dias = [...(c.repetir_dias?.length ? c.repetir_dias : [ini.getDay()])].sort((a, b) => a - b);
      candidatos = dias.map((dia) => em(y, m, domingo + dia)).filter((x) => x >= ini);
    } else {
      const meses = c.repeticao === 'mensal' ? k * passo : k * passo * 12;
      const x = em(y, m + meses, d);
      // Dia 31 (ou 29/02) só nos meses que têm esse dia.
      candidatos = x.getDate() === d ? [x] : [];
      if (x >= ate) break;
    }
    if (!candidatos.length) continue;
    if (candidatos[0]! >= ate || (c.repetir_ate !== null && isoDia(candidatos[0]!) > c.repetir_ate)) break;
    for (const x of candidatos) {
      const o = oc(x);
      if (!fora(o) && toca(o)) saida.push(o);
    }
  }
  return saida;
}

// Todas as ocorrências de uma lista, em ordem (no mesmo horário, o de dia inteiro primeiro).
export function ocorrencias<T extends CompromissoBase>(lista: T[], de: Date, ate: Date): Ocorrencia<T>[] {
  return lista.flatMap((c) => expandir(c, de, ate)).sort((a, b) =>
    a.inicio.getTime() - b.inicio.getTime() || Number(b.c.dia_inteiro) - Number(a.c.dia_inteiro) || a.fim.getTime() - b.fim.getTime());
}

// As ocorrências que aparecem num dia (um compromisso de vários dias aparece em cada um).
export function doDia<T extends CompromissoBase>(ocs: Ocorrencia<T>[], dia: string): Ocorrencia<T>[] {
  const ini = deIsoDia(dia);
  const fim = somarDias(ini, 1);
  return ocs.filter((o) => o.inicio < fim && o.fim > ini);
}

// As 6 semanas (domingo a sábado) que a tela do mês mostra.
export function semanasDoMes(ano: number, mes: number): Date[][] {
  const primeiro = new Date(ano, mes, 1);
  const inicio = somarDias(primeiro, -primeiro.getDay());
  return Array.from({ length: 6 }, (_, s) => Array.from({ length: 7 }, (_, d) => somarDias(inicio, s * 7 + d)));
}
export const inicioDaSemana = (d: Date) => somarDias(inicioDoDia(d), -d.getDay());

// Compromissos que se sobrepõem na grade de horários ficam lado a lado: coluna de cada um e quantas colunas o grupo tem.
export function colunas<T extends CompromissoBase>(ocs: Ocorrencia<T>[]): { o: Ocorrencia<T>; coluna: number; total: number }[] {
  const ord = [...ocs].sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || b.fim.getTime() - a.fim.getTime());
  const saida: { o: Ocorrencia<T>; coluna: number; total: number }[] = [];
  let grupo: typeof saida = [];
  let fimGrupo = 0;
  const fechar = () => { const total = Math.max(1, ...grupo.map((g) => g.coluna + 1)); grupo.forEach((g) => { g.total = total; }); saida.push(...grupo); grupo = []; };
  for (const o of ord) {
    if (grupo.length && o.inicio.getTime() >= fimGrupo) fechar();
    const ocupadas = new Set(grupo.filter((g) => g.o.fim > o.inicio).map((g) => g.coluna));
    let coluna = 0;
    while (ocupadas.has(coluna)) coluna++;
    grupo.push({ o, coluna, total: 1 });
    fimGrupo = Math.max(fimGrupo, o.fim.getTime());
  }
  if (grupo.length) fechar();
  return saida;
}

export function descreverRepeticao(c: Pick<CompromissoBase, 'repeticao' | 'repetir_intervalo' | 'repetir_dias' | 'repetir_ate' | 'inicio'>): string {
  if (!c.repeticao) return 'Não se repete';
  const n = Math.max(1, c.repetir_intervalo || 1);
  const ini = new Date(c.inicio);
  let t: string;
  if (c.repeticao === 'diaria') t = n === 1 ? 'Todo dia' : `A cada ${n} dias`;
  else if (c.repeticao === 'semanal') {
    const dias = (c.repetir_dias?.length ? c.repetir_dias : [ini.getDay()]).slice().sort((a, b) => a - b).map((d) => DIAS_SEMANA_LONGO[d]);
    const lista = dias.length > 1 ? `${dias.slice(0, -1).join(', ')} e ${dias.at(-1)}` : dias[0];
    t = `${n === 1 ? 'Toda semana' : `A cada ${n} semanas`}: ${lista}`;
  } else if (c.repeticao === 'mensal') t = `${n === 1 ? 'Todo mês' : `A cada ${n} meses`}, no dia ${ini.getDate()}`;
  else t = `${n === 1 ? 'Todo ano' : `A cada ${n} anos`}, em ${ini.getDate()} de ${MESES[ini.getMonth()]}`;
  if (c.repetir_ate) { const [a, m, d] = c.repetir_ate.split('-'); t += `, até ${d}/${m}/${a}`; }
  return t;
}

export function quando(o: Ocorrencia): string {
  const dia = (d: Date) => `${DIAS_SEMANA_LONGO[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
  if (o.c.dia_inteiro) {
    const ultimo = somarDias(o.fim, -1);
    return isoDia(ultimo) > o.dia ? `${dia(o.inicio)} até ${dia(ultimo)} (dia inteiro)` : `${dia(o.inicio)} (dia inteiro)`;
  }
  return isoDia(o.fim) > o.dia && !(o.fim.getHours() === 0 && o.fim.getMinutes() === 0 && isoDia(somarDias(o.fim, -1)) === o.dia)
    ? `${dia(o.inicio)}, ${hora(o.inicio)} até ${dia(o.fim)}, ${hora(o.fim)}`
    : `${dia(o.inicio)}, ${hora(o.inicio)} às ${hora(o.fim)}`;
}

// Lembretes dentro do ERP (seção 4 do planejamento, respostas 4 e 5) -------------------------------------------
export const VESPERA = { h: 16, m: 30 };
export const HORARIO_COMERCIAL = { de: 7, ate: 18 };
export const ANTECEDENCIA_MIN = 15;

export type TipoLembrete = 'vespera' | 'hora' | 'quinze';
export interface Lembrete<T extends CompromissoBase = CompromissoBase> { chave: string; tipo: TipoLembrete; titulo: string; texto: string; o: Ocorrencia<T> }

const nome = (o: Ocorrencia) => o.c.titulo ?? 'Compromisso';
const comLocal = (o: Ocorrencia & { c: { local?: string | null } }) => (o.c.local ? `, ${o.c.local}` : '');
const falta = (ms: number) => {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `em ${min} min`;
  const h = Math.floor(min / 60); const r = min % 60;
  return r ? `em ${h}h${p2(r)}` : `em ${h}h`;
};

// O que precisa aparecer agora e ainda não apareceu (as chaves já mostradas ficam guardadas no aparelho).
// ocs: as minhas ocorrências de hoje e de amanhã.
export function lembretesDevidos<T extends CompromissoBase & { local?: string | null }>(ocs: Ocorrencia<T>[], agora: Date, mostrados: Set<string>): Lembrete<T>[] {
  const hoje = isoDia(agora);
  const amanha = isoDia(somarDias(agora, 1));
  const saida: Lembrete<T>[] = [];
  const com = (l: Lembrete<T>) => { if (!mostrados.has(l.chave)) saida.push(l); };

  // Faltando 15 minutos (só os com horário).
  for (const o of ocs) {
    const ms = o.inicio.getTime() - agora.getTime();
    if (!o.c.dia_inteiro && ms > 0 && ms <= ANTECEDENCIA_MIN * 60_000) {
      com({ chave: `quinze:${o.c.id}:${o.inicio.toISOString()}`, tipo: 'quinze', titulo: `${falta(ms)[0]!.toUpperCase()}${falta(ms).slice(1)}: ${nome(o)}`,
        texto: `${hora(o.inicio)} às ${hora(o.fim)}${comLocal(o)}`, o });
    }
  }

  // De hora em hora, no horário comercial: o próximo do dia (e quantos ainda faltam).
  const h = agora.getHours();
  if (h >= HORARIO_COMERCIAL.de && h <= HORARIO_COMERCIAL.ate) {
    const proximos = ocs.filter((o) => o.dia === hoje && !o.c.dia_inteiro && o.inicio > agora);
    const prox = proximos[0];
    // Se ele já está a 15 minutos, o aviso dos 15 minutos basta.
    if (prox && prox.inicio.getTime() - agora.getTime() > ANTECEDENCIA_MIN * 60_000) {
      const mais = proximos.length - 1;
      com({ chave: `hora:${hoje}T${p2(h)}`, tipo: 'hora', titulo: `Próximo: ${hora(prox.inicio)} ${nome(prox)}`,
        texto: `${falta(prox.inicio.getTime() - agora.getTime())[0]!.toUpperCase()}${falta(prox.inicio.getTime() - agora.getTime()).slice(1)}${comLocal(prox)}${mais > 0 ? ` · depois dele, mais ${mais} hoje` : ''}`, o: prox });
    }
  }

  // Véspera, a partir das 16:30: o primeiro de amanhã (o de horário; se só tiver de dia inteiro, ele).
  if (h * 60 + agora.getMinutes() >= VESPERA.h * 60 + VESPERA.m) {
    const deAmanha = ocs.filter((o) => o.dia === amanha);
    const prim = deAmanha.find((o) => !o.c.dia_inteiro) ?? deAmanha[0];
    if (prim) {
      com({ chave: `vespera:${amanha}`, tipo: 'vespera',
        titulo: prim.c.dia_inteiro ? `Amanhã: ${nome(prim)} (dia inteiro)` : `Amanhã, o primeiro é ${hora(prim.inicio)} ${nome(prim)}`,
        texto: `${deAmanha.length > 1 ? `${deAmanha.length} compromissos amanhã` : '1 compromisso amanhã'}${comLocal(prim)}`, o: prim });
    }
  }
  return saida;
}

// Para o sino: o que ainda falta hoje e o primeiro de amanhã.
export function resumoSino<T extends CompromissoBase>(ocs: Ocorrencia<T>[], agora: Date) {
  const hoje = isoDia(agora);
  const amanha = isoDia(somarDias(agora, 1));
  return {
    hoje: ocs.filter((o) => o.dia <= hoje && o.fim > agora && (o.dia === hoje || o.c.dia_inteiro)),
    amanha: ocs.filter((o) => o.dia === amanha).slice(0, 1),
  };
}
