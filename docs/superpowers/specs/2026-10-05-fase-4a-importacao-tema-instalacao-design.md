# MuraTraining 2.0 — Fase 4a: importação por texto, personalização e banner de instalação — Design

Data: 2026-10-05
Status: aprovado, pronto para virar plano de implementação

Spec da fase 1: `docs/superpowers/specs/2026-09-17-muratraining-2.0-design.md`
Spec da fase 2: `docs/superpowers/specs/2026-09-22-fase-2-progressao-calendario-design.md`
Spec da fase 3: `docs/superpowers/specs/2026-09-29-fase-3-cardio-feedback-volume-fotos-design.md`

## O que esta fase entrega

A fase 4 do roadmap tem quatro recursos que o 1.0 tem e o 2.0 ainda não: importação de
treino por texto, personalização de cores e fontes, página de dados (backup e exportação
Excel) e banner de instalação. Ela se divide em duas entregas:

- **4a — importação, personalização e banner.** Tudo dentro do app, sem dependência nova.
  É este spec.
- **4b — página de dados.** Traz uma dependência nova (Excel) e envolve restauração de
  backup, a parte mais arriscada. Recebe spec e plano próprios.

Cada parte vai ao ar sozinha.

## Decisões desta fase

Tomadas pelo dono do projeto:

- **Duas entregas**, como descrito acima.
- **Importação com prévia.** O 2.0 mostra o que o texto virou antes de gravar; confirmado,
  os dias são **adicionados** aos treinos do aluno, como no 1.0. Substituir os treinos
  existentes não entra.
- **Personalização sem modo prévia.** As mudanças aparecem na hora só no aparelho do
  treinador e vão para os alunos ao publicar. O rascunho não é guardado entre sessões.
- **Banner de instalação igual ao 1.0.**

## Defeitos do 1.0 corrigidos aqui

- **O 2.0 ignora o tema publicado.** Hoje o aluno que usa o 2.0 vê as cores padrão mesmo
  que o treinador tenha personalizado no 1.0. Passa a aplicar `settings/theme.published`.
- **Importação às cegas.** O 1.0 só informa quantos dias e exercícios achou; um erro de
  leitura vira dado antes de ser visto. O 2.0 mostra a prévia.
- **Fontes baixadas à toa.** O 1.0 baixa nove famílias do Google Fonts em toda abertura,
  inclusive para o aluno. O 2.0 baixa só a fonte em uso, quando não é a padrão.
- **Tema estragado deixa o app ilegível.** O 1.0 aplica o que estiver no documento. O 2.0
  descarta cor que não seja `#rrggbb` e fonte fora da lista, caindo no padrão campo a
  campo.

## Telas

### Importar treino

Só treinador. Entrada por um botão "Importar treino (colar texto)" nos treinos atuais do
aluno — não no plano de semana futura, como no 1.0.

1. Caixa de texto e botão **Ler**.
2. Texto vazio: "Cole o texto do treino antes de importar." Sem nenhum dia da semana: "Não
   encontrei nenhum dia da semana nesse texto (ex.: "Segunda-feira"). Confira o formato."
   (mensagens do 1.0).
3. **Prévia:** cada dia com seus exercícios; em cada exercício, o músculo adivinhado, as
   séries agrupadas por meta/carga/RIR (ex.: "3× 8-12 · 40 kg · 2 RIR") e as notas.
   Abaixo, o total: N dias, M exercícios, K séries.
4. **Adicionar ao aluno** acrescenta os dias ao fim de `days`, sem tocar nos existentes, e
   volta aos treinos. **Voltar** retorna à caixa com o texto preservado para corrigir.

### Personalização

Só treinador. Entrada pelo ícone de paleta na lista de alunos, como no 1.0.

- As 10 cores (Fundo, Painel, Painel (alt), Bordas, Texto principal, Texto secundário,
  Destaque, Destaque escuro, Cor do kg, Cor da meta) e as 2 fontes (Títulos, Texto), com
  os rótulos do 1.0.
