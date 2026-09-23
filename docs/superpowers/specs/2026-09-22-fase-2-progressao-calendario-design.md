# MuraTraining 2.0 — Fase 2: progressão e calendário — Design

Data: 2026-09-22
Status: aprovado, pronto para virar plano de implementação

Spec da fase 1: `docs/superpowers/specs/2026-09-17-muratraining-2.0-design.md`

## O que esta fase entrega

Quatro telas que dependem umas das outras e por isso saem juntas:

1. **Progressão** — tabela de evolução por série e gráfico de constância por semana.
2. **Calendário** — as semanas do aluno, com o estado de cada uma.
3. **Semana passada** — leitura do que foi feito numa semana já encerrada.
4. **Plano de semana futura** — montagem antecipada do treino de uma semana que ainda
   não chegou.

A fase 1 deixou duas dívidas que esta fase paga: ninguém lia o histórico arquivado em
`historyArchive`, e o `weekPlans` era promovido automaticamente sem que houvesse
qualquer tela para criá-lo.

## O defeito que motiva o redesenho da progressão

A tela de progressão do 1.0 não mostra progressão.

`buildHistoryIndex` (`app.js:2707`) agrupa o histórico por `setId`. Mas toda virada de
semana passa por `cloneDaysWithNewIds` (`app.js:278-303`), que gera **ids novos** para
dia, exercício e série. As entradas de histórico guardam o id que existia no momento do
registro, então cada semana produz um conjunto novo de `setId`.

O efeito: cada série vira uma linha por semana, com um único valor preenchido e todas as
outras colunas vazias. A tabela que promete comparar semanas exibe uma diagonal de
valores soltos. O gráfico por série tem o mesmo defeito na origem.

**Correção.** O 2.0 agrupa por `nome do exercício + índice da série`, a mesma chave que
`buildLastDoneIndex` já usa desde a fase 1 justamente porque sobrevive à troca de ids.
"Supino, 2ª série" passa a ser uma linha só, com uma coluna por semana.

**Consequência aceita pelo dono do projeto:** renomear um exercício quebra a linha em
duas, a do nome antigo e a do nome novo. É o preço de uma chave que atravessa a virada
de semana, e é preferível ao defeito atual. Um identificador estável de exercício, que
resolveria os dois problemas, exigiria mudança de schema — proibida enquanto o 1.0
estiver no ar.

## Decisões desta fase

Tomadas com o dono do projeto, em ordem de conversa:

- **Agrupamento da progressão:** por nome do exercício e índice da série.
- **Visões mantidas:** "treino inteiro" e "tabela". A visão de gráfico por série do 1.0
  **não** é portada; ela responde à mesma pergunta que a tabela, com mais código.
- **Público:** treinador e aluno veem a progressão, como no 1.0.
- **Gráfico:** SVG escrito à mão, sem biblioteca. Sobrou um gráfico só, de barras, e o
  Chart.js do 1.0 custa cerca de 200KB vindos de um CDN — mais de dois terços do peso
  atual do app, e indisponível offline, que é exatamente onde o aluno treina.
- **Histórico arquivado:** carregado sob demanda, por botão, nunca na abertura da tela.
- **Criação de plano de semana futura:** exige confirmação, com escolha entre copiar o
  treino atual e começar do zero. O 1.0 cria a cópia no toque, o que transforma um toque
  errado em um plano que será promovido sozinho quando a semana chegar.
- **Semana passada é só leitura.** Editar o passado reescreveria histórico já registrado.
- **Plano de semana futura é só do treinador.** O aluno enxerga quando existe.

## Telas

### Calendário

Aberto por botão na ficha do aluno. Lista seis semanas — duas passadas, a atual e três
futuras — derivadas de `activeWeekKey`, não da data de hoje, porque é `activeWeekKey`
que governa qual treino o aluno está fazendo.

Cada linha mostra o intervalo da semana e o seu estado:

| Estado | Como é apurado |
|---|---|
| Concluída | há entradas de histórico naquela `weekKey` |
| Semana atual | `weekKey` igual a `activeWeekKey`; mostra séries feitas sobre o total |
| Planejada | existe item em `weekPlans` com aquela `weekKey` |
| Ainda não planejada | nenhuma das anteriores |

Quando `activeWeekKey` diverge da semana de hoje — relógio errado, aluno que ficou
semanas sem abrir o app — a tela mostra um aviso com um botão que corrige para a semana
corrente. Isso existe no 1.0 e é mantido.

Tocar numa linha leva para a tela de semana passada, para a grade normal de treinos ou
para o plano futuro, conforme a posição da semana.

### Semana passada

Só leitura. Reconstrói a semana a partir do histórico, agrupando por dia de treino e,
dentro do dia, por exercício, com as séries em ordem de índice. Não usa `days`: aquele
array guarda o treino corrente, e a semana passada só existe no histórico.

Para semanas anteriores ao corte de 26 semanas, busca o documento daquela semana no
arquivo — uma leitura, dirigida, e não a coleção inteira.

### Plano de semana futura

Reaproveita a tela de treino, com uma diferença: a escrita vai para o plano daquela
semana, e não para o treino atual. Um cabeçalho identifica a semana em edição.

O cronômetro não aparece: ele marca uma sessão de treino em andamento, que não existe
numa semana que ainda não chegou. O `timerStartedAt` também nunca é copiado, o que a
fase 1 já garante em `cloneDaysWithNewIds`.

