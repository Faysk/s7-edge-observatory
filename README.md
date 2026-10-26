# S7 Edge Observatory

Interface de telemetria para um servidor Android/S7: CPU, memória, energia, rede, armazenamento, histórico e catálogo de fontes. Temas claro/escuro, gráficos interativos, acessibilidade por teclado e animações reduzidas opcionais.

## Uso

É um frontend estático. Para visualizar o layout localmente:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Abra http://127.0.0.1:8080 . A tela indicará ausência de conexão até existir a API na mesma origem. Não inicia coleta, não instala agente e não simula leituras automaticamente.

O backend correspondente está em https://github.com/Faysk/network-observatory (`app/host_telemetry.py`, `app/host_sources.py` e rotas `/api/host/*`). Para integrar, monte esta interface em `/s7/` no backend e mantenha `/api/host/` na mesma origem. Consulte `docs/API.md`.

Os arquivos Workspace/finish estão incluídos para preview independente; os links `/router/`, `/s7/` e `/valt/` pressupõem a instalação integrada dos três projetos.


## Correções de desempenho e UX (#1–#3)

- **Histórico:** cada métrica/período distingue carregamento, sucesso, sem amostras (`[]` válido), erro e dados antigos da **mesma** faixa. A troca de intervalo aparece imediatamente. Erros oferecem retry sem precisar atualizar todo o dashboard.
- **Rede:** chamadas concorrentes para a mesma chave reutilizam uma única promise, com `finally` garantindo retry após falha. O frontend usa TTL de **60 s** e mantém no máximo **28 séries** em memória. Trocar de página ou intervalo aborta requests que já não são necessários; pause/aba oculta suspendem histórico dispensável.
- **DOM:** snapshots idênticos evitam reconstrução. Para alterações na mesma tela, a interface reconcilia os nós existentes, preservando gráficos SVG, foco e expansões sempre que possível. O explorador mostra **48 leituras por vez**, com botão de carregar mais.
- **Acessibilidade:** indicadores com `aria-busy`, estado por gráfico, região viva para conclusão/erro e suporte a movimento reduzido. Nenhum contador sem leitura vira artificialmente zero.

O painel **não altera o processo de coleta**, cadência de polling de 30 s nem localização do banco; tudo isso continua sob responsabilidade do backend. A implementação foi publicada no telefone com autorização em 25/10/2026, preservando os dados privados. Consulte [matriz de aceite](docs/QA_ACCEPTANCE.md) para os testes sintéticos e pendências da homologação.

## Validação

```sh
node tests/test_ui.cjs
node tests/test_history.cjs
node --check js/app.js
node tests/browser_smoke.cjs # requer Chromium ou Chrome
```

`js/data.js` é somente uma fixture sintética de testes; não é carregada pelo HTML. Não existem registros reais, dumps do aparelho ou capturas de produção neste repositório. Falhas de API preservam a leitura anterior identificada como antiga; sensores ausentes permanecem sem dados.

No dispositivo operador, mantenha arquivos persistentes no microSD e reserve pelo menos 2 GiB disponíveis no armazenamento interno. Esta política não instala quotas automaticamente.
