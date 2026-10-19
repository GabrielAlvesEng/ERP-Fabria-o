# Fluxograma operacional — Fabriaço (v3, rascunho validado em parte)

Gerado em 19/10/2026. Decisões confirmadas estão em REGRAS_DE_NEGOCIO.md. Renderiza no GitHub, VS Code (com extensão Mermaid) e em visualizadores Mermaid.

```mermaid
flowchart TB
subgraph V["VENDAS"]
A["Contato comercial"] --> B["Cadastro de empresa e contato"] --> C["Elaborar proposta técnica e comercial R0"]
C --> D["Enviar ao cliente"]
D --> E{"Resposta do cliente?"}
E -->|Sem retorno| F["Follow-up"] --> E
E -->|Pede ajustes| G["Nova revisão R1, R2..."] --> D
E -->|Reprovado| H["Registrar motivo da perda"]
E -->|Aprovado| I["Comprovação da aprovação: PC, e-mail, contrato"]
I --> J["Reunião de kick-off com checklist por setor"]
end
subgraph ENG["ENGENHARIA"]
K["Dados técnicos: medidas em campo e pasta do projeto"] --> L["Modelamento 3D e árvore de montagens com COD_OP e COD_MAT"]
L --> M["Detalhamento: desenhos PDF por revisão"]
L --> N["Plano de corte: DXF de chapas e STEP de perfis"]
L --> O["Lista de materiais BOM"]
end
subgraph COM["COMPRAS E FINANCEIRO"]
P["Requisição de materiais"] --> Q["Cotações de fornecedores e comparação"]
Q --> S{"Financeiro aprova a compra?"}
S -->|Não| Q
S -->|Sim| R["Ordem de compra em PDF"]
R --> PG["Financeiro paga o fornecedor: antecipado ou após o recebimento, conforme o fornecedor"]
end
subgraph ALM["ALMOXARIFADO"]
T["Recebimento parcial: aceito ou rejeitado"] --> U["Estoque ou destino direto no projeto"]
end
subgraph PRE["PREPARAÇÃO"]
X["Lotes de corte a laser: chapas e perfis"] --> Y["Dobra, calandra e usinagem"]
end
subgraph FAB["FABRICAÇÃO"]
Z["Peças prontas: conjuntos em espera"] --> AC["Solda e montagem"] --> AD["Pintura"]
end
subgraph QUA["QUALIDADE"]
AE{"Inspeção aprovada?"}
end
subgraph EXP["EXPEDIÇÃO E CAMPO"]
AF["Expedição e transporte"] --> AG["Montagem em campo, se houver"] --> AH["Entrega e aceite do cliente"]
end
subgraph FIN["FATURAMENTO E RECEBIMENTO"]
AI["Emitir NF: medição por etapa ou faturamento final"] --> AJ["Contas a receber"] --> AK["Pagamento recebido"] --> AM{"Entrega concluída e tudo recebido?"}
AM -->|Não| AI
AM -->|Sim| AL["Encerramento financeiro do projeto"]
end
subgraph APO["APOIO"]
RH["RH: documentos, treinamentos e integrações de segurança"]
FR["Agenda e frota: serviços de campo e içamento"]
ADM["Administração: usuários, permissões e auditoria"]
end
J --> K
J -.->|Locação, terceiros, suprimentos| P
J -.->|Condições de medição e faturamento| AI
O --> P
R --> T
N --> X
U --> X
Y --> Z
AD --> AE
AE -->|Não: erro de fabricação, volta ao início da Fabricação| Z
AE -->|Sim| AF
AC -.->|Marcos de medição, só em pedidos muito grandes| AI
AG -.->|Marcos de medição, só em pedidos muito grandes| AI
AH --> AI
RH -.-> AG
FR -.-> AF
FR -.-> AG
classDef dec fill:#efeaff,stroke:#6d4aff,color:#1b2140
class E,S,AE,AM dec
```
