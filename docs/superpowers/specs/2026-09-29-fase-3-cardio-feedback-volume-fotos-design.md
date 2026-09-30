# MuraTraining 2.0 — Fase 3: cardio, feedbacks, volume muscular e fotos — Design

Data: 2026-09-29
Status: aprovado, pronto para virar plano de implementação

Spec da fase 1: `docs/superpowers/specs/2026-09-17-muratraining-2.0-design.md`
Spec da fase 2: `docs/superpowers/specs/2026-09-22-fase-2-progressao-calendario-design.md`

## O que esta fase entrega

Quatro recursos que o 1.0 tem e o 2.0 ainda não:

1. **Cardio** — o aluno registra minutos, zona e observação; a tela soma a semana e o mês.
2. **Feedbacks e WhatsApp** — conversa por escrito entre aluno e treinador, com aviso de
   mensagem não lida e atalho para o WhatsApp do treinador.
3. **Volume por grupo muscular** — cada exercício tem músculo principal e sinergista; o dia
   e a semana mostram quantas séries cada grupo recebe.
4. **Fotos de exercício** — o treinador anexa uma foto ao exercício; o aluno vê.

## Entrega em duas partes

Os quatro recursos não dependem uns dos outros e se dividem pelo que tocam:

- **3a — cardio e feedbacks.** Telas próprias, listas simples dentro da ficha, usadas
  sobretudo pelo aluno. Não mexem no exercício.
- **3b — volume muscular e fotos.** Mexem no cartão do exercício, no cabeçalho do dia e na
  cópia de treino para semana futura. Usados sobretudo pelo treinador.

Cada parte tem o próprio plano de implementação e vai ao ar sozinha. A 3a sai primeiro por
ser a menor e a que o aluno sente.

## Decisões desta fase

Tomadas pelo dono do projeto:

- **Paridade com o 1.0, corrigindo defeitos.** O comportamento de cada recurso é o do 1.0.
  Onde o 1.0 tem defeito, o 2.0 corrige — sempre sem mudar o formato dos dados, porque os
  dois apps continuam gravando os mesmos campos.
- **Duas entregas**, como descrito acima.

Tomadas na escrita deste design, por delegação do dono do projeto:

- **Fotos continuam como dataUrl em `photos/{exId}`.** Firebase Storage seria o lugar
  natural, mas o 1.0 lê as fotos dali; mudar de lugar quebraria a foto no app antigo.
- **O WhatsApp aparece só para o aluno.** No 1.0 o treinador vê um botão que abre conversa
  com o próprio número.
- **A tela de volume usa os dias do alvo de edição.** Com um plano de semana futura aberto,
  ela mostra o volume do plano. Sai de graça do `editTarget` da fase 2 e responde à
  pergunta que o treinador tem ao montar a semana.
- **Sem aviso de mensagem não lida na lista de alunos.** O 1.0 também não tem; fica para
  quando fizer falta.

## Defeitos do 1.0 corrigidos aqui

**Todas as mensagens viram lidas quando qualquer um abre a conversa** (`app.js:1756-1759`).
O aluno manda uma mensagem, reabre a tela para conferir, e o aviso de não lida some antes
de o treinador ver. O campo `read` é um só por mensagem, mas cada mensagem tem um único
destinatário — quem não a escreveu. O 2.0 marca como lidas só as mensagens do outro lado, e
o aviso conta só essas. O 1.0 continua com o defeito; como o formato é o mesmo, os dois
convivem.

**Foto marcada sem foto existente.** A virada de semana do 2.0 gerava ids novos e levava
`hasPhoto` junto, apontando para um documento que não existe. A causa foi corrigida no
commit `dea12b5`, mas pode haver exercícios já afetados. A tela passa a tratar
`hasPhoto` sem documento como "sem foto": o aluno não vê quadro vazio e o treinador vê o
botão de adicionar.

**Erro invisível para o aluno.** A render do aluno não desenha `state.error`. Uma escrita
negada ou uma semana que não carregou falha em silêncio. A 3a passa a mostrar o erro também
na tela do aluno.

## Telas

