package com.example.agenda.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.agenda.entity.Agendamento;

import jakarta.persistence.LockModeType;

public interface AgendamentoRepository extends JpaRepository<Agendamento, UUID> {

    @Query("""
            select ag from Agendamento ag
            join fetch ag.servico se
            where se.prestador.id = :prestadorId
              and ag.status in (com.example.agenda.entity.enums.StatusAgendamento.PENDENTE,
                               com.example.agenda.entity.enums.StatusAgendamento.CONFIRMADO)
              and ag.dataHora < :fim
              and timestampadd(minute, se.duracaoMinutos, ag.dataHora) > :inicio
            """)
    List<Agendamento> findOcupadosNoPeriodo(@Param("prestadorId") UUID prestadorId,
            @Param("inicio") LocalDateTime inicio,
            @Param("fim") LocalDateTime fim);

    @Query("""
            select ag from Agendamento ag
            join fetch ag.servico se
            where ag.cliente.id = :clienteId
              and ag.status in (com.example.agenda.entity.enums.StatusAgendamento.PENDENTE,
                               com.example.agenda.entity.enums.StatusAgendamento.CONFIRMADO)
              and ag.dataHora < :fim
              and timestampadd(minute, se.duracaoMinutos, ag.dataHora) > :inicio
            """)
    List<Agendamento> findAtivosDoClienteNoPeriodo(@Param("clienteId") UUID clienteId,
            @Param("inicio") LocalDateTime inicio,
            @Param("fim") LocalDateTime fim);

    // Evita que duas alterações simultâneas do mesmo agendamento se sobrescrevam.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select ag from Agendamento ag where ag.id = :id")
    Optional<Agendamento> findByIdParaAlterar(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"cliente", "servico", "servico.prestador", "servico.prestador.usuario"})
    Optional<Agendamento> findDetalhadoById(UUID id);

    @EntityGraph(attributePaths = {"cliente", "servico", "servico.prestador"})
    List<Agendamento> findByClienteIdOrderByDataHoraDesc(UUID clienteId);

    @EntityGraph(attributePaths = {"cliente", "servico", "servico.prestador"})
    List<Agendamento> findByServicoPrestadorIdOrderByDataHoraDesc(UUID prestadorId);

    @EntityGraph(attributePaths = {"cliente", "servico", "servico.prestador"})
    List<Agendamento> findAllByOrderByDataHoraDesc();
}
