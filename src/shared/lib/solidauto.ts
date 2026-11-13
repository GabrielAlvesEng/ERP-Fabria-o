// "Entrar com o ERP" do SolidAuto (app da Engenharia no Windows). O app abre o ERP com
// ?solidauto=<porta>&estado=<texto> e fica esperando em http://127.0.0.1:<porta>/erp.
// O pedido é guardado na aba (sessionStorage) para sobreviver ao login, se a pessoa ainda não estiver logada.
const CHAVE = 'solidauto-login';

export interface PedidoSolidAuto { porta: number; estado: string }

export function lerPedidoSolidAuto(busca: string, guardado: string | null): PedidoSolidAuto | null {
  const p = new URLSearchParams(busca);
  const porta = Number(p.get('solidauto'));
  const estado = p.get('estado') ?? '';
  if (Number.isInteger(porta) && porta >= 1024 && porta <= 65535 && /^[A-Za-z0-9_-]{16,128}$/.test(estado)) return { porta, estado };
  if (!guardado) return null;
  try {
    const g = JSON.parse(guardado) as PedidoSolidAuto;
    return Number.isInteger(g.porta) && g.porta >= 1024 && g.porta <= 65535 && /^[A-Za-z0-9_-]{16,128}$/.test(g.estado) ? g : null;
  } catch {
    return null;
  }
}

/** Endereço local do app que recebe o código de uso único. */
export const retornoSolidAuto = (pedido: PedidoSolidAuto, tokenHash: string) =>
  `http://127.0.0.1:${pedido.porta}/erp?estado=${encodeURIComponent(pedido.estado)}&token_hash=${encodeURIComponent(tokenHash)}`;

export const cancelarSolidAuto = (pedido: PedidoSolidAuto) =>
  `http://127.0.0.1:${pedido.porta}/erp?estado=${encodeURIComponent(pedido.estado)}&cancelado=1`;

export const pedidoSolidAutoInicial: PedidoSolidAuto | null = typeof window === 'undefined'
  ? null
  : lerPedidoSolidAuto(window.location.search, sessionStorage.getItem(CHAVE));

export function guardarPedidoSolidAuto(pedido: PedidoSolidAuto | null) {
  if (pedido) sessionStorage.setItem(CHAVE, JSON.stringify(pedido));
  else sessionStorage.removeItem(CHAVE);
}
