# Correção de publicação — GitHub Pages

A página pública servia index.html de desenvolvimento, com /src/main.tsx. O navegador precisa receber o build de produção.

## Aplicar
1. Extraia os arquivos deste ZIP por cima da pasta local do projeto, mantendo as subpastas. Não exclua o restante do projeto. Inclua a pasta .github.
2. No repositório do GitHub, abra Settings > Secrets and variables > Actions > Variables. Crie duas Repository variables: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY, com os valores do seu .env.local. Use SOMENTE a chave pública anon/publishable, nunca service_role. Esses valores entram no código enviado ao navegador.
3. Em Settings > Pages > Build and deployment > Source selecione GitHub Actions.
4. Faça Commit e Push dos arquivos para main pelo GitHub Desktop.
5. Na aba Actions, aguarde o workflow “Publicar ERP no GitHub Pages” concluir. Se necessário, use Run workflow.
6. Abra https://gabrielalveseng.github.io/ERP-Fabria-o/ e atualize com Ctrl+F5.
7. No Supabase, inclua https://gabrielalveseng.github.io/ERP-Fabria-o/ entre as URLs de redirecionamento permitidas para links de autenticação. Preserve outros endereços utilizados.

## Mudanças
- vite.config.ts: base configurável por VITE_BASE_PATH; padrão / preserva execução local e Netlify.
- src/main.tsx: BrowserRouter usa BASE_URL.
- src/app/LoginPage.tsx: retorno do link de recuperação respeita o caminho base. Não implementa um novo fluxo de redefinição de senha.
- .github/workflows/pages.yml: instala dependências, executa o build, publica dist e gera 404.html para rotas internas. O fallback mantém a interface ao recarregar rotas, mas o Pages responde HTTP 404 nesses acessos diretos.

## Validação
npm ci e VITE_BASE_PATH=/ERP-Fabria-o/ npm run build concluíram com sucesso. Não foi realizado login em Supabase nem publicação remota. Os valores de Supabase não estão no ZIP recebido. O workflow exige que as duas variáveis estejam configuradas antes de publicar.

Este pacote contém apenas arquivos de correção, não o projeto completo. Não altere index.html para apontar manualmente para um bundle: o Vite gera o HTML de produção.