Ao abrir uma semana futura sem plano, o treinador escolhe entre **copiar o treino desta
semana**, que usa `cloneDaysWithNewIds` com `carryGhost`, e **começar do zero**, que cria
um plano vazio. Nada é gravado antes da escolha.

A promoção quando a semana chega já existe desde a fase 1, em `planPromotion`.

### Progressão

Duas abas.

**Treino inteiro.** Barras, uma por semana, com a contagem de séries efetivamente feitas
— entradas com `repsDone` preenchido. Responde a "o aluno está treinando", que é uma
pergunta de frequência e não de carga. Tocar numa barra mostra o número daquela semana.

**Tabela.** Uma linha por exercício e índice de série, uma coluna por semana, mais
recente à direita. Cada célula traz reps e carga daquele registro, com seta para cima ou
para baixo comparando com a semana anterior preenchida. Quando há mais de um registro na
mesma semana — o aluno corrigiu um número — vale o de data mais recente.

A tela abre com o que está na ficha, que são as últimas 26 semanas, e não custa leitura
nenhuma. No rodapé, o botão "carregar histórico completo" busca o arquivo. O resultado
fica em memória enquanto o app estiver aberto, então o botão não cobra duas vezes.

## Arquitetura

### Cálculo separado da tela

Módulos novos em `domain/`, puros, sem DOM e sem rede, no mesmo padrão da fase 1:

- **`progression.ts`** — `buildProgressionRows(history)` agrupa por
  `nome|índice` e, dentro de cada semana, mantém a entrada de `dateKey` mais recente;
  `weeklySetCounts(history)` conta séries feitas por semana para o gráfico;
  `trendOf(anterior, atual)` decide a seta, comparando carga e caindo para reps quando
  não há carga.
- **`past-week.ts`** — `groupWeekByDay(history, weekKey)`.
- **`history-merge.ts`** — `mergeHistory(doDocumento, doArquivo)`, que remove duplicata
  por `setId` + `dateKey`. A fase 1 aceitou de propósito o risco de uma entrada existir
  nos dois lugares, por ser preferível a perdê-la; é aqui que a duplicata deixa de
  aparecer na tela.
- **`week.ts`** ganha `weekLabel(weekKey)` e `weekRangeLabel(weekKey)`. São formatação,
  mas formatação de data é onde nascem erros de fuso, e aqui elas ficam testáveis.

### Leitura do arquivo

`data/history-archive.ts`, que hoje só escreve, ganha:

- `loadArchivedWeek(clientId, weekKey)` — um documento, para a tela de semana passada.
- `loadAllArchived(clientId)` — a subcoleção inteira, atrás do botão da progressão.

As regras do Firestore escritas na fase 1 já permitem que o dono e o treinador leiam
`historyArchive`. Esta fase **não** mexe em regras.

### Alvo de edição

Hoje toda alteração de série vai para `client.days`. Com o plano de semana futura, a
mesma tela precisa escrever em dois destinos. Em vez de duplicar tela e handlers, o
estado passa a carregar o alvo:

```ts
type EditTarget = { kind: "current" } | { kind: "plan"; planId: string };
```

Os componentes não mudam: eles já recebem o que desenhar. Quem muda é a camada de
handlers, que resolve o alvo antes de gravar — `days` no primeiro caso, o item
correspondente de `weekPlans` no segundo. A troca de um array de planos por outro é
função pura e vai para `domain/`, junto com o resto.

### Estado

`ui/state.ts` ganha: a tela aberta dentro da área do aluno (grade, calendário, semana
passada ou progressão), `pastWeekKey`, `editTarget`, a aba da progressão e o histórico
completo já carregado, quando houver.

### Arquivos menores

`ui/handlers.ts` está perto do limite de ~250 linhas que a spec da fase 1 estabelece, e
esta fase acrescenta calendário, plano e progressão. Ele se divide por assunto: entrada,
treinador, treino e calendário. É a única reorganização de código desta fase, e cabe aqui
porque é exatamente o arquivo em que o trabalho acontece.

### Testes

Vitest sobre `domain/`, como na fase 1: agrupamento da progressão, escolha do registro
mais recente na semana, contagem semanal, direção da seta, agrupamento da semana passada,
remoção de duplicata entre arquivo e documento, e os rótulos de semana. A interface
continua sem teste automatizado; o custo não se paga neste tamanho de projeto.

## Riscos

- **Renomear exercício divide a linha da progressão.** Decidido e aceito acima.
- **Carregar o histórico completo é lento para o aluno mais antigo.** É justamente quem
  mais tem o que ver. Por isso é botão, com indicação de carregamento, e não abertura
  automática.
- **O plano de semana futura vive dentro do documento do aluno**, no mesmo `weekPlans` do
  1.0, e portanto divide o teto de 1MB. Planos são poucos e pequenos, e a fase 1 já
  removeu o array que crescia sem limite.
- **O 1.0 continua no ar** criando planos sem confirmação e exibindo a progressão antiga.
  Os dois apps escrevem os mesmos campos, então nada quebra; o que muda é a tela.

## Fora de escopo

- **Fotos de exercício** (fase 3). Copiar o treino para uma semana futura, portanto, não
  copia foto — o 1.0 faz essa cópia, e o 2.0 só passa a fazer quando houver foto.
- **Gráfico por série**, descartado por decisão acima.
- **Cardio, volume por grupo muscular, feedbacks** (fase 3).
- **Migração de `history` inteiro para subcoleção**, que só acontece depois que o 1.0 sair
  do ar.
- **Mudança nas regras do Firestore.** As da fase 1 já cobrem esta fase.
