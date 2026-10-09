package com.example.agenda.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.agenda.entity.Prestador;

import jakarta.persistence.LockModeType;

public interface PrestadorRepository extends JpaRepository<Prestador, UUID> {

    boolean existsByUsuarioId(UUID usuarioId);

    Optional<Prestador> findByUsuarioId(UUID usuarioId);

    List<Prestador> findAllByOrderByNomeNegocioAsc();

    List<Prestador> findByAtivoOrderByNomeNegocioAsc(Boolean ativo);

    // Serializa agendamentos concorrentes do mesmo prestador (RF08).
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Prestador p where p.id = :id")
    Optional<Prestador> findByIdParaAgendar(@Param("id") UUID id);
}
