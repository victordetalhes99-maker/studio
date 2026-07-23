# Retencao de Dados

Matriz tecnica inicial para revisao administrativa e juridica. Este documento nao autoriza exclusao automatica definitiva.

## Categorias

| Categoria            | Finalidade                                | Prazo configuravel          | Inicio da contagem             | Acao apos prazo                  | Conservacao possivel                             | Responsavel               |
| -------------------- | ----------------------------------------- | --------------------------- | ------------------------------ | -------------------------------- | ------------------------------------------------ | ------------------------- |
| Cadastros            | Identificacao e continuidade operacional  | 3650 dias                   | Ultima interacao               | Revisao administrativa           | Obrigacao legal ou exercicio regular de direitos | Administracao             |
| Fichas de saude      | Triagem e seguranca do procedimento       | 3650 dias                   | Ultima sessao                  | Bloqueio ou anonimização         | Tutela da saude e obrigacoes sanitarias          | Responsavel tecnico       |
| Contratos e termos   | Prova documental e auditoria              | 3650 dias                   | Aceite                         | Arquivamento restrito            | Exercicio regular de direitos                    | Administracao             |
| Assinaturas          | Integridade documental                    | 3650 dias                   | Aceite                         | Revisao administrativa           | Prova de autoria e exercicio regular de direitos | Administracao             |
| Imagens              | Registro tecnico e uso opcional de imagem | 365 dias                    | Revogacao ou ultima utilizacao | Revisao administrativa           | Defesa, auditoria ou obrigacao aplicavel         | Marketing / Administracao |
| Consentimentos       | Prova de consentimento e revogacao        | 3650 dias                   | Aceite ou revogacao            | Arquivamento restrito            | Exercicio regular de direitos                    | Privacidade               |
| Revogacoes           | Prova da retirada de autorizacao          | 3650 dias                   | Revogacao                      | Arquivamento restrito            | Exercicio regular de direitos                    | Privacidade               |
| Check-ins            | Operacao e historico de atendimento       | 1825 dias                   | Encerramento                   | Revisao administrativa           | Auditoria e continuidade operacional             | Recepcao / Administracao  |
| Logs administrativos | Seguranca, auditoria e investigacao       | 365 dias                    | Evento                         | Revisao administrativa           | Seguranca e exercicio regular de direitos        | Administracao             |
| Solicitacoes LGPD    | Atendimento ao titular                    | 1825 dias                   | Encerramento                   | Arquivamento restrito            | Exercicio regular de direitos                    | Privacidade               |
| Backups              | Recuperacao e continuidade                | Conforme politica de backup | Geracao do pacote              | Expurgo controlado com aprovacao | Continuidade do negocio                          | Infraestrutura            |
| Documentos orfaos    | Higiene operacional                       | 90 dias                     | Identificacao do orfao         | Revisao administrativa           | Auditoria ou investigacao pendente               | Administracao             |

## Fluxo operacional

1. Gerar relatorio de itens vencidos.
2. Submeter para revisao administrativa.
3. Registrar aprovacao, fundamento e responsavel.
4. Executar bloqueio, anonimização, arquivamento ou outra acao registrada.
5. Manter trilha de auditoria da decisao.

## Observacoes

- Exclusao automatica definitiva permanece desabilitada nesta etapa.
- Dados de saude e documentos sensiveis exigem controles mais restritos.
- Ajustes de prazo e fundamento dependem de revisao juridica e sanitaria local.
