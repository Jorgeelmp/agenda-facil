package com.example.agenda.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.agenda.entity.Prestador;

public interface PrestadorRepository extends JpaRepository<Prestador, UUID> {

    boolean existsByUsuarioId(UUID usuarioId);

    Optional<Prestador> findByUsuarioId(UUID usuarioId);

    List<Prestador> findAllByOrderByNomeNegocioAsc();

    List<Prestador> findByAtivoOrderByNomeNegocioAsc(Boolean ativo);
}
