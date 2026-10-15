package com.example.agenda.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.domain.Sort;

import com.example.agenda.entity.Servico;

public interface ServicoRepository extends JpaRepository<Servico, UUID>, JpaSpecificationExecutor<Servico> {

    boolean existsByPrestadorId(UUID prestadorId);

    List<Servico> findByPrestadorIdAndAtivoTrueOrderByNomeAsc(UUID prestadorId);

    boolean existsByCategoriasId(UUID categoriaId);

    @Query("select (count(a) > 0) from Agendamento a where a.servico.id = :servicoId")
    boolean possuiAgendamentos(UUID servicoId);

    @Override
    @EntityGraph(attributePaths = {"prestador", "categorias"})
    List<Servico> findAll(Specification<Servico> spec, Sort sort);
}