A linha de botões que a fase 2 pôs acima da grade de treinos (Calendário, Progressão)
ganha **Cardio** e **Feedbacks** para os dois, e **Volume muscular** só para o treinador.
O botão de feedbacks leva um ponto vermelho quando há mensagem não lida do outro lado.

### Cardio

No topo, dois quadros: minutos **desta semana** (desde a segunda-feira de hoje) e **deste
mês** (desde o dia 1), cada um com a divisão por zona quando houver zona registrada.

Abaixo, o formulário, sempre aberto: minutos (obrigatório, inteiro positivo), zona
(opcional, Z1 a Z5) e observação (opcional). A data é a de hoje. O 1.0 esconde o formulário
atrás de um botão; aqui ele fica visível porque registrar é o motivo de abrir a tela.

Por fim, o histórico, mais recente primeiro, com botão de remover e confirmação. Aluno e
treinador registram e removem, como no 1.0.

Zonas e rótulos, iguais ao 1.0: Z1 muito leve, Z2 leve, Z3 moderada, Z4 intensa, Z5 máxima.

### Feedbacks

Conversa em ordem cronológica. As mensagens de quem está vendo ficam à direita, as do outro
lado à esquerda, cada uma com "Aluno" ou "Personal" e a data. Caixa de texto e botão de
enviar no rodapé.

Para o aluno, um botão "Falar direto no WhatsApp" no topo, com o número do treinador.

Só o treinador apaga mensagens, com confirmação, como no 1.0.

Abrir a tela marca como lidas as mensagens do outro lado. Sair dela marca de novo, para
cobrir o que chegou enquanto estava aberta. Se não há nada a marcar, nada é gravado.

### Volume muscular (3b)

No cartão do exercício, o treinador escolhe o músculo principal e o sinergista em duas
listas. O aluno vê as duas etiquetas, a do sinergista esmaecida com "+½".

Ao renomear um exercício sem músculo definido, o app adivinha pelo nome — músculo e
sinergista —, com as mesmas palavras do 1.0 (`guessMuscle` e `guessSynergist`). Escolha
manual nunca é sobrescrita.

No cabeçalho do dia, para os dois: "x/y séries feitas" e uma etiqueta por grupo com feitas
sobre total. A série do sinergista conta meia.

A tela de volume, só do treinador, lista os grupos em barras horizontais, do maior para o
menor total, com a parte feita destacada.

### Fotos (3b)

No cartão do exercício, quando há foto, ela aparece em miniatura; tocar abre em tela cheia.
O treinador tem "adicionar foto" quando não há e um botão de remover quando há.

A foto é comprimida no aparelho, como no 1.0: maior lado com 700px, JPEG com qualidade 0,6.
Se o resultado passar de 700.000 caracteres, é recusada com aviso. Isso mantém cada
documento de foto longe do teto de 1MB.

Ao copiar o treino para uma semana futura, as fotos são copiadas para os ids novos. A cópia
roda no aparelho do treinador — o único que pode escrever fotos — logo depois de criar o
plano. O plano nasce sem `hasPhoto` e cada exercício ganha o flag quando a sua foto termina
de copiar; se uma cópia falhar, aquele exercício fica sem foto em vez de ficar quebrado.

Remover um exercício que tem foto apaga também o documento da foto.

## Arquitetura

### Cálculo separado da tela

Módulos novos em `domain/`, puros, como nas fases anteriores:

- **`cardio.ts`** (3a) — `CARDIO_ZONES`; `parseMinutes(texto)`, que devolve inteiro
  positivo ou null; `cardioTotals(entradas, desdeDateKey)`; `monthStartKey(dateKey)`;
  `newestFirst(entradas)`. Minutos gravados pelo 1.0 podem vir como texto, então a soma
  converte e ignora o que não é número.
- **`feedback.ts`** (3a) — `authorOf(view)`, que traduz a sessão em `"aluno"` ou
  `"treinador"`; `hasUnreadFor(entradas, eu)`; `markReadFor(entradas, eu)`, que devolve
  null quando não há o que marcar, para não gerar escrita; `oldestFirst(entradas)`.
- **`muscle.ts`** (3b) — `MUSCLE_GROUPS`, `guessMuscle`, `guessSynergist`,
  `daySetCount(dia)`, `muscleVolume(dias)` e `formatVolume(n)`.
- **`photo-copy.ts`** (3b) — `photoCopies(diasOrigem, diasCopiados)`: os pares
  `{ de, para }` de ids de exercício que tinham foto. A cópia preserva a ordem de dias e
  exercícios, então os pares saem por posição.

### Dados

- **`schema.ts`** ganha o tipo `FeedbackEntry = { id, dateKey, from: "aluno" |
  "treinador", text, read }` e troca `feedback?: unknown[]` por `feedback?:
  FeedbackEntry[]`. É só tipagem do que o 1.0 já grava.
- **`data/photos.ts`** (3b) — `loadPhoto`, `savePhoto`, `deletePhoto` e `copyPhoto`. A
  leitura guarda a **promessa** num cache em memória por `clientId:exId`, de modo que
  redesenhar a tela não refaz a leitura e o `until` do lit-html recebe sempre a mesma
  promessa.
- **`ui/image.ts`** (3b) — `compressImage(arquivo, maxLado, qualidade)`, com canvas.
  Depende do navegador e por isso fica fora de `domain/`.

### Regras do Firestore

Nenhuma mudança. O aluno já pode escrever `cardio` e `feedback`, e marcar como lida é
escrever `feedback`. Fotos continuam escritas só pelo treinador, que é quem as envia e
quem cria o plano que as copia.

### Estado

`Screen` ganha `"cardio"`, `"feedback"` e `"muscle"`. Na 3b, `photoViewer: string | null`
guarda a foto aberta em tela cheia.

### Arquivos menores

`exercise.ts` recebe músculo e foto na 3b. Para ele continuar legível, a foto vai para
`components/exercise-photo.ts` e as listas de músculo para `components/muscle-picker.ts`.
Os handlers novos ficam em `handlers/cardio.ts`, `handlers/feedback.ts` e
`handlers/photos.ts`, no padrão por assunto que a fase 2 estabeleceu.

### Testes

Vitest sobre `domain/`: validação de minutos, somas por semana, mês e zona, ordenação;
quem é o autor, contagem e marcação de não lidas — inclusive que mensagens próprias nunca
contam nem são marcadas —; adivinhação de músculo e sinergista, volume com meia série,
formatação; pares de cópia de foto. A interface continua sem teste automatizado.

## Riscos

- **`cardio` e `feedback` crescem sem limite dentro do documento do aluno**, que tem teto de
  1MB. Um registro de cardio tem uns 80 bytes; cinco por semana dão cerca de 20KB por ano.
  Feedback depende de quanto se escreve, mas é texto curto. Nenhum dos dois ameaça o teto
  em horizonte de anos, e arquivá-los como o histórico exigiria mudança que o 1.0 não
  entende. Fica registrado para depois da fase 4.
- **O 1.0 continua marcando tudo como lido.** Quem usar o 1.0 ainda sofre o defeito; o
  2.0 não piora nada.
- **Foto antiga embutida no documento.** Alunos muito antigos podem ter `photoUrl` com a
  imagem dentro do próprio exercício. O 2.0 exibe, mas não migra: o 1.0 já migra isso para
  a subcoleção quando o treinador abre a ficha, e fazer de novo aqui é código para um caso
  que está sumindo.
- **Cópia de foto demora** quando o treino tem muitas fotos: uma leitura e uma escrita por
  foto. O plano aparece na hora e as fotos chegam em seguida.

## Fora de escopo

- **Importação de treino por texto, personalização de cores e fontes, página de dados,
  banner de instalação** (fase 4).
- **Aviso de não lida na lista de alunos**, por decisão acima.
- **Vídeo de exercício e nota do aluno no exercício** (`videoUrl`, `studentNote`): estão no
  schema, mas não na lista da fase 3.
- **Migração de `history`, `cardio` e `feedback` para subcoleção**, depois que o 1.0 sair
  do ar.
