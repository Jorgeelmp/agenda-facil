CREATE TABLE prestador (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    nome_negocio VARCHAR(150) NOT NULL,
    descricao VARCHAR(500),
    endereco VARCHAR(255),
    telefone_comercial VARCHAR(20),

    CONSTRAINT uk_prestador_usuario UNIQUE (usuario_id),
    CONSTRAINT fk_prestador_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id)
);
