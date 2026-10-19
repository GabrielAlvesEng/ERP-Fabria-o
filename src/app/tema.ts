export type Tema = 'claro' | 'escuro';

export function lerTema(): Tema {
  try {
    const salvo = localStorage.getItem('erp-tema');
    if (salvo === 'claro' || salvo === 'escuro') return salvo;
  } catch {
    /* armazenamento indisponível */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

export function aplicarTema(t: Tema) {
  document.documentElement.classList.toggle('dark', t === 'escuro');
  try {
    localStorage.setItem('erp-tema', t);
  } catch {
    /* ignora */
  }
}
