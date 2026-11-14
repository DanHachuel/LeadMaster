# MANUAL.md — Guia Completo do LeadMaster

> Como usar cada tela do LeadMaster. Linguagem simples, sem "tecniquês".
> O que o app faz, o que cada configuração significa e o que fazer quando algo não funciona.

---

## Índice

1. [Começando](#1-começando)
2. [Ferramentas (configurações)](#2-ferramentas-configurações)
3. [Painel e Funil](#3-painel-e-funil)
4. [CRM (Kanban)](#4-crm-kanban)
5. [Extratores de leads](#5-extratores-de-leads)
6. [Disparos e Cadências](#6-disparos-e-cadências)
7. [Agentes e Conexões](#7-agentes-e-conexões)
8. [Relatórios](#8-relatórios)
9. [Dados em geral](#9-dados-em-geral)

---

## 1. Começando

| Ação | Comando |
|---|---|
| Primeira instalação | `npx @danhachuel/leadmaster install` |
| Abrir o app | `npx @danhachuel/leadmaster` |
| Fechar o app | `npx @danhachuel/leadmaster kill` |

> No CMD/MobaXterm use `npx.cmd` no lugar de `npx`.

- Ao abrir, o terminal mostra os **logs em tempo real**. A interface fica em
  **http://127.0.0.1:5055** (se a porta estiver ocupada, sobe na próxima livre).
- `Ctrl+C` encerra tudo pelo terminal. Se você fechar a janela sem encerrar, o
  servidor continua no ar — use `kill`.
- Todos os seus dados ficam na sua máquina em `Documents\REPOSITORIO\LeadMaster\storage`
  (arquivos JSON). O app **nunca** envia nada para a nuvem.

---

## 2. Ferramentas (configurações)

Tela **Ferramentas** — o painel de controle do app. Tudo é salvo em
`config.json` na sua pasta de dados.

### 2.1 Inteligência Artificial (LLM)

| Campo | O que é |
|---|---|
| **Base URL** | Endereço da API de linguagem (ex.: `https://api.openai.com/v1`, `https://integrate.api.nvidia.com/v1`) |
| **Modelo** | Nome do modelo (ex.: `gpt-4o-mini`, `meta/llama-3.3-70b-instruct`) |
| **API Key** | Sua chave secreta — aparece como •••• e **só é substituída se você digitar uma nova** |

- Botão **Testar conexão LLM**: envia uma pergunta de teste para confirmar que
  chave, URL e modelo estão certos. Sem chave, as funções de IA (sugestões do
  CRM, chat de atendimento, geração de mensagens) avisam o que configurar.

### 2.2 Gateway do WhatsApp (Conexões)

- Em **Conexões**, clique em **Conectar WhatsApp** e leia o **QR Code** com o
  celular (WhatsApp → Aparelhos conectados). A tela mostra o status
  (`aguardando_qr` → `conectado`).
- Pré-requisito: um gateway local (**[OpenWA](https://github.com/open-wa/wa-automate)**
  ou **WAHA**) rodando na sua máquina — a URL dele vai em
  *Ferramentas → Integrações*.
- Com o WhatsApp conectado, os disparos de campanha podem ser enviados de
  verdade. Em **Conexões** também há **teste de envio** para validar.

### 2.3 Extratores (scrapers)

Em *Ferramentas → Extratores*, informe o **caminho do executável** de cada
ferramenta (baixadas no GitHub):

| Extrator | Ferramenta | O que muda ao configurar |
|---|---|---|
| Google Maps | `gosom/google-maps-scraper` | existe extração **real** em vez de dados de teste |
| Instagram | `lucasoal/igmapper` | existe extração **real** de seguidores |
| CNPJ (busca) | URL do provedor (ex.: OpenCNPJ) | busca de empresas de verdade |

- Sem configurar, os extratores funcionam em **modo mock**: geram 5–10
  registros fictícios — ideal para você conhecer o fluxo sem bloquear contas.
- Os campos de **timeout** limitam quanto tempo cada extração pode levar.
- **Regra de ouro:** scraper configurado que falha mostra erro claro e **não**
  salva dados — nunca "mock disfarçado".

### 2.4 Perfil, webhook e agentes

- **Perfil e licença**: nome exibido na interface e dados da licença local.
- **Webhook**: URL que recebe avisos dos eventos do app (lead criado, lead
  mudou de etapa, campanha concluída). Há botão de teste.

---

## 3. Painel e Funil

### Painel (Dashboard)

- **Cards**: Status da Conexão, Taxa de entrega, Taxa de erro e Leads
  cadastrados — tudo calculado na hora a partir dos seus arquivos locais.
- **Gráficos**: barras com a quantidade de leads em cada coluna do CRM e
  rosca com o desempenho das campanhas (Enviadas × Erros).
- **Sem dados ainda?** O painel mostra mensagens amigáveis ("Nenhum dado ainda,
  comece extraindo leads!") em vez de gráficos vazios.

### Funil

- Mostra a **conversão entre etapas** (quantos leads passam de "Novos Leads"
  para "Em contato", "Proposta" e "Fechado").
- Indica o **gargalo**: a etapa onde mais leads param — o lugar certo para
  concentrar seus esforços.

---

## 4. CRM (Kanban)

### Trabalhando com leads

- **Criar**: botão **Adicionar Lead** (canto superior direito), com campos
  avançados escondidos em accordion (etapa inicial, CNPJ, empresa...).
- **Editar**: clique no card → **modal de detalhes** com todos os dados;
  edite nome/telefone/e-mail e salve. Campos faltantes viram **dicas de
  preenchimento** (ex.: "Faltam 2 campos para o lead ficar completo").
- **Mover**: arraste os cards entre colunas (ou use as sugestões da IA) — a
  mudança é salva na hora.
- **Tags e Score**: no modal, adicione tags (etiquetas para organizar) e
  ajuste o **score** (nota de prioridade do lead).
- **Buscar**: barra de busca no topo — filtra na hora por **nome, telefone ou
  e-mail**. Sem resultados, o app mostra o que você buscou.
- **Exportar**: botão **Exportar CSV** baixa todos os leads
  (`leads_leadmaster.csv`, abre no Excel com acentos corretos).
- **Colunas do Kanban**: crie, renomeie, reordene ou remova colunas — a tela
  se adapta ao seu processo. (Leads em uma coluna removida voltam para
  "Novos Leads"; o app avisa.)

### Sugestões da IA

- Botão **Sugestões da IA** (no CRM) pede ao agente local uma análise do funil
  e sugere movimentações — cada sugestão explica o porquê.

---

## 5. Extratores de leads

Os três extratores seguem o mesmo padrão: formulário, botão de ação em
destaque, barra de progresso durante a extração e tabela de resultados.

| Extrator | O que pede | O que entrega |
|---|---|---|
| **Google Maps** | palavra-chave + localização | nome, telefone, cidade, avaliação |
| **Instagram** | URL do perfil | seguidores com @username |
| **CNPJ** | CNAE (ex.: `6201-5/01`) + UF | empresa, CNPJ, telefone, cidade |

- **Modo mock (padrão)**: sem ferramenta configurada, gera 5–10 registros
  fictícios marcados com a fonte ("Google Maps", "Instagram", "CNPJ") para
  você testar o fluxo sem bloquear contas.
- **Modo real**: com o executável/provedor configurado em Ferramentas, a
  extração roda de verdade. Falhas (timeout, executável inválido) retornam
  **erro claro** e não salvam nada.
- Opções avançadas (raio de busca, porte da empresa, capital social mínimo,
  apenas contas comerciais) ficam em accordions — valem para o modo real.
- Ao terminar, clique em **Ir para o CRM** para ver os leads importados na
  coluna "Novos Leads".

---

## 6. Disparos e Cadências

### Disparos (campanhas)

1. Clique em **Nova Campanha**: nome, canal (texto/áudio), mensagem e
   **filtro por etapa do CRM** (ex.: "Novos Leads").
2. Use **Gerar mensagem com IA** (precisa da LLM configurada em Ferramentas)
   para escrever o texto a partir do seu prompt — ou escreva à mão.
3. Clique em **Iniciar**. O **worker em background** processa os leads e você
   acompanha na hora:
   - barra de progresso + selo **"Processando..."**, com contagem de
     enviadas, erros e restantes;
   - a tela atualiza sozinha a cada 2 segundos.
4. **Pausar** responde imediatamente: o worker para no próximo envio e você
   pode reativar depois. Ao concluir todos os envios, a campanha vira
   **"Concluída"**.
5. Clique em **Ver** em qualquer campanha para ver o **histórico de eventos**
   (o que foi enviado, o que falhou e quando).

### Cadências (follow-up automático)

- Crie regras do tipo: *"lead parado em **Em contato** há **X** dias →
  mover para **Proposta**"*.
- A cadência roda sozinha (ou manualmente pelo botão **Executar agora**) e
  você vê quantas ações foram aplicadas.
- Ideal para não deixar lead esfriar no funil.

---

## 7. Agentes e Conexões

### Agentes

- **Agente de disparo**: prompt e templates de mensagem (texto/áudio) usados
  pelas campanhas. Você pode **testar o render** com um lead real antes de
  enviar.
- **Agente de atendimento**: aba de chat para conversar com a LLM —
  em **Suporte** (chat de teste com indicador "digitando...") ou pelo modo
  **voz** (precisa do pipecat rodando).

### Conexões (WhatsApp)

- **Status**: mostra se o gateway e o WhatsApp estão conectados.
- **Conectar WhatsApp**: abre o **QR Code** (atualiza sozinho a cada 10s) —
  leia com o celular para vincular.
- **Testar envio**: envia uma mensagem de teste para confirmar que está tudo
  funcionando antes de criar campanhas de verdade.
- Sem gateway rodando, a tela explica o que instalar/iniciar.

---

## 8. Relatórios

- **Cards**: Total Enviado, Total de Erros e **Taxa de Sucesso Geral** de
  todas as campanhas.
- **Gráfico de barras**: volume de envios e erros por campanha.
- **Tabela de histórico**: nome da campanha, data de início, data de
  conclusão, enviados, erros e status.
- Os números vêm do seu `campaigns.json` — com campanhas rodando, a tela se
  atualiza a cada 10 segundos.

---

## 9. Dados em geral

- **Onde ficam**: `<sua pasta>/storage/*.json` — `leads.json`, `campaigns.json`,
  `cadences.json`, `config.json`, `crm_columns.json`, `agents.json`,
  `chat_history.json` e logs em `storage/logs/`.
- **Backup**: basta copiar a pasta `storage` para outro lugar.
- **Restaurar**: pare o app (`kill`), substitua os arquivos e inicie de novo.
- **Diagnóstico**: `npx @danhachuel/leadmaster doctor` (ou a seção de
  diagnóstico na tela **Suporte**) mostra versão, Python, integrações, porta e
  pasta de dados — use isso ao pedir ajuda.
- **Logs**: `storage/logs/backend.log` (servidor) e
  `storage/logs/launcher_console.log` (launcher).