# MuraTraining 2.0 — Design

Data: 2026-09-17
Status: aprovado, pronto para virar plano de implementação

## Por que reconstruir

O MuraTraining 1.0 está em produção com alunos reais. Ele funciona, mas acumulou
três classes de problema que não se resolvem com correções pontuais:

1. **Duas falhas de segurança críticas** que expõem senhas de usuários reais.
2. **Um bug latente** que vai quebrar o app para cada aluno depois de cerca de um
   ano de uso, sem aviso e no meio de um treino.
3. **Uma arquitetura que impede mudança segura**: 3.585 linhas em um arquivo, sem
   testes, com estado global e render que reconstrói a tela inteira.

O 2.0 corrige os três, preservando os dados e os logins que já existem.

## Restrições

Estas restrições foram estabelecidas com o dono do projeto e não são negociáveis
dentro deste design:

- **Produção com alunos reais.** O schema do Firestore e as contas do Firebase Auth
  existentes não podem quebrar.
- **Plano Firebase Spark (gratuito).** Sem Cloud Functions, portanto sem Admin SDK.
  Tudo precisa funcionar a partir do navegador.
- **Vite + TypeScript, sem React.**
- **Entrega em fases**, com o núcleo primeiro.

## Estratégia de transição: coexistência

O 2.0 sobe em uma URL separada, apontando para o **mesmo projeto Firebase e o mesmo
schema** do 1.0. Os dois rodam em paralelo até a fase 4 terminar.

Isso foi escolhido sobre as alternativas porque:

- **Substituição direta** exigiria que o núcleo estivesse completo no dia da virada.
  Com alunos treinando, uma função que some no meio da semana é um custo real.
- **Projeto Firebase novo** daria liberdade de schema, mas os logins vivem no projeto
  antigo: todo aluno precisaria se recadastrar manualmente.

A coexistência também é o que torna a entrega em fases honesta: enquanto o 2.0 ainda
não tem cardio, os dados de cardio continuam no mesmo documento e o 1.0 continua
lendo e escrevendo neles. Nada fica órfão entre as fases.

O preço é disciplina de schema, tratada na seção seguinte.

## O contrato de schema

Enquanto os dois apps coexistirem, este é o formato que ambos respeitam. Ele vive em
`src/data/schema.ts` como tipos TypeScript e é validado na fronteira de leitura e
escrita.

```
clients/{authUid}
  name: string
  email: string                 sempre minúsculo
  goal: string
  createdAt: number             epoch ms
  lastSeen?: number             epoch ms
  activeWeekKey?: string
  days: Day[]
  weekPlans?: WeekPlan[]
  history?: HistoryEntry[]
  cardio?: CardioEntry[]
  feedback?: FeedbackEntry[]
  workoutSessions?: WorkoutSession[]

Day          = { id, title, exercises: Exercise[], timerStartedAt?: number }
WeekPlan     = { id, weekKey, days: Day[] }
Exercise     = { id, name, notes, sets: Set[], muscle?, synergist?,
                 photoUrl?, hasPhoto?, videoUrl?, studentNote?, studentNoteAt? }
Set          = { id, repsGoal, repsDone, load, intensity, rir, rirEnabled,
                 loadSetByTrainer?, prevReps? }
HistoryEntry = { dateKey, weekKey, dayId, dayTitle, exId, exName, setId,
                 setIndex, repsGoal, repsDone, load }
CardioEntry  = { id, dateKey, minutes, zone, note }

clients/{authUid}/photos/{exId} = { dataUrl }
settings/theme                  = { draft: Theme, published: Theme }

Introduzido pelo 2.0 (o 1.0 ignora, por isso é aditivo e seguro):
clients/{authUid}/historyArchive/{weekKey} = { weekKey, entries: HistoryEntry[] }
```

O campo `password`, presente no 1.0, **é removido** e nunca mais escrito. Ver
"Correções de segurança".

## Correções de segurança

### 1. Senha em texto puro no Firestore (crítico)

No 1.0, `app.js:250`, `:408` e `:416` gravam a senha real do aluno no documento dele.
Qualquer export de backup, qualquer erro nas regras e qualquer acesso ao Console
expõe a senha de todos os alunos — e, por reuso de senha, as contas de email deles.

**Correção.** O campo deixa de existir. O cadastro passa a funcionar assim:

1. O personal informa apenas nome e email.
2. O app gera uma senha aleatória com `crypto.getRandomValues`, que não é exibida,
   não é registrada e não é reutilizada.
3. A conta é criada com essa senha através de uma instância secundária do Firebase
   (o mesmo mecanismo do 1.0, que evita derrubar a sessão do personal).
4. O app dispara imediatamente `sendPasswordResetEmail`, e o aluno define a própria
   senha pelo email do Firebase.

Isso funciona no plano Spark, não exige Cloud Function, e mantém o documento indexado
pelo UID do Auth — portanto não quebra a compatibilidade com o 1.0. "Esqueci a senha"
e "reenviar convite" usam o mesmo mecanismo.

