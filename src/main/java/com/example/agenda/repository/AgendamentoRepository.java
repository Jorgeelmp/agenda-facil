package com.example.agenda.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.agenda.entity.Agendamento;

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
}
