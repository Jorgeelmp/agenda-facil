CREATE TABLE servico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prestador_id UUID NOT NULL,
    nome VARCHAR(150) NOT NULL,
    descricao VARCHAR(500),
    duracao_minutos INTEGER NOT NULL,
    preco NUMERIC(10,2) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_servico_prestador FOREIGN KEY (prestador_id) REFERENCES prestador (id),
    CONSTRAINT ck_servico_duracao CHECK (duracao_minutos > 0),
    CONSTRAINT ck_servico_preco CHECK (preco >= 0)
);

CREATE INDEX idx_servico_prestador ON servico (prestador_id);
