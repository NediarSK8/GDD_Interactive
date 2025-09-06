<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# GDD Interativo com IA

O **GDD Interativo com IA** é uma aplicação web de ponta projetada para revolucionar a forma como desenvolvedores de jogos e roteiristas criam e gerenciam seus documentos. Integrado com o poder da API Gemini do Google, esta ferramenta transforma o processo de escrita estática em uma experiência dinâmica e assistida por IA.

Esta aplicação permite a criação, edição e gerenciamento de Documentos de Design de Jogo (GDDs) e Roteiros, oferecendo um conjunto de funcionalidades inteligentes para acelerar o desenvolvimento, aprimorar a criatividade e manter a consistência em toda a sua documentação.

## ✨ Funcionalidades Principais

- **Editor Duplo:** Alterne facilmente entre a edição do seu **GDD** e do **Roteiro**, mantendo todos os seus documentos de design em um só lugar.
- **Integração de Ideias com IA:** Tem uma nova ideia para a sua história ou mecânica de jogo? Descreva-a e a IA irá analisá-la e integrá-la de forma inteligente nos seus documentos existentes.
- **Atualização Global com IA:** Refatore ou reestruture todo o seu GDD ou roteiro com uma única instrução. Peça à IA para "tornar o tom mais sombrio" ou "adicionar mais detalhes sobre o personagem X" e veja a mágica acontecer.
- **Aprimoramento de Texto com IA:** Selecione qualquer trecho de texto e peça à IA para aprimorá-lo. Corrija a gramática, mude o estilo, encurte ou expanda conforme necessário.
- **Geração de Imagens com IA:** Dê vida às suas ideias. A IA pode gerar imagens de arte conceitual, personagens ou ambientes com base no contexto do seu documento e inseri-las diretamente no seu GDD.
- **Chat Inteligente:** Converse com seus documentos. Faça perguntas complexas como "Quais são as motivações do vilão?" ou "Liste todas as mecânicas de combate" e obtenha respostas instantâneas com base no seu trabalho.
- **Exportação para .docx:** Exporte seu GDD e Roteiro para arquivos formatados do Microsoft Word com um único clique.
- **Gestão de Documentos:**
  - Crie, reordene e organize seus documentos em categorias.
  - Navegue facilmente com um explorador de documentos com capacidade de pesquisa.
  - Acompanhe a contagem de palavras em tempo real.
- **Importar/Exportar Projeto:** Salve todo o seu progresso em um único arquivo `.json` ou carregue um projeto existente para continuar de onde parou.

## 🚀 Stack Tecnológica

- **Frontend:** React, Vite, TypeScript
- **IA:** Google Gemini API
- **Geração de Documentos:** `docx`

## 🏁 Começando

Siga estas instruções para executar o projeto localmente.

**Pré-requisitos:**
- Node.js instalado

**Instalação:**

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/seu-repositorio.git
   cd seu-repositorio
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure sua chave de API:
   - Renomeie o arquivo `.env.local.example` para `.env.local`.
   - Abra o arquivo `.env.local` e insira sua chave da API Gemini:
     ```
     GEMINI_API_KEY=SUA_CHAVE_API_AQUI
     ```

4. Execute a aplicação:
   ```bash
   npm run dev
   ```

   A aplicação estará disponível em `http://localhost:5173` (ou em outra porta, se a 5173 estiver em uso).

## 🚀 Deploy

Este projeto está configurado para ser implantado no GitHub Pages.

### Método Automático (GitHub Actions)

O repositório inclui um fluxo de trabalho do GitHub Actions (`.github/workflows/deploy.yml`) que constrói e implanta o site automaticamente sempre que as alterações são enviadas para a branch `main`.

1. Envie suas alterações para a branch `main`.
2. Vá para a aba **Settings** do seu repositório, depois para a seção **Pages**.
3. Certifique-se de que a fonte de "Build and deployment" esteja definida como **GitHub Actions**.

### Método Manual

Se preferir implantar manualmente ou se as Actions não estiverem funcionando:

1. Execute o script de deploy:
   ```bash
   npm run deploy
   ```
   Este comando irá construir o projeto e enviar a pasta `dist` para uma branch `gh-pages` no seu repositório.

2. Configure o GitHub Pages:
   - Vá para a aba **Settings** do seu repositório, depois para a seção **Pages**.
   - Em "Build and deployment", defina a fonte como **Deploy from a branch**.
   - Selecione a branch `gh-pages` e a pasta `/(root)` e clique em **Save**.