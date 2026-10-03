package com.example.agenda.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.agenda.entity.Servico;

public interface ServicoRepository extends JpaRepository<Servico, UUID> {

    boolean existsByPrestadorId(UUID prestadorId);

    List<Servico> findByPrestadorIdAndAtivoTrueOrderByNomeAsc(UUID prestadorId);
}
