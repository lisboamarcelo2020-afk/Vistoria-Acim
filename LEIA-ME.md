# Vistoria de Imóveis — com análise de fotos por IA

O corretor cadastra imóvel, registra cômodos, fotos e observações, pede um descritivo sugerido pela IA, revisa o texto e salva o relatório em PDF pela impressão do navegador.

## Para testar no computador com IA

Requisitos: Node.js 20 ou superior, conta de API da OpenAI com créditos e chave de API. A assinatura do ChatGPT não substitui os créditos da API.

1. Abra um terminal dentro da pasta `vistoria-acim`.
2. Configure a variável de ambiente `OPENAI_API_KEY` com a sua chave. No PowerShell do Windows: `$env:OPENAI_API_KEY="sua-chave-aqui"` (somente na janela atual). Nunca inclua a chave nos arquivos do aplicativo nem envie para os corretores.
3. Execute `node server.mjs`.
4. Abra `http://localhost:3000` no Chrome. Adicione uma foto em um cômodo, clique **Analisar fotos com IA e criar descritivo**, revise a redação e salve.

Sem chave de API, o cadastro, fotos, notas e PDF continuam disponíveis; a análise por IA informa que não foi configurada. Abrir `index.html` diretamente não permite usar a análise por IA.

## Para usar nos celulares dos corretores

Publique o servidor em uma hospedagem que execute Node.js e forneça HTTPS. Configure `OPENAI_API_KEY` como variável secreta nessa hospedagem. Entregue o link HTTPS aos corretores; no Chrome do Android, use ⋮ > Instalar app ou Adicionar à tela inicial. O servidor atende à rota `/api/analyze`, que recebe as fotos e chama a API. Não publique apenas os arquivos estáticos em uma hospedagem simples, pois a análise não funcionará.

Cada aparelho guarda seu próprio rascunho. O PDF é gerado em **Finalizar e gerar relatório > Imprimir / salvar em PDF > Salvar como PDF**. Exporte também os dados em JSON para backup. Não há sincronização central, controle de acesso ou comparação de vistorias anteriores nesta versão.

A análise exige internet, envia as fotos do cômodo ao serviço de IA e pode gerar erros. O vistoriador deve revisar o descritivo e confirmar pessoalmente o estado do imóvel. A fala pode depender do navegador e de internet.
