# Vendedores (Vendas)

Versão 1, 21/10/2026. **Estado: planejamento aguardando aprovação do Gabriel.**

Pedido (21/10):
- aba **Vendedores** em Vendas, para ver a equipe e cadastrar vendedores (o controle completo de funcionários fica no RH, Roadmap item 8);
- **filtrar as propostas por vendedor** no Kanban.

## Hoje
Cada proposta tem um "responsável", que precisa ser usuário do ERP, com login. Existe só um usuário (gabriel.alves), responsável pelas 3 propostas atuais.

## Proposta
1. **Cadastro de vendedor** (aba Vendedores): nome, e-mail, telefone/WhatsApp, cargo (vendedor, representante, gerente comercial…), situação (ativo/inativo) e observações. **Login no ERP é opcional**: um vendedor pode ser ligado ao seu usuário, se tiver um. Nada é apagado: vendedor que sai fica inativo.
2. **Ficha do vendedor**, com números do ano comercial escolhido: propostas, valor em negociação, aprovadas, valor aprovado, conversão e follow-ups vencidos, além da lista das propostas dele.
3. **Proposta com vendedor:** campo "Vendedor" em Nova proposta e nos Dados da proposta. O padrão é o vendedor ligado a quem está criando. As 3 propostas atuais passam para o vendedor "Gabriel Alves", ligado ao seu usuário.
4. **Kanban:** filtro "Todos os vendedores / {vendedor}" ao lado do filtro de empresas, e o nome do vendedor no cartão.
5. **RH depois:** quando o módulo RH existir, o vendedor passa a apontar para o cadastro de funcionário. Os dados pessoais e trabalhistas ficam lá, e aqui fica só o que Vendas usa.
6. **Permissões:** quem tem Vendas pode ver; cadastrar e editar fica com a Administração e o perfil Comercial com permissão de editar (o banco confere).

## Perguntas
1. **O vendedor precisa ter login no ERP?** Recomendo opcional, porque representantes externos podem não usar o sistema.
2. **Quem cadastra vendedores:** Administração e Comercial (recomendado) ou só a Administração?
3. **Comissão:** querem registrar % de comissão por vendedor agora, ou deixar para Financeiro/RH?
4. Uma proposta tem **um vendedor só** (recomendado) ou pode ser dividida entre dois?
