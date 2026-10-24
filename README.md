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

## Validação

```sh
node tests/test_ui.cjs
node --check js/app.js
```

`js/data.js` é somente uma fixture sintética de testes; não é carregada pelo HTML. Não existem registros reais, dumps do aparelho ou capturas de produção neste repositório. Falhas de API preservam a leitura anterior identificada como antiga; sensores ausentes permanecem sem dados.

No dispositivo operador, mantenha arquivos persistentes no microSD e reserve pelo menos 2 GiB disponíveis no armazenamento interno. Esta política não instala quotas automaticamente.
