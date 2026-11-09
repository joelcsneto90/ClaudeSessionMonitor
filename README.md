# ClaudeStatus

Painel local que mostra, em tempo real, as sessões do Claude Code abertas na máquina.

## Propósito

Quem trabalha com várias sessões do Claude Code em paralelo (CLI e extensão do VS Code) perde o controle de qual está ocupada, qual espera input, quanto de contexto cada uma já gastou e quanto resta dos limites da conta. O ClaudeStatus resolve isso em uma única página local:

- lista as sessões vivas, ordenadas por atividade (ocupadas, aguardando input, ociosas);
- mostra o % de contexto de cada sessão e as janelas de rate limit (5 h e 7 dias);
- agrupa as sessões por projeto/pasta ou por vínculo manual de uma sessão;
- oferece ações para copiar o comando de retomada e adicionar uma sessão a um grupo;
- foca a janela do VS Code de uma sessão com um clique;
- exibe conta e plano em uso.

Tudo roda localmente (`127.0.0.1`): o painel combina arquivos do Claude Code com integrações opcionais de statusline, sem ler credenciais nem chamar diretamente a API da Anthropic.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Backend | Node.js ≥ 24, `node:http` (sem framework), `node:sqlite` para persistir grupos, `node:test` nos testes |
| Frontend | React 19, Vite 8 |
| Dados | Arquivos de sessão e transcripts do Claude Code, catálogo de modelos em cache, feed da statusline em `~\.claude-status\feed`, SQLite em `~\.claude-status\claude-status.db` |

## Estrutura

```
backend\             API HTTP + leitura dos dados do Claude Code (sem dependências npm)
  server.js          servidor: /api/* e arquivos estáticos do frontend\dist
  statusline-feed.js grava o payload da statusline (contexto e rate limits) no feed
  lib\               sessões, transcript, feed, grupos, sugestões, modelos, conta, foco, SQLite
frontend\            UI React (Vite)
  src\               App, componentes, hooks e formatação
```

## Como os dados chegam à tela

```text
Claude Code
  |-- arquivos de sessão e transcripts ----> backend: sessões, títulos e contexto
  |-- catálogo de modelos em cache --------> backend: tamanho da janela de contexto
  |
  `-- payload da statusline
        `-- integração chama recordStatuslinePayload(payload)
              `-- feed JSON local --------> backend: contexto e limites 5h/7d

SQLite local: grupos e regras -------------> backend
Cache opcional de conta da statusline -----> backend
                                               |
                                               `-- GET /api/state
                                                     `-- frontend React