- Cada mudança é aplicada na hora, só no aparelho do treinador.
- **Publicar para os alunos** grava o tema.
- **Descartar** volta ao tema publicado.
- **Restaurar padrão** pede confirmação e grava o tema padrão.
- Sair da tela sem publicar descarta o rascunho e reaplica o publicado.

### Banner de instalação

Rodapé fixo, para treinador e aluno, nunca com o app já instalado (`display-mode:
standalone` ou `navigator.standalone`).

- **Android/Chrome:** ao receber `beforeinstallprompt`, o texto "Instale este app no seu
  celular pra acesso rápido, direto da tela inicial." com o botão **Instalar**, que abre o
  prompt nativo.
- **iPhone:** 1,5 s depois de carregar, "Toque em **Compartilhar** (⬆️) e depois em
  **"Adicionar à Tela de Início"** pra instalar o app."
- **×** dispensa para sempre neste aparelho.
- Se a faixa "Nova versão disponível" (3b) também valer, só ela aparece.

## Arquitetura

### Cálculo separado da tela

Como nas fases anteriores, a lógica fica em `domain/` como funções puras com testes:

```ts
// src/domain/workout-import.ts
export interface ImportSummary { days: number; exercises: number; sets: number }
export function parseWorkoutText(text: string): Day[]
export function importSummary(days: Day[]): ImportSummary

// src/domain/theme.ts
export interface Theme { bg: string; panel: string; panelAlt: string; line: string;
  chalk: string; muted: string; red: string; redDim: string; steel: string; plate: string;
  fontDisplay: string; fontBody: string }
export const DEFAULT_THEME: Theme
export const THEME_COLORS: { key: keyof Theme; label: string }[]
export const FONT_DISPLAY_OPTIONS: string[]
export const FONT_BODY_OPTIONS: string[]
export function mergeTheme(saved: unknown): Theme
```

**`parseWorkoutText`** transcreve as regras do 1.0 (`app.js:2357-2516`), para o mesmo
texto dar o mesmo treino nos dois apps:

- Linha com dia da semana (`segunda`… `domingo`, com ou sem acento) abre um dia; o título
  é a linha sem asteriscos nas pontas. Linhas antes do primeiro dia são ignoradas.
- `Nx A-Br resto` (formato limpo) e `Nx resto` (solto) viram N séries. Do resto saem RIR
  (`2rir`), carga (`placa 5` → "Placa 5"; `zerada`/`sem peso` → "0"; `40kg` → "40";
  `peso do corpo`/`corpo` → "corpo"). O que sobrar vira nota "(série k) …".
- Linha começando com `-`, com `*`, entre parênteses, de aquecimento (`12r 0kg`) ou de
  instrução (`descanso`, `obs`, `observação`, `dica`) vira nota do exercício atual. Sem
  exercício atual, nasce "Aquecimento / Mobilidade".
- Qualquer outra linha é um exercício novo; o `:` final sai do nome. Músculo e sinergista
  vêm de `guessedMuscles` (3b).
- As notas de um exercício são unidas com "; ".
- Toda série nasce com `repsDone: ""`, `intensity: 0`, `rirEnabled: false`. Ids vêm de
  `data/id.ts`.

**`mergeTheme`** parte de `DEFAULT_THEME` e só aceita, campo a campo, cor que case
`/^#[0-9a-f]{6}$/i` e fonte presente na lista correspondente.

### Dados

O 2.0 usa o mesmo documento `settings/theme` do 1.0, no mesmo formato:
`{ draft: Theme, published: Theme }`. Publicar e restaurar gravam o mesmo tema nos dois
campos, com merge — exatamente o que o 1.0 grava — para que os dois apps continuem
mostrando o mesmo visual. O 2.0 nunca lê `draft`.

