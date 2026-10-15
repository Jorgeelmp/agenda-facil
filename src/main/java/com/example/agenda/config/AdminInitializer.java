package com.example.agenda.config;

import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.UsuarioRepository;

@Component
public class AdminInitializer implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminInitializer.class);
    private final UsuarioRepository usuarios;
    private final PasswordEncoder encoder;
    private final String email;
    private final String senha;

    public AdminInitializer(UsuarioRepository usuarios, PasswordEncoder encoder,
            @Value("${app.admin.email:admin@agendafacil.com}") String email,
            @Value("${app.admin.password:Admin@123}") String senha) {
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.email = email.strip().toLowerCase(Locale.ROOT);
        this.senha = senha;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (usuarios.existsByTipo(TipoUsuario.ADMIN)) return;
        if (email.isBlank() || email.length() > 150 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")
                || senha.isBlank() || senha.length() < 6 || senha.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("Configure ADMIN_EMAIL válido e ADMIN_PASSWORD com 6 a 72 bytes para criar o administrador inicial");
        }
        if (usuarios.existsByEmail(email)) {
            throw new IllegalStateException("O email do administrador inicial já pertence a outra conta. Configure outro ADMIN_EMAIL");
        }
        Usuario admin = new Usuario();
        admin.setNome("Administrador");
        admin.setEmail(email);
        admin.setSenha(encoder.encode(senha));
        admin.setTipo(TipoUsuario.ADMIN);
        usuarios.saveAndFlush(admin);
        log.info("Administrador inicial criado: {}", email);
    }
}
