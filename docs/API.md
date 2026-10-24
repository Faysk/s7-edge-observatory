# Contrato do painel S7 — v2

- GET /api/host/snapshot: leitura atual com timestamp/quality/ageSeconds, device, cpu, memory, battery, network, storage, services, diagnostics, availability e details. `details.metrics` contém value/status/source/unit/semantics. Entrada sem leitura tem value null e não gera cartão. Estado ok com valor zero é uma leitura válida.
- GET /api/host/history?metric=cpu&range=24h: série {time,value}, com médias por intervalo, cerca de 360 pontos e lacunas preservadas. Métricas cpu,memory,rx,tx,battery,temp,latency,storage. Intervalos 1h,6h,12h,24h,7d,30d,1a. O painel não oferece gráficos para fontes sem coleta implementada.
- GET /api/host/catalog: catálogo de fontes e capacidades.
- GET /api/host/archive?after=0&limit=100: exportação integral paginada; resposta records/nextAfter/hasMore, limite 1..500. Retenção ilimitada. Os botões de exportação da interface exportam a leitura atual completa, não todo o arquivo histórico.

CPU global usa uma janela aproximada de um segundo por minuto; a idade informada é a idade na coleta do host. CPU do processo: 100% equivale a um núcleo. Memória usada = total − disponível. Temperatura é da bateria. GPU, devfreq e corrente Samsung permanecem brutos quando escala/unidade não foi validada. Fonte indisponível não se transforma em zero.

As séries são para visualização; o banco mantém todos os payloads. O painel não executa comandos remotos. O servidor permanece em :8767 e mantém as regras de proteção de escrita existentes.