### 2. Senha em texto puro no localStorage (crítico)

No 1.0, `app.js:168` grava email e senha em `localStorage` sob o rótulo de "Face ID".
A credencial WebAuthn é criada mas sua assinatura nunca é verificada contra nada, então
a biometria não autentica: o segredo real é a senha no navegador, legível por qualquer
XSS ou por quem pegar o aparelho destravado.

**Correção.** A funcionalidade é removida. Um login biométrico real exige verificar a
assinatura no servidor, o que o plano Spark não permite. Ela também resolvia um
problema que quase não existe: a sessão do Firebase Auth já persiste indefinidamente,
então o aluno permanece logado sem digitar senha de novo.

### 3. Regras do Firestore

O 1.0 libera `/settings` para leitura sem autenticação (`allow read: if true`) e
permite que o aluno altere qualquer campo do próprio documento exceto `name`, `email`
e `goal` — incluindo a própria senha e todo o histórico.

**Correção.** Lista explícita do que o aluno pode alterar, com o resto negado por
padrão:

```
allow update: if isOwner(resource)
  && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['days','history','cardio','feedback',
                 'workoutSessions','lastSeen','activeWeekKey','weekPlans']);
```

`activeWeekKey` e `weekPlans` precisam estar na lista porque a promoção automática de
semana roda no aparelho do aluno. `name`, `email`, `goal` e `createdAt` ficam de fora.
Leitura de `/settings` passa a exigir autenticação.

A subcoleção `historyArchive` recebe regra própria: o personal lê e escreve tudo; o
dono lê e escreve apenas a própria, porque o arquivamento roda no aparelho dele. Ao
contrário de `photos`, isso não deve custar um `get()` por requisição — a regra usa o
`clientId` do caminho, que já é o UID do Auth:

```
match /clients/{clientId}/historyArchive/{weekKey} {
  allow read, write: if isTrainer() || request.auth.uid == clientId;
}
```

Vale registrar que a regra de `photos` do 1.0 faz um `get()` do documento do aluno a cada
leitura de foto, o que gera uma leitura cobrada extra por foto exibida. Como o documento
é indexado pelo UID, `request.auth.uid == clientId` resolve igual e sem custo. O 2.0
adota essa forma também em `photos`.

**Limitação documentada:** o email do personal continua fixo nas regras. Trocar isso
por perfil de usuário exige custom claims, que exigem Admin SDK, que exige Blaze. Email
fixo nas regras é o padrão correto para o plano gratuito.

## O bug latente: estouro de 1MB

`history` é um array sem limite dentro do documento do aluno, que ganha uma entrada a
cada série editada. Documentos do Firestore têm teto rígido de 1MB.

Para um aluno de 4 dias, 6 exercícios e 4 séries: ~96 entradas por semana a ~200 bytes,
ou ~19KB por semana. Isso encosta em 1MB em pouco mais de um ano — e antes disso, porque
`days` e `weekPlans` dividem o mesmo documento. No limite não há degradação gradual:
**todo salvamento passa a falhar**, no meio do treino, começando pelos alunos mais antigos.

**Correção, na fase 1.** O 2.0 arquiva automaticamente entradas antigas em
`clients/{id}/historyArchive/{weekKey}`, um documento por semana contendo as entradas
daquela semana. O documento principal para de crescer e nenhum dado é perdido.

Mecânica, para não deixar ambiguidade na implementação:

- **O que conta como antigo:** entradas cujo `weekKey` seja anterior às 26 semanas que
  antecedem a semana corrente. O corte é por `weekKey`, não por data absoluta, para que
  uma semana nunca fique dividida entre documento e arquivo.
- **Quando roda:** logo depois de uma leitura bem-sucedida do documento do aluno, no
  aparelho **do próprio aluno**, no máximo uma vez por sessão, e nunca durante um
  salvamento. Não roda no aparelho do personal: ele assina todos os alunos de uma vez, e
  arquivar todos no carregamento dispararia uma rajada de escritas sem necessidade — cada
  aluno abre o próprio app com frequência muito maior do que a exigida para manter o
  documento abaixo do limite.
- **Como roda:** escrita do documento de arquivo primeiro, remoção das entradas do array
  depois, em operações separadas. Se a segunda falhar, o pior caso é entrada duplicada
  entre arquivo e array — nunca entrada perdida, que é o que a ordem inversa arriscaria.
  A leitura que junta arquivo e documento reconcilia a duplicata por `setId` + `dateKey`,
  e nasce na fase 2 junto com a tela de progressão, o primeiro lugar que lê histórico
  arquivado. Na fase 1 a duplicata é inofensiva: quem lê histórico é
  `buildLastDoneIndex`, que procura a entrada mais recente e portanto ignora as antigas.
