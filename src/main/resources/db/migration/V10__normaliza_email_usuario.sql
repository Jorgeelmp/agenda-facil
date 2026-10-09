-- Emails passam a ser comparados sem diferenciar maiúsculas/minúsculas.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM usuario GROUP BY lower(trim(email)) HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Existem usuários com o mesmo email variando apenas maiúsculas/minúsculas. Remova ou renomeie as contas duplicadas antes de aplicar esta migração.';
    END IF;
END $$;

UPDATE usuario SET email = lower(trim(email)) WHERE email <> lower(trim(email));

CREATE UNIQUE INDEX uk_usuario_email_lower ON usuario (lower(email));
