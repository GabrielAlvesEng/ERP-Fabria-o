# ERP Fabriaço

Sistema de gestão (ERP) da Fabriaço Brasil, feito módulo a módulo, do primeiro contato comercial ao encerramento financeiro do projeto.

Stack: React, TypeScript, Tailwind CSS, Supabase (PostgreSQL, Auth, Storage) e Netlify.

## Estrutura da pasta

- `CLAUDE.md` — instruções permanentes para o Claude (leia primeiro).
- `ROADMAP.md` — módulos, ordem e próxima etapa autorizada.
- `CHANGELOG.md` — histórico de mudanças.
- `docs/DOCUMENTO_MESTRE.md` — visão e requisitos originais.
- `docs/REGRAS_DE_NEGOCIO.md` — decisões confirmadas e pendências.
- `docs/FLUXOGRAMA.md` — fluxograma operacional da empresa.
- `docs/PLANEJAMENTO_VENDAS.md` — planejamento do módulo Vendas (aguardando aprovação).
- `referencia/` — material de um sistema anterior, somente para consulta.

## Estado atual

Exemplar do módulo Vendas escrito e banco aplicado no Supabase "ERP Fabriaço" (ref `iobfyuscyzyjxmcwcqwj`), com os contatos de 2026 importados. Ver CHANGELOG.

## Como rodar localmente

1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha a URL do projeto Supabase e a chave pública (anon/publishable).
3. `npm run dev` e abra http://localhost:5173

Testes: `npm test`. Build: `npm run build` (saída em `dist/`, publicada pelo Netlify conforme `netlify.toml`).

Banco: migrations em `supabase/migrations/`, aplicadas em ordem, nunca editadas depois de aplicadas.
