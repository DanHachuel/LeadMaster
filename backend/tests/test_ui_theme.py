"""Gate de regressão da UI — modo claro/escuro (tema).

Falha se alguma peça do tema desaparecer:
- hook `useTheme` (localStorage `leadmaster_theme`, `data-theme`, toggle);
- botão de alternância no Header (aria-label/title);
- variáveis CSS em index.css com os dois temas;
- camada de remapeamento (main ...).
"""

import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
HOOK = RAIZ / "frontend" / "src" / "hooks" / "useTheme.ts"
HEADER = RAIZ / "frontend" / "src" / "components" / "Header.tsx"
CSS = RAIZ / "frontend" / "src" / "index.css"


class TestTemaUI:
    def test_hook_use_theme(self):
        assert HOOK.exists(), f"hook não encontrado em {HOOK}"
        c = HOOK.read_text(encoding="utf-8")
        assert "leadmaster_theme" in c  # persistência
        assert "document.documentElement.setAttribute('data-theme', theme)" in c
        assert "toggleTheme" in c
        assert "'dark'" in c  # padrão escuro (identidade atual)
        assert "'light'" in c

    def test_botao_de_alternancia_no_header(self):
        assert HEADER.exists(), f"Header não encontrado em {HEADER}"
        c = HEADER.read_text(encoding="utf-8")
        assert "useTheme" in c
        assert "toggleTheme" in c
        assert "Alternar para tema claro" in c
        assert "Alternar para tema escuro" in c
        assert "aria-label" in c
        assert "fa-sun" in c and "fa-moon" in c  # sol (dark→claro) / lua (claro→escuro)

    def test_variaveis_css_nos_dois_temas(self):
        assert CSS.exists(), f"index.css não encontrado em {CSS}"
        c = CSS.read_text(encoding="utf-8")
        for variavel in (
            "--bg-primary",
            "--bg-secondary",
            "--text-primary",
            "--text-secondary",
            "--border-color",
        ):
            assert variavel in c, f"variável {variavel} ausente"
        assert "[data-theme='dark']" in c or '[data-theme="dark"]' in c
        assert "[data-theme='light']" in c or '[data-theme="light"]' in c

    def test_camada_de_remapeamento(self):
        c = CSS.read_text(encoding="utf-8")
        # As utilities do app são remapeadas para as variáveis (ordem importa).
        assert re.search(r"\.bg-white\s*\{\s*background-color:\s*var\(--bg-secondary\)", c)
        assert re.search(r"\.bg-gray-100\s*\{\s*background-color:\s*var\(--bg-primary\)", c)
        assert re.search(r"main \.text-gray-800", c)
        assert "var(--border-color)" in c
