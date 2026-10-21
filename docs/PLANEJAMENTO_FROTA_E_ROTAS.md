# Frota completa e cálculo automático de rotas

Versão 2, 21/10/2026. **Estado: entregas 1 e 2 implementadas (decisão 55); entrega 3 aguarda o contrato da QualP e a chave.**

Respostas do Gabriel: 1) QualP API (perguntou se há jeito gratuito, ver seção 5); 2) flex sempre com gasolina; 3) campos da ficha aprovados; 4) no máximo 3 fotos por veículo. As seções abaixo foram mantidas como planejadas; onde a resposta mudou o plano, vale a decisão 55 (flex = gasolina, 3 fotos, km e pedágio da ida contados 2 vezes até a API chegar).

Pedido (21/10): preço dos 3 combustíveis (gasolina, álcool/etanol, diesel); cadastro completo dos veículos da empresa (placa, informações, fotos, combustível que usa…); cálculo automático do valor da rota por uma API de distância + pedágios, com opção de ida e volta.

## 1. Combustíveis
- Tabela de preços com **gasolina, etanol e diesel** (R$/l), editada em Administração → Frota. O preço único que existe hoje vira o da gasolina.
- Histórico: cada mudança de preço fica registrada (data e quem mudou), para saber com que preço uma proposta antiga foi calculada.

## 2. Cadastro de veículos
Ficha de cada veículo:
- **Identificação:** apelido (ex.: "Strada branca"), placa, marca, modelo, ano, cor, RENAVAM e chassi (opcionais).
- **Tipo:** carro, utilitário, caminhão, caminhão munck ou outro.
- **Eixos:** número de eixos, que define o preço do pedágio (carro 2 eixos; caminhão de 2 a 9 eixos).
- **Combustível:** gasolina, etanol, diesel ou flex. No flex, você escolhe qual usar no cálculo; o padrão é o mais barato por km.
- **Consumo:** km/l, que já existe hoje, com a possibilidade de ter um consumo por combustível no flex.
- **Capacidade:** carga (kg) e passageiros, para referência.
- **Documentos e vencimentos:** licenciamento, seguro e próxima revisão (km ou data). Só para consulta nesta etapa; avisos de vencimento ficam para o módulo Frota (Roadmap, item 8).
- **Fotos:** várias por veículo, guardadas no Storage do Supabase, num espaço privado que só usuários logados veem.
- **Situação:** ativo, em manutenção ou vendido. Nada é apagado: veículo vendido fica inativo.
- **Observações.**

## 3. Cálculo automático da rota (seção Viagem dos custos)
Na linha de **Veículo próprio** (e no **Veículo alugado**):
1. Você escolhe o veículo, a origem e o destino (cidade ou endereço) e marca **ida e volta** se for o caso.
2. O botão **Calcular rota** consulta a API e preenche sozinho:
   - km por viagem;
   - pedágios pela quantidade de eixos do veículo;
   - R$/l pelo combustível do veículo e o preço da tabela.
3. **Ida e volta:** km × 2 e pedágios da volta somados. A volta é calculada de verdade, porque os pedágios podem ser diferentes em cada sentido.
4. A linha guarda a rota usada (data da consulta, km, pedágios, fonte), para a proposta não mudar sozinha se a API mudar depois.
5. Os valores continuam editáveis à mão. Se a API estiver fora do ar, você digita os números, como hoje.

Fórmula do total, igual à de hoje: viagens × (km ÷ km/l × R$/l + pedágio por viagem).

### Segurança
A chave da API **nunca vai para o navegador**. A consulta passa por uma **função do Supabase (Edge Function)** que guarda a chave como segredo, confere se quem chama está logado e com permissão de custos, e guarda o resultado (cache por origem, destino e eixos), para não pagar duas vezes a mesma rota.

## 4. Qual API usar — **decisão do Gabriel**

| Opção | Distância | Pedágio no Brasil | Custo | Observação |
|---|---|---|---|---|
| **QualP API** (recomendada) | sim | sim, por eixo | plano pago (preço sob consulta) | É o mesmo Qualp que o botão de rota já abre hoje; empresa brasileira especializada em pedágio e frete. |
| API de Pedágios (calcularpedagio.com.br) | sim | sim, por categoria (carro, caminhão de 2 a 10 eixos), dinheiro e TAG | a partir de R$ 49,99/mês | Mais barata e com preço aberto. |
| Google Routes API | sim | só em cidades selecionadas, sem garantia para o Brasil | paga por consulta | Boa para distância; pedágio incerto aqui. |

Recomendação: **QualP**, por já ser a ferramenta usada e calcular pedágio por eixo. A API de Pedágios é a alternativa mais barata, e a troca depois é simples, porque tudo passa pela mesma função do Supabase.

**O que preciso:** que você contrate o plano e crie a chave de acesso. Você cadastra a chave como segredo no Supabase, em Edge Functions → Secrets, com o nome `ROTAS_API_KEY`; eu explico o passo a passo. A chave não pode ser colada no chat nem no código (regra de segurança do projeto).

## Entregas (depois da aprovação)
1. Combustíveis (3 preços + histórico) e cadastro completo de veículos com fotos, em Administração → Frota. Os veículos de hoje são migrados.
2. Seção Viagem usando o combustível e os eixos do veículo, com o campo **ida e volta**.
3. Edge Function de rotas + botão **Calcular rota**, quando a chave da API estiver cadastrada.

Até a chave chegar, as entregas 1 e 2 já funcionam com km e pedágio digitados.

## Perguntas
1. API: QualP (recomendada), API de Pedágios ou outra?
2. Veículo flex: calcular com o combustível mais barato por km (recomendado) ou sempre gasolina?
3. Os campos da ficha do veículo servem? Falta algum (ex.: motorista responsável, cartão de combustível)?
4. Fotos: até 10 por veículo, com até 5 MB cada, serve?

## 5. Existe jeito gratuito? (pergunta do Gabriel)
Pesquisado em 21/10/2026:
- **Distância grátis existe, pedágio brasileiro grátis e confiável não.** OpenRouteService proíbe uso comercial no plano gratuito; o servidor público do OSRM é só para demonstração; nenhum dos dois traz pedágio.
- Os dados abertos da ANTT têm a localização das praças federais, mas não um cálculo de rota com tarifa por eixo, e as rodovias estaduais (ARTESP, a maioria das praças em SP) não têm base aberta equivalente.
- Google Routes tem cota mensal gratuita, mas exige cartão cadastrado e o pedágio no Brasil não é garantido.
- **Alternativa sem custo já possível:** rotas salvas — a primeira vez que uma rota (origem, destino, eixos) é usada, os km e o pedágio são digitados (com a ajuda dos botões Qualp e Google Maps que já existem) e o ERP reaproveita nas próximas propostas. Pode ser feita se o Gabriel quiser enquanto a QualP não é contratada.
