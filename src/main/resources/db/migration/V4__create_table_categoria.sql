CREATE TABLE categoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(255),

    CONSTRAINT uk_categoria_nome UNIQUE (nome)
);