```

O navegador pede o estado completo a cada **2 segundos**. O backend monta a resposta lendo as fontes locais e aplicando as regras de grupo. Não existe um processo de coleta de hora em hora, WebSocket ou consulta periódica direta à Anthropic.

O frontend evita consultas simultâneas e tenta atualizar assim que a aba volta a ficar visível ou recebe foco. O navegador pode reduzir a frequência dos timers em segundo plano. Se a API falhar, a tela mantém o último estado recebido e exibe um aviso.

### Fontes de dados

`~` representa a pasta pessoal do usuário que executa o backend; no Windows, corresponde a `$HOME` no PowerShell. Os caminhos não são relativos à pasta do repositório.

| Fonte local | O que o painel obtém | Quem grava |
| --- | --- | --- |
| `~\.claude\sessions\*.json` | ID, PID, diretório, nome, status, origem e horários da sessão | Claude Code |
| `~\.claude\projects\<projeto>\<sessionId>.jsonl` | Título gerado, modelo e tokens da última resposta encontrada | Claude Code |
| `~\.claude\cache\model-catalog\*.json` | Limite de tokens por modelo, em `runtime.max_input_tokens` | Claude Code |
| `~\.claude-status\feed\<sessionId>.json` | Contexto informado pela statusline, limites de uso e horários de recebimento | Integração com `backend\statusline-feed.js` |
| `~\.claude\.statusline-account.json` | Email e plano, quando disponíveis | Integração externa de statusline; o projeto apenas lê |
| `~\.claude-status\claude-status.db` | Grupos, cores, ordem e regras de associação | Backend do ClaudeStatus |

O cache de conta é opcional: não é uma consulta ao serviço de autenticação e não é criado pelo painel. A ausência dele não impede a listagem das sessões.

### Sessões, status e títulos

O backend considera apenas registros com PID inteiro positivo e processo ainda existente. A verificação usa `process.kill(pid, 0)`, que consulta a existência do processo sem encerrá-lo. Arquivos de sessão inválidos ou de processos que já terminaram não aparecem.

O status vem do arquivo de sessão, não de uma análise do texto da conversa:

| Status | Exibição |
| --- | --- |
| `busy` | rodando |
| `shell` | shell |
| `waiting` | aguardando |
| `idle` | parada |

Sessões ocupadas aparecem primeiro; depois, as que aguardam input; por último, as ociosas. Entre as que aguardam input, a espera mais antiga vem primeiro. Nos demais grupos de status, a alteração mais recente vem primeiro.

Quando o nome da sessão foi derivado da pasta (`nameSource: "derived"`), o painel prefere o título `ai-title` do transcript. Nomes escolhidos pelo usuário são preservados.

### Como o percentual de contexto é calculado

A prioridade é o valor `context_window.used_percentage` recebido pela statusline. Quando ele não existe, o backend estima o percentual usando a última resposta de assistente encontrada no transcript:

```text
tokens de entrada = input_tokens
                  + cache_creation_input_tokens
                  + cache_read_input_tokens

contexto (%) = tokens de entrada / max_input_tokens do modelo * 100
```

Tokens de saída não entram nessa conta, e a estimativa é limitada a 100%. Sem tokens ou sem o limite do modelo no catálogo local, o card mostra `—`, não um percentual inventado.

Para evitar reler conversas inteiras a cada consulta, o backend lê no máximo os **256 KiB finais** de cada transcript e reutiliza as informações enquanto o tamanho do arquivo não muda. Se um título ou consumo não estiver nesse trecho, pode manter o valor já encontrado em uma leitura anterior. O catálogo de modelos também é mantido em cache, usando o arquivo JSON mais recente.

### Limites de 5 horas e 7 dias

Os limites são **da conta**, não de cada sessão. O painel não os calcula somando tokens de transcripts: depende dos valores `rate_limits.five_hour` e `rate_limits.seven_day` enviados pelo Claude Code à statusline.

Cada janela é selecionada independentemente entre os feeds. Assim, uma sessão pode fornecer a leitura mais recente de 5h e outra a de 7 dias. O recebimento de um payload só de contexto ou sem uma das janelas não apaga os limites anteriores nem renova seus horários.

O backend descarta janelas cujo `resets_at` já passou ou não representa uma data válida. O campo aceita epoch em segundos, epoch em milissegundos ou uma data ISO. Quando não há leitura válida, a tela mostra `—`: isso significa **dado indisponível**, não consumo zero.

O horário mostrado como **feed recebido há…** é o recebimento local daquela janela, não a hora de uma consulta ao servidor da Anthropic. Feeds antigos sem `receivedAt` individual usam o horário original de gravação (`ts`). A agregação pressupõe que os feeds pertencem à mesma conta; atualmente não há separação dos limites por conta.

## Grupos e ações

Em **Grupos**, é possível criar, renomear, reordenar, mudar cores e editar regras de pasta. O grupo padrão **Outros** é preservado e recebe as sessões sem associação.

As regras são aplicadas nesta ordem:

1. Associação explícita por ID de sessão (`session`).
2. Prefixo de diretório (`pathPrefix`), respeitando fronteiras de pasta.
3. Grupo **Outros**, se nenhuma regra corresponder.

A comparação de pastas normaliza separadores, ignora maiúsculas/minúsculas e remove a barra final. Um prefixo como `D:\Projetos\App` inclui suas subpastas, mas não corresponde a `D:\Projetos\AppExtra`. Entre regras do mesmo tipo que correspondam, vence a primeira encontrada na ordem dos grupos e das regras.

No botão **Ações** de um card:

- **copiar retomada** copia `claude --resume <sessionId>`; não executa o comando nem inicia outra sessão;
- **adicionar ao grupo** cria uma regra explícita para aquela sessão;
- **novo grupo com esta pasta** cria um grupo com regra de prefixo, que também pode incluir outras sessões na mesma pasta ou abaixo dela.

O backend calcula sugestões de grupos por pasta-mãe e uma lista de pastas sem grupo, retornadas em `/api/state`. Elas não são aplicadas automaticamente nem apresentadas como um fluxo próprio na interface atual.

## Foco no VS Code

O nome `claude-vscode` no rodapé do card é clicável. O backend confirma que a sessão continua viva e solicita a abertura/foco da pasta usando `code <diretório>`.

O comando `code` precisa estar no `PATH` do backend. A ação não consegue selecionar uma aba específica de terminal: sessões diferentes na mesma pasta podem compartilhar a mesma janela do VS Code. Outras origens de sessão não recebem essa ação.

## API

O frontend usa principalmente `/api/state`. Todas as rotas abaixo são atendidas pelo mesmo servidor local:

| Rota | Descrição |
| --- | --- |
| `GET /api/state` | Estado completo: `groups`, `sessions`, `suggestions`, `ungrouped`, `usage` e `account` |
| `GET /api/sessions` | Sessões vivas ordenadas, sem o enriquecimento de títulos, grupos e contexto de `/api/state` |
| `PUT /api/groups` | Substitui o conjunto de grupos e regras a partir de um array JSON, preservando o grupo padrão |
| `POST /api/sessions/:id/focus` | Solicita foco da pasta de uma sessão do VS Code; retorna 404 para sessão encerrada ou 409 quando a ação não se aplica |

`PUT /api/groups` recebe a lista inteira, não uma alteração parcial. Cada grupo inclui `id`, `name`, `color` e `rules`; cada regra inclui `id`, `type` e `value`. O backend grava a substituição em uma transação SQLite e retorna o estado completo.

Para inspecionar o estado no PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:7788/api/state
```

