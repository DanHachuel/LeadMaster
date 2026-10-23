// Utilitários de formatação e helpers de UI.

import type { Lead } from './types';

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function primeiraLetra(texto: string): string {
  return (texto || '?').trim().charAt(0).toUpperCase() || '?';
}

export function dataHora(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function soHora(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function mascararTelefone(valor?: string): string {
  const d = (valor || '').replace(/\D/g, '');
  if (!d) return '—';
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor || '—';
}

/** Completude do lead (Efeito Zeigarnik): % de campos essenciais preenchidos. */
export function completude(lead: Partial<Lead>): number {
  const campos = ['nome', 'telefone', 'email', 'empresa', 'cidade', 'observacoes'];
  const preenchidos = campos.filter((c) => String((lead as Record<string, unknown>)[c] || '').trim().length > 0);
  return Math.round((preenchidos.length / campos.length) * 100);
}

/** Campos que faltam no lead, para a mensagem motivacional. */
export function camposFaltantes(lead: Partial<Lead>): string[] {
  const rotulos: Record<string, string> = {
    nome: 'nome',
    telefone: 'telefone',
    email: 'e-mail',
    empresa: 'empresa',
    cidade: 'cidade',
    observacoes: 'observações',
  };
  const campos = ['nome', 'telefone', 'email', 'empresa', 'cidade', 'observacoes'];
  return campos
    .filter((c) => String((lead as Record<string, unknown>)[c] || '').trim().length === 0)
    .map((c) => rotulos[c]);
}

/** Gradiente de Meta: mensagem motivacional a partir do que falta. */
export function mensagemMeta(porcentagem: number, faltam: string[]): string {
  if (porcentagem >= 100) return 'Lead 100% completo — excelente! 🎉';
  const proximos = faltam.slice(0, 2).join(' e ');
  return `Faltam ${100 - porcentagem}% (${proximos}${faltam.length > 2 ? '...' : ''}) para o lead ficar completo`;
}

export function downloadJson(dados: unknown, nomeArquivo: string): void {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