A importação grava só `days` do aluno, pelo mesmo caminho de escrita dos treinos que já
existe.

### Regras do Firestore

Não mudam. `settings/{doc}` já permite leitura a qualquer usuário logado e escrita só ao
treinador.

### Aplicar o tema

`src/ui/theme.ts` expõe `applyTheme(t: Theme)` e `loadPublishedTheme()`:

- `applyTheme` grava `--bg`… `--plate`, `--font-display` e `--font-body` em
  `document.documentElement`. Para fonte diferente de Anton/Inter (as que `index.html` já
  carrega), injeta uma vez um `<link>` do Google Fonts só para aquela família.
- `loadPublishedTheme` roda depois do login, uma leitura (`getDoc`), e aplica
  `mergeTheme(published)`. Erro ou documento ausente: segue o padrão, sem aviso. Sem
  listener: o aluno com o app aberto pega o tema novo na próxima abertura.

### Banner de instalação

`src/ui/install.ts` escuta `beforeinstallprompt` (guarda o evento), detecta iOS e
standalone, e decide `installKind: "android" | "ios" | null`. A dispensa usa a chave
`install-banner-dismissed` do `localStorage`, a mesma do 1.0, com leitura e escrita em
try/catch. `components/install-banner.ts` desenha o banner com o CSS `#install-banner` que
já existe em `styles.css`.

### Estado

Em `src/ui/state.ts`:

- telas novas `import` e `theme`;
- `importText: string` e `importPreview: Day[] | null`;
- `themeDraft: Theme | null`;
- `installKind: "android" | "ios" | null`.

### Arquivos

Novos:

- `src/domain/workout-import.ts` e `workout-import.test.ts`
- `src/domain/theme.ts` e `theme.test.ts`
- `src/ui/theme.ts`, `src/ui/install.ts`
- `src/ui/views/import.ts`, `src/ui/views/theme.ts`
- `src/ui/components/install-banner.ts`
- `src/ui/handlers/import.ts`, `src/ui/handlers/theme.ts`
- `src/ui/styles-import-theme.css`

Alterados: `src/ui/state.ts`, `src/ui/render.ts` (rotas, banner e o botão "Importar treino"
entre os atalhos dos treinos, só com `editable` e fora do plano), `src/main.ts`,
`src/ui/handlers/index.ts`, `src/ui/views/trainer.ts` (ícone de paleta na lista de alunos).

Nenhum arquivo de `src/` passa de ~250 linhas; `workout-import.ts` é o candidato a crescer
e, se passar, a extração do "resto" da linha de série vai para `workout-import-set.ts`.
Nenhuma dependência nova.

### Testes

- `workout-import`: ficha no estilo das do 1.0 com cada tipo de linha; texto sem dia; linhas
  antes do primeiro dia; nota antes do primeiro exercício (nasce "Aquecimento /
  Mobilidade"); placa sem virar repetição; sobra virando nota por série; músculo
  adivinhado; resumo.
- `theme`: documento vazio, `null`, cor inválida, fonte desconhecida, tema completo.
- Banner, tela de tema e prévia da importação: checklist manual em produção.

## Riscos

- **Divergência do parser entre os apps.** Mitigação: transcrição fiel e testes com as
  mesmas entradas; qualquer correção de comportamento do parser fica fora desta fase.
- **Treinador publica no 2.0 enquanto o 1.0 tem rascunho em modo prévia.** O 2.0 sobrescreve
  `draft`, como o próprio 1.0 faz ao publicar. Aceito.
- **iOS sem `beforeinstallprompt`.** Só instrução textual, como no 1.0.

## Fora de escopo

- Página de dados: backup, restauração, Excel e recuperação (fase 4b).
- Substituir os treinos do aluno pela importação; importar para semana futura.
- Modo prévia do tema e rascunho persistido.
- Tema por aluno; cores além das 10 do 1.0.
- Atualizar o tema em tempo real em aparelhos já abertos.
