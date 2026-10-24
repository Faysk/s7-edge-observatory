# Validação da implementação — S7 Edge Observatory (#1, #2, #3)

Data: 2026-10-24. Escopo: **repositório público sanitizado**, nenhum acesso ou deploy ao Galaxy S7 ou ao backend real.

## Matriz de aceite

| Comportamento | Prova disponível | Estado |
|---|---|---|
| Seleção do período instantânea | Handler atualiza estado e renderiza antes de aguardar rede; Chromium | Automatizado |
| Loading/success/empty/error/stale independentes por métrica + período | `tests/test_history.cjs` com atraso, [] e HTTP 500; Chromium para erro/retry | Automatizado |
| Histórico anterior nunca representa outro período | Cache chaves `métrica:período`; teste 12h → 24h com abort | Automatizado |
| N consumidores compartilham a mesma requisição | 4 consumidores × 4 métricas → 4 fetches (não 16) | Automatizado |
| Falha + retry | Promise removida em `finally`; retry fresco | Automatizado |
| Pausa e aba oculta | Sem novas consultas durante pausa/ocultação, abortando flights inutilizados | Testes sintéticos; validar no navegador físico |
| Cache e memória | TTL 60 s, até 28 séries (LRU por idade de atualização), nenhum armazenamento persistente novo | Revisão de código / teste |
| Snapshot idêntico não recria a tela | Contagem de escritas HTML no Node e identidade de DOM no Chromium | Automatizado |
| Snapshot modificado atualiza sem destruir SVG | Reconciliador DOM com nós preservados (Chromium) | Automatizado |
| Explorer expande sob demanda e pagina | 48 cartões por lote; fixture de 127 e 1.000 medições | Automatizado |
| Zero válido e null ausente | Testes de regressão anteriores + séries artificiais com zero e null | Automatizado |
| Backend com 1 e 4 clientes, bytes, bloqueio SQLite, compressão HTTP | Depende de `network-observatory` e implantação física | Pendente |
| INP ≤200 ms, long tasks >50 ms, FPS, LCP no desktop + Android 8 | Trace real no browser e dispositivo | Pendente |
| Leitor de tela, foco, reduced-motion, toque em viewport móvel | Teste manual com smartphone | Pendente |

## Como rodar

```bash
node tests/test_ui.cjs
node tests/test_history.cjs
node --check js/app.js
node tests/browser_smoke.cjs  # Chrome/Chromium instalado
```

Os dados de `js/data.js` e dos testes são inteiramente sintéticos; o navegador de integração expõe um servidor HTTP efêmero em `127.0.0.1`. Jamais substitua os endpoints fictícios dos testes por URLs de rede privada.

## Homologação no S7 (somente com autorização do operador)

- [ ] Backup/cópia da versão servida e dos arquivos de configuração, com banco persistente no microSD e pelo menos 2 GiB internos livres.
- [ ] Comparar o checkout real e os módulos locais com o repositório público; não presumir que os dois estejam sincronizados.
- [ ] Ativar latência/HTTP 500 simulados em ambiente de teste, não interromper serviço real; testar 6h → 7d → 24h rapidamente.
- [ ] Observar estado visual com zero, null, amostras vazias, API offline, restauração e histórico antigo do mesmo período.
- [ ] Repetir digitação, expansão de contadores, inspeção de gráficos e seleção durante polling real de 30 s.
- [ ] Confirmar suspensão de pedidos em aba oculta e painel pausado; conferir retorno da aba e ausência de bursts.
- [ ] Medir 1 e 4 clientes, bytes transferidos, fetches, consultas SQLite/lock, CPU, heap, memória e DOM, antes/depois, sob cache comparável.
- [ ] Registrar traces desktop e Android 8 para INP, long tasks, movimentação e foco, sem divulgar payloads sensíveis.
- [ ] Verificar no backend `network-observatory` cache/headers e latência das queries (fora do escopo desta PR).

## Limitações

O teste usa fixtures e métricas artificiais. Uma execução rápida no Node **não mede INP, FPS nem LCP**. O browser headless não reproduz CPU, microSD ou WebView/Chromium do aparelho físico. Não declarar as metas de produção como atingidas até confirmar no ambiente autorizado.
