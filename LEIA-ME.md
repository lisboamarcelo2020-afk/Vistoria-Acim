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

## Numeração e acompanhamento das vistorias

O botão **Todas as vistorias** reúne aguardando, iniciadas e finalizadas, com número sequencial, código do imóvel e responsável. O filtro permite consultar cada situação. A numeração aparece também no relatório.

O código do imóvel pode ser alterado em **Dados do imóvel** antes da primeira finalização. Depois disso fica bloqueado, inclusive ao abrir novamente a vistoria. As vistorias antigas recebem numeração na ordem da data de criação, preservando seus identificadores internos, fotos e descrições. Uma exclusão não libera o número para reutilização.

A sequência e a lista pertencem ao armazenamento deste navegador. Não constituem uma sequência única da imobiliária entre computadores, celulares ou perfis. Para isso, ainda é necessário implementar e configurar banco de dados central e controle de acesso. Não limpe os dados do navegador sem exportar as vistorias.


## Destaques de cada ambiente

Depois de adicionar fotos pela câmera ou pelos arquivos, o editor pergunta se deseja registrar destaques positivos e negativos. **Registrar destaques com fotos e descrição** abre um registro vinculado, como **Sala — DESTAQUES**, com os mesmos recursos do ambiente: câmera, importação de fotos, descrição escrita, ditado, análise de fotos por IA, edição e salvamento. Os destaques têm fotos e descritivo próprios; a descrição original do ambiente pode ser consultada nessa tela.

Campos opcionais registram evidências positivas e negativas. O botão **Salvar e voltar ao ambiente principal** retorna ao ambiente. Reabrir os destaques usa o mesmo registro. O título acompanha o nome do ambiente principal. Ambos aparecem no relatório individual e comparativo, com suas respectivas fotos e descrições. Ao excluir um ambiente com destaques, a confirmação informa que ambos serão excluídos.

Os destaques são salvos automaticamente e incluídos na exportação dos dados. Registre apenas o que foi observado; um campo vazio não significa ausência de defeitos. A análise de fotos existente não preenche nem substitui os campos de evidências.

A análise usa as imagens em alta resolução e referências como Foto 1, Foto 2 etc. O descritivo separa descrição técnica, evidências positivas, pontos de atenção, declarações do vistoriador e limitações. Nos destaques, o contexto do ambiente principal é enviado somente como referência declarada, com as fotos do próprio registro de destaques. A análise detalhada pode demorar mais e consumir mais créditos da API.

O descritivo não inclui medidas, dimensões, áreas nem estimativas de tamanho; prioriza a aparência, a localização e a conservação dos elementos visíveis.
