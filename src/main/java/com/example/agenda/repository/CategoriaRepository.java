package com.example.agenda.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.example.agenda.entity.Categoria;

public interface CategoriaRepository extends JpaRepository<Categoria, UUID> {
    List<Categoria> findAllByOrderByNomeAsc();

    @Query("select c from Categoria c where lower(trim(c.nome)) = lower(:nome)")
    List<Categoria> buscarMesmoNome(String nome);
}
