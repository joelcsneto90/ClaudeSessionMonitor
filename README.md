# ClaudeStatus

Painel local que mostra, em tempo real, as sessões do Claude Code abertas na máquina.

## Propósito

Quem trabalha com várias sessões do Claude Code em paralelo (CLI e extensão do VS Code) perde o controle de qual está ocupada, qual espera input, quanto de contexto cada uma já gastou e quanto resta dos limites da conta. O ClaudeStatus resolve isso em uma única página local:

- lista as sessões vivas, ordenadas por atividade (ocupadas, aguardando input, ociosas);
- mostra o % de contexto de cada sessão e as janelas de rate limit (5 h e 7 dias);
- agrupa as sessões por projeto/pasta, com sugestão automática de grupos;
- foca a janela do VS Code de uma sessão com um clique;
- exibe conta e plano em uso.

Tudo roda localmente (`127.0.0.1`): o painel só lê arquivos que o Claude Code já gera em `~/.claude` e não toca em credenciais.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Backend | Node.js ≥ 24, `node:http` (sem framework), `node:sqlite` para persistir grupos, `node:test` nos testes |
| Frontend | React 19, Vite 8 |
| Dados | Arquivos de sessão e transcripts do Claude Code, catálogo de modelos em cache, feed da statusline em `~/.claude-status/feed`, SQLite em `~/.claude-status/claude-status.db` |

## Estrutura

```
backend/             API HTTP + leitura dos dados do Claude Code (sem dependências npm)
  server.js          servidor: /api/* e arquivos estáticos do frontend/dist
  statusline-feed.js grava o payload da statusline (contexto e rate limits) no feed
  lib/               sessões, transcript, feed, grupos, sugestões, modelos, conta, foco, SQLite
frontend/            UI React (Vite)
  src/               App, componentes, hooks e formatação
```

## API

| Rota | Descrição |
| --- | --- |
| `GET /api/state` | Estado completo: sessões, grupos, sugestões, uso e conta |
| `GET /api/sessions` | Sessões vivas |
| `PUT /api/groups` | Substitui os grupos (array JSON) |
| `POST /api/sessions/:id/focus` | Foca a janela do editor da sessão |

## Como rodar

Produção (o backend serve a UI buildada):

```
cd frontend && npm install && npm run build
cd ../backend && node server.js
```

Abra http://127.0.0.1:7788. `HOST` e `PORT` configuram o endereço.

Desenvolvimento (Vite com proxy de `/api` para o backend):

```
cd backend && node server.js
cd frontend && npm run dev
```

## Testes

```
cd backend && node --test
cd frontend && npm test
```

## Feed da statusline (opcional)

Para ter o % de contexto exato e os rate limits, a statusline do Claude Code deve chamar `recordStatuslinePayload(payload)` de `backend/statusline-feed.js` com o JSON que recebe. Sem isso o painel estima o contexto pelo transcript.

O painel consulta a API local a cada **2 segundos**; ele não consulta diretamente a Anthropic. Os limites de **5 horas e 7 dias são da conta**, não de cada sessão. Cada janela usa a leitura mais recente disponível entre os feeds, independentemente da outra.

Um payload só de contexto ou sem uma das janelas não apaga os limites já recebidos nem renova seus horários. Leituras com reset vencido ou inválido não são exibidas como consumo atual: o painel mostra `—` até receber uma leitura válida. Feeds antigos, sem horário individual por janela, continuam usando o horário de gravação original.

O rodapé mostra **quando cada leitura foi recebida da statusline**, não quando o uso foi consultado no servidor. A statusline normalmente roda nos eventos do Claude Code, como novas respostas. Nas versões que suportam `statusLine.refreshInterval`, um intervalo como `60` reexecuta o comando durante períodos ociosos, mas não garante dados novos da Anthropic. A configuração local existente não é alterada por este projeto.

Referência: [statusline do Claude Code](https://code.claude.com/docs/en/statusline).