## Como rodar

Requisitos: **Node.js 24 ou superior**, npm, um navegador e o Claude Code executado no mesmo ambiente/usuário cujos arquivos o painel vai ler. O backend usa apenas módulos nativos do Node, incluindo SQLite; não exige um servidor de banco separado nem instalação de pacotes própria.

Execute os comandos abaixo na raiz do repositório, em PowerShell.

### Produção local

```powershell
npm --prefix frontend install
npm --prefix frontend run build
node .\backend\server.js
```

Abra http://127.0.0.1:7788. O backend serve tanto a API quanto a UI gerada em `frontend\dist`. O servidor precisa continuar em execução enquanto o painel é usado.

`HOST` e `PORT` configuram o endereço. Por exemplo, para usar outra porta:

```powershell
$env:PORT = '7799'
node .\backend\server.js
```

Após alterar o frontend, refaça o build e recarregue a página. Após alterar o backend, reinicie o processo Node.

### Desenvolvimento

No primeiro terminal:

```powershell
node .\backend\server.js
```

No segundo:

```powershell
npm --prefix frontend install
npm --prefix frontend run dev
```

Abra a URL exibida pelo Vite. Em desenvolvimento, ele serve a UI e encaminha `/api` para `http://127.0.0.1:7788`. Se mudar a porta do backend, ajuste também o destino do proxy em `frontend\vite.config.js`.

## Testes

Na raiz do repositório:

```powershell
npm --prefix backend test
npm --prefix frontend test
```

Os testes usam `node:test`. Há casos para sessões/processos, regras de grupo, persistência SQLite, sugestões, transcripts, ingestão/expiração de limites e formatação/renderização do rodapé. Os testes de renderização usam o Vite para carregar JSX.

## Feed da statusline (opcional)

