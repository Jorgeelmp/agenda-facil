package com.example.agenda.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.agenda.entity.HorarioFuncionamento;
import com.example.agenda.entity.enums.DiaSemana;

public interface HorarioFuncionamentoRepository extends JpaRepository<HorarioFuncionamento, UUID> {

    List<HorarioFuncionamento> findByPrestadorId(UUID prestadorId);

    Optional<HorarioFuncionamento> findByIdAndPrestadorId(UUID id, UUID prestadorId);

    Optional<HorarioFuncionamento> findByPrestadorIdAndDiaSemana(UUID prestadorId, DiaSemana diaSemana);

    boolean existsByPrestadorIdAndDiaSemana(UUID prestadorId, DiaSemana diaSemana);

    boolean existsByPrestadorIdAndDiaSemanaAndIdNot(UUID prestadorId, DiaSemana diaSemana, UUID id);

    void deleteByPrestadorId(UUID prestadorId);
}