- **Permissão:** como o arquivamento roda no aparelho do aluno, as regras precisam
  permitir que o dono escreva na própria subcoleção `historyArchive` (ver abaixo).

Efeito colateral aceito pelo dono do projeto: enquanto o 1.0 estiver no ar, os gráficos
dele passam a mostrar apenas os últimos seis meses, porque ele só lê o array em documento.
O 2.0 lê os dois e mostra o histórico completo.

Depois que o 1.0 sair do ar, `history` migra inteiro para subcoleção.

## Arquitetura

### Estrutura

O critério é que nenhum arquivo passe de ~250 linhas e que cada um responda a uma
pergunta só.

```
src/
  main.ts                 ponto de entrada, roteamento de telas
  firebase.ts             init do SDK modular v10
  auth/                   login, convite, sessão
  data/
    schema.ts             tipos do contrato acima
    client-repo.ts        leitura/escrita do documento do aluno
    photos-repo.ts        subcoleção de fotos
    history-archive.ts    arquivamento do histórico
  domain/                 funções puras, sem DOM e sem rede
    week.ts               weekKey, promoção de semana, calendário
    history.ts            índice de progressão, última carga
    volume.ts             volume por exercício e por grupo muscular
    parse-workout.ts      importação de treino por texto
  ui/
    render.ts             render raiz
    views/                uma tela por arquivo
    components/           série, exercício, dia, cronômetro
```

A divisória mais importante é `domain/`. No 1.0, `weekKeyOf`, `guessMuscle`,
`parseWorkoutText` e o cálculo de progressão estão misturados com manipulação de tela,
e por isso nenhum é testável. Separados, são exatamente a parte que dá para cobrir com
teste barato — e onde os erros doem mais, porque erram um número sem quebrar nada visível.

### Render

`lit-html` (~3KB) no lugar do `innerHTML` total.

O 1.0 reconstrói a tela inteira a cada mudança, e os helpers `commitFocusedField()`,
`renderQueuedFromSync` e `isTypingInApp()` existem apenas para contornar a perda de foco
que isso causa enquanto o aluno digita. São sintoma, não solução. lit-html atualiza só o
nó que mudou, e o problema deixa de existir.

lit-html também escapa interpolações automaticamente. O 1.0 monta HTML por concatenação
com `escapeHTML()` manual, onde um único ponto esquecido vira XSS.

### Estado

Um objeto de estado único, em um módulo, com `subscribe`. O 1.0 espalha o estado por
cerca de quinze variáveis globais mutáveis, o que torna impossível responder "por que a
tela mostrou isso" sem rastrear ordem de escrita. Com um ponto de entrada único para
mudança de estado, toda transição pode ser registrada quando algo estiver estranho.

### Build e deploy

Vite gera arquivos estáticos. Um GitHub Action roda o build e publica no Pages a cada
push na `main`, então o fluxo de trabalho continua sendo apenas `git push`.

O service worker passa a ser gerado pelo `vite-plugin-pwa`. Isso resolve o cache
versionado à mão do 1.0 (`meu-treino-v75`), cuja combinação de `skipWaiting()` com
estratégia cache-first pode servir um `index.html` antigo junto de um `app.js` novo.
A versão passa a sair do hash do build.

O manifest ganha `id`, `scope` e ícone maskable, ausentes no 1.0.

### Testes

Vitest sobre `domain/`. Não se persegue cobertura de interface: o custo não se paga
neste tamanho de projeto. O alvo são as regras que produzem número — semana, progressão,
volume — e o parser de importação de treino.

## Fases

Apenas a **fase 1** vira plano de implementação agora. As fases 2 a 4 são roadmap: cada
uma recebe seu próprio ciclo de design e plano quando chegar a vez, com o aprendizado da
anterior. Tentar planejar as quatro de uma vez produziria detalhe que envelhece antes de
ser usado.

**Fase 1 — núcleo.** Login e convite seguro, regras do Firestore corrigidas,
arquivamento de histórico, lista de alunos, treinos, exercícios, séries, salvamento com
histórico, promoção de semana, cronômetro. Vai ao ar em paralelo ao 1.0.

**Fase 2.** Progressão (tabelas e gráficos), calendário de semanas, visualização de
semana passada, planejamento de semana futura.

**Fase 3.** Cardio, volume por grupo muscular, feedbacks e WhatsApp, fotos de exercício.

**Fase 4.** Importação de treino por texto, personalização de cores e fontes, página de
dados (backup e exportação Excel), banner de instalação.

**Depois da fase 4.** O 1.0 sai do ar e `history` migra inteiro para subcoleção.

## Fora de escopo

- Login biométrico real (exige servidor, portanto plano Blaze).
- Perfis de usuário por custom claims (mesma razão).
- Apagar a conta de login de um aluno pelo app (exige Admin SDK). Continua sendo feito
  pelo Console do Firebase, como no 1.0.
- Reescrever a identidade visual. O 2.0 reproduz a aparência atual; mudança de design é
  decisão separada.
