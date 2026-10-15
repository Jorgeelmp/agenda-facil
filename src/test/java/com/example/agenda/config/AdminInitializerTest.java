package com.example.agenda.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.UsuarioRepository;

@ExtendWith(MockitoExtension.class)
class AdminInitializerTest {
    @Mock UsuarioRepository usuarios;
    @Mock PasswordEncoder encoder;
    AdminInitializer initializer;

    @BeforeEach
    void preparar() {
        initializer = new AdminInitializer(usuarios, encoder, " ADMIN@AGENDAFACIL.COM ", "Admin@123");
    }

    @Test
    void criaAdminQuandoNaoExisteComSenhaCriptografada() {
        when(encoder.encode("Admin@123")).thenReturn("hash-bcrypt");
        initializer.run();
        ArgumentCaptor<Usuario> salvo = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarios).saveAndFlush(salvo.capture());
        assertThat(salvo.getValue().getEmail()).isEqualTo("admin@agendafacil.com");
        assertThat(salvo.getValue().getTipo()).isEqualTo(TipoUsuario.ADMIN);
        assertThat(salvo.getValue().getSenha()).isEqualTo("hash-bcrypt").isNotEqualTo("Admin@123");
    }

    @Test
    void naoCriaNemRedefineSenhaQuandoJaExisteQualquerAdmin() {
        when(usuarios.existsByTipo(TipoUsuario.ADMIN)).thenReturn(true);
        initializer.run();
        verify(usuarios, never()).existsByEmail(any());
        verify(usuarios, never()).saveAndFlush(any());
        verifyNoInteractions(encoder);
    }

    @Test
    void reinicializacaoNaoDuplicaConta() {
        when(usuarios.existsByTipo(TipoUsuario.ADMIN)).thenReturn(false, true);
        when(encoder.encode(any())).thenReturn("hash-bcrypt");
        initializer.run();
        initializer.run();
        verify(usuarios, times(1)).saveAndFlush(any());
    }

    @Test
    void emailOcupadoNaoPromoveContaExistente() {
        when(usuarios.existsByEmail("admin@agendafacil.com")).thenReturn(true);
        assertThatThrownBy(() -> initializer.run()).isInstanceOf(IllegalStateException.class).hasMessageContaining("ADMIN_EMAIL");
        verify(usuarios, never()).saveAndFlush(any());
        verifyNoInteractions(encoder);
    }

    @Test
    void aceitaCredenciaisConfiguradas() {
        new AdminInitializer(usuarios, encoder, "gestao@empresa.com", "OutraSenha123").run();
        verify(usuarios).existsByEmail("gestao@empresa.com");
        verify(encoder).encode("OutraSenha123");
    }

    @Test
    void rejeitaConfiguracaoInvalidaAntesDeSalvar() {
        assertThatThrownBy(() -> new AdminInitializer(usuarios, encoder, "invalido", "123").run())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("ADMIN_PASSWORD");
        assertThatThrownBy(() -> new AdminInitializer(usuarios, encoder, "admin@teste.com", "x".repeat(73)).run())
                .isInstanceOf(IllegalStateException.class);
        verify(usuarios, never()).saveAndFlush(any());
    }
}
