// A API do Supabase devolve no máximo 1.000 linhas por consulta: lê em páginas até acabar.
// `montar(de, ate)` deve devolver a consulta com ordem estável (ex.: .order('descricao').order('id')) e .range(de, ate).
const PAGINA = 1000;

export async function lerTudo<T>(montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<{ data: T[]; error: unknown }> {
  const todas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await montar(de, de + PAGINA - 1);
    if (error) return { data: todas, error };
    todas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return { data: todas, error: null };
  }
}
