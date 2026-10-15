-- Impede duplicatas por caixa/espaços, inclusive em requisições simultâneas.
-- Mantém os registros existentes; eventuais duplicatas legadas devem ser resolvidas antes da migração.
CREATE UNIQUE INDEX uk_categoria_nome_normalizado ON categoria (lower(btrim(nome)));
