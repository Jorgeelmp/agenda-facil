package com.example.agenda.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.agenda.entity.Avaliacao;

public interface AvaliacaoRepository extends JpaRepository<Avaliacao, UUID> {
    
    boolean existsByAgendamentoId(UUID agendamentoId);

    Optional<Avaliacao> findByAgendamentoId(UUID agendamentoId);

        @EntityGraph(attributePaths = {"agendamento", "agendamento.cliente", "agendamento.servico",
            "agendamento.servico.prestador", "agendamento.servico.prestador.usuario"})
    Optional<Avaliacao> findDetalhadoById(UUID id);


    @EntityGraph(attributePaths = {"agendamento", "agendamento.cliente", "agendamento.servico",
            "agendamento.servico.prestador"})
    List<Avaliacao> findByAgendamentoClienteIdOrderByDataAvaliacaoDesc(UUID clienteId);

    @EntityGraph(attributePaths = {"agendamento", "agendamento.cliente", "agendamento.servico",
            "agendamento.servico.prestador"})
    List<Avaliacao> findByAgendamentoServicoPrestadorIdOrderByDataAvaliacaoDesc(UUID prestadorId);

    @EntityGraph(attributePaths = {"agendamento", "agendamento.cliente", "agendamento.servico",
            "agendamento.servico.prestador"})
    List<Avaliacao> findAllByOrderByDataAvaliacaoDesc();
    
    @Query("""
            select avg(av.nota) from Avaliacao av
            where av.agendamento.servico.prestador.id = :prestadorId
        """)
    Double calcularMediaPorPrestador(@Param("prestadorId") UUID prestadorId);

    long countByAgendamentoServicoPrestadorId(UUID prestadorId);

}