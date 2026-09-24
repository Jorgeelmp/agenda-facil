CREATE TABLE horario_funcionamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prestador_id UUID NOT NULL,
    dia_semana VARCHAR(3) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    intervalo_inicio TIME,
    intervalo_fim TIME,

    CONSTRAINT fk_horario_funcionamento_prestador FOREIGN KEY (prestador_id) REFERENCES prestador (id) ON DELETE CASCADE,
    CONSTRAINT uk_horario_funcionamento_prestador_dia UNIQUE (prestador_id, dia_semana),
    CONSTRAINT ck_horario_funcionamento_dia_semana CHECK (dia_semana IN ('SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM')),
    CONSTRAINT ck_horario_funcionamento_horas CHECK (hora_inicio < hora_fim),
    CONSTRAINT ck_horario_funcionamento_intervalo CHECK (
        (intervalo_inicio IS NULL AND intervalo_fim IS NULL)
        OR (intervalo_inicio IS NOT NULL AND intervalo_fim IS NOT NULL
            AND intervalo_inicio < intervalo_fim
            AND intervalo_inicio >= hora_inicio
            AND intervalo_fim <= hora_fim)
    )
);