O painel funciona sem essa integração, mas os limites 5h/7d ficam indisponíveis e o contexto depende da estimativa pelo transcript.

A statusline precisa chamar `recordStatuslinePayload(payload)` de `backend\statusline-feed.js` com o JSON recebido do Claude Code. Esse arquivo é um módulo para importação, não um programa que lê stdin sozinho.

Exemplo de integração em uma statusline JavaScript/ESM que já possui a variável `payload`:

```javascript
import { pathToFileURL } from 'node:url';

const moduleUrl = pathToFileURL(
  String.raw`C:\caminho\ClaudeStatus\backend\statusline-feed.js`
);
const { recordStatuslinePayload } = await import(moduleUrl.href);
const recorded = recordStatuslinePayload(payload);
```

Substitua o caminho pelo local do repositório e preserve a leitura de stdin e a saída visual da sua statusline. O retorno é `true` quando o feed foi gravado ou `false` quando faltam os dados necessários ou houve falha de gravação; a função não lança exceções para não interromper a barra de status.

O payload precisa ter `session_id` (ou `sessionId`) e pelo menos um dos blocos `context_window` ou `rate_limits`. Payloads de hooks sem esses blocos são ignorados. O feed grava contexto, limites, modelo, esforço, custo e horários; nem todos esses campos são exibidos na interface.

A statusline normalmente roda nos eventos do Claude Code, como novas respostas. Nas versões que suportam `statusLine.refreshInterval`, um intervalo como `60` reexecuta o comando durante períodos ociosos, mas não garante dados novos da Anthropic. O projeto não instala essa integração nem altera sua configuração local automaticamente.

Referência: [statusline do Claude Code](https://code.claude.com/docs/en/statusline).

## Persistência e privacidade

O backend não modifica os arquivos de sessão ou os transcripts do Claude Code. Suas gravações ficam em `~\.claude-status`: grupos e regras no SQLite, além dos feeds escritos quando a integração de statusline é chamada. Não há cópia integral de conversas nem histórico de sessões armazenado no banco.

O painel não solicita tokens, não lê credenciais e não envia os dados coletados a um serviço externo. Isso não elimina a sensibilidade dos dados locais: a API e a interface podem mostrar nomes de sessões, caminhos de pastas, email, plano e uso.

**Mantenha o servidor em `127.0.0.1`.** A aplicação não tem autenticação própria. Alterar `HOST` para disponibilizá-la na rede pode expor esses dados e as ações da API.

`node_modules` e `dist` são ignorados pelo Git. Os dados pessoais do painel ficam fora do repositório, na pasta do usuário.

## Limitações e diagnóstico

O projeto depende de formatos locais produzidos pelo Claude Code, que podem mudar entre versões. Ele não é uma API oficial de histórico do Claude e não monitora sessões remotas ou de outro usuário automaticamente. Ainda não há grafo de parentesco entre sessões, forks ou subagentes.

| Sintoma | O que verificar |
| --- | --- |
| Nenhuma sessão aparece | Existem registros em `~\.claude\sessions` para o usuário do backend e os PIDs ainda estão vivos? |
| Contexto aparece como `—` | Falta feed da statusline ou uma combinação de tokens/modelo e catálogo que permita a estimativa. |
| 5h/7d aparecem como `—` | A integração pode não estar ativa, a janela pode não ter vindo no payload ou seu reset já passou. Não significa consumo zero. |
| Feed recebido há muito tempo | Verifique se a statusline continua chamando o módulo no caminho atual. O polling de 2 segundos não produz novos dados de uso. |
| Email/plano não aparecem | O cache opcional `~\.claude\.statusline-account.json` está ausente ou sem esses campos. |
| O clique no VS Code não foca o terminal esperado | Confirme o comando `code` no `PATH`; a ação é por pasta/janela, não por aba de terminal. |
| A página informa que a UI não foi buildada | Rode `npm --prefix frontend run build` na raiz do repositório. |
| Erro de conexão ou estado antigo na tela | Verifique se o backend está em execução e se a porta/proxy corresponde à configuração usada. |
