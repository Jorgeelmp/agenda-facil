CREATE TABLE avaliacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agendamento_id UUID NOT NULL,
    nota INTEGER NOT NULL,
    comentario VARCHAR(1000),
    data_avaliacao TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT uk_avaliacao_agendamento UNIQUE (agendamento_id),
    CONSTRAINT fk_avaliacao_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamento (id),
    CONSTRAINT ck_avaliacao_nota CHECK (nota BETWEEN 1 AND 5)
);
