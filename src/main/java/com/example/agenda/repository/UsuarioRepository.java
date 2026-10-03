package com.example.agenda.repository;

import com.example.agenda.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Optional;
import java.util.UUID;

public interface UsuarioRepository extends JpaRepository<Usuario, UUID> {

    Optional<UserDetails> findUserByEmail(String username);

    boolean existsByEmail(String email);

}
