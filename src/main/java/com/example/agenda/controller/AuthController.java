package com.example.agenda.controller;

import com.example.agenda.config.JWTUserData;
import com.example.agenda.config.TokenConfig;
import com.example.agenda.dto.request.LoginRequest;
import com.example.agenda.dto.request.RegisterUserRequest;
import com.example.agenda.dto.response.LoginResponse;
import com.example.agenda.dto.response.RegisterUserResponse;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.UsuarioRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final TokenConfig tokenConfig;

    public AuthController
            (
                UsuarioRepository usuarioRepository,
                PasswordEncoder passwordEncoder,
                AuthenticationManager authenticationManager,
                TokenConfig tokenConfig)
    {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.tokenConfig = tokenConfig;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse>    login
                                            (
                                                @Valid
                                                @RequestBody
                                                LoginRequest request
                                            )
    {
        UsernamePasswordAuthenticationToken userAndPass = new UsernamePasswordAuthenticationToken(normalizarEmail(request.email()), request.senha());
        Authentication authentication = authenticationManager.authenticate(userAndPass);

        Usuario usuario = (Usuario) authentication.getPrincipal();
        String token = tokenConfig.generateToken(usuario);
        return ResponseEntity.ok(new LoginResponse(token));
    }

    @PostMapping("/register")
    public ResponseEntity<RegisterUserResponse> register
                                                (
                                                    @Valid
                                                    @RequestBody
                                                    RegisterUserRequest request
                                                )
    {
        if (request.tipo() == TipoUsuario.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não é permitido se registrar como ADMIN");
        }
        String email = normalizarEmail(request.email());
        if (usuarioRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email já cadastrado");
        }

        Usuario novoUsuario = new Usuario();
        novoUsuario.setNome(request.nome());
        novoUsuario.setEmail(email);
        novoUsuario.setTelefone(request.telefone());
        novoUsuario.setTipo(request.tipo());
        novoUsuario.setSenha(passwordEncoder.encode(request.senha()));
        usuarioRepository.save(novoUsuario);
        return ResponseEntity.status(HttpStatus.CREATED).body
                (
                    new RegisterUserResponse
                        (
                            novoUsuario.getNome(),
                            novoUsuario.getEmail(),
                            novoUsuario.getTipo()
                        )
                );
    }

    private static String normalizarEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    @GetMapping("/me")
    public ResponseEntity<JWTUserData> me(@AuthenticationPrincipal JWTUserData userData) {
        return ResponseEntity.ok(userData);
    }

}
