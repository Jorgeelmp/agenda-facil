-- A exclusão de serviço remove seus vínculos, mas a de categoria deve respeitar
-- os serviços existentes, inclusive se uma associação for criada simultaneamente.
ALTER TABLE servico_categoria DROP CONSTRAINT fk_servico_categoria_categoria;
ALTER TABLE servico_categoria ADD CONSTRAINT fk_servico_categoria_categoria
    FOREIGN KEY (categoria_id) REFERENCES categoria (id) ON DELETE RESTRICT;
