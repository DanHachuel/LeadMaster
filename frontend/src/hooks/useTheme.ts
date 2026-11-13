import { useCallback, useEffect, useState } from 'react';

/**
 * Tema claro/escuro (padrão ProdMaker).
 * - Estado em `theme` ('light' | 'dark'); padrão 'dark' (identidade atual);
 * - Persistência em localStorage (`leadmaster_theme`);
 * - Aplicação via atributo `data-theme` no <html> — as cores saem das
 *   variáveis CSS definidas em index.css.
 */
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'leadmaster_theme';
const TEMA_PADRAO: Theme = 'dark';

function lerTema(): Theme {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo === 'light' || salvo === 'dark') return salvo;
  } catch {
    /* localStorage bloqueado (aba privada): usa o padrão */
  }
  return TEMA_PADRAO;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(lerTema);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* persistência é melhor esforço */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((atual) => (atual === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
