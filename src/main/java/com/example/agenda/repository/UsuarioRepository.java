package com.example.agenda.repository;

import com.example.agenda.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Optional;
import java.util.List;
import java.util.UUID;
import com.example.agenda.entity.enums.TipoUsuario;

import jakarta.persistence.LockModeType;

public interface UsuarioRepository extends JpaRepository<Usuario, UUID> {

    Optional<UserDetails> findUserByEmail(String username);

    boolean existsByEmail(String email);

    boolean existsByTipo(TipoUsuario tipo);

    long countByTipo(TipoUsuario tipo);

    List<Usuario> findAllByOrderByNomeAscEmailAsc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from Usuario u where u.id = :id")
    Optional<Usuario> findByIdParaAgendar(@Param("id") UUID id);

}
