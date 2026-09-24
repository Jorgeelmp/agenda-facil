CREATE TABLE servico_categoria (
    servico_id UUID NOT NULL,
    categoria_id UUID NOT NULL,

    CONSTRAINT pk_servico_categoria PRIMARY KEY (servico_id, categoria_id),
    CONSTRAINT fk_servico_categoria_servico FOREIGN KEY (servico_id) REFERENCES servico (id) ON DELETE CASCADE,
    CONSTRAINT fk_servico_categoria_categoria FOREIGN KEY (categoria_id) REFERENCES categoria (id) ON DELETE CASCADE
);

CREATE INDEX idx_servico_categoria_categoria ON servico_categoria (categoria_id);
