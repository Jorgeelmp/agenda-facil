CREATE TABLE agendamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL,
    servico_id UUID NOT NULL,
    data_hora TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    observacoes VARCHAR(500),
    criado_em TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_agendamento_cliente FOREIGN KEY (cliente_id) REFERENCES usuario (id),
    CONSTRAINT fk_agendamento_servico FOREIGN KEY (servico_id) REFERENCES servico (id),
    CONSTRAINT ck_agendamento_status CHECK (status IN ('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'CONCLUIDO'))
);

CREATE INDEX idx_agendamento_cliente ON agendamento (cliente_id);
CREATE INDEX idx_agendamento_servico_data_hora ON agendamento (servico_id, data_hora);
