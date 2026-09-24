CREATE TABLE usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    tipo VARCHAR(20) NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT uk_usuario_email UNIQUE (email),
    CONSTRAINT ck_usuario_tipo CHECK (tipo IN ('CLIENTE', 'PRESTADOR', 'ADMIN'))
);
