package com.example.agenda.service;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.example.agenda.config.TokenConfig;
import com.example.agenda.dto.request.AtualizarContaRequest;
import com.example.agenda.dto.response.AtualizarContaResponse;
import com.example.agenda.dto.response.UsuarioResponse;
import com.example.agenda.dto.response.UsuariosResumoResponse;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.AgendamentoRepository;
import com.example.agenda.repository.PrestadorRepository;
import com.example.agenda.repository.UsuarioRepository;

@Service
@Transactional(readOnly = true)
public class UsuarioService {
    private static final Logger log = LoggerFactory.getLogger(UsuarioService.class);

    private final UsuarioRepository usuarios;
    private final AgendamentoRepository agendamentos;
    private final PrestadorRepository prestadores;
    private final PasswordEncoder encoder;
    private final TokenConfig tokenConfig;

    public UsuarioService(UsuarioRepository usuarios, AgendamentoRepository agendamentos, PrestadorRepository prestadores,
            PasswordEncoder encoder, TokenConfig tokenConfig) {
        this.usuarios = usuarios;
        this.agendamentos = agendamentos;
        this.prestadores = prestadores;
        this.encoder = encoder;
        this.tokenConfig = tokenConfig;
    }

    public List<UsuarioResponse> listar() {
        return usuarios.findAllByOrderByNomeAscEmailAsc().stream().map(UsuarioResponse::fromEntity).toList();
    }

    public UsuariosResumoResponse resumo() {
        long clientes = usuarios.countByTipo(TipoUsuario.CLIENTE);
        long prestadores = usuarios.countByTipo(TipoUsuario.PRESTADOR);
        long admins = usuarios.countByTipo(TipoUsuario.ADMIN);
        return new UsuariosResumoResponse(clientes + prestadores + admins, clientes, prestadores, admins);
    }

    public UsuarioResponse buscar(UUID id) {
        return UsuarioResponse.fromEntity(buscarEntidade(id));
    }

    @Transactional
    public AtualizarContaResponse atualizarConta(UUID id, AtualizarContaRequest request) {
        Usuario usuario = buscarEntidade(id);
        usuario.setNome(request.nome().strip());
        usuario.setTelefone(request.telefone() == null || request.telefone().isBlank() ? null : request.telefone().strip());

        if (request.novaSenha() != null && !request.novaSenha().isEmpty()) {
            if (request.senhaAtual() == null || !encoder.matches(request.senhaAtual(), usuario.getSenha())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Senha atual incorreta");
            }
            // BCrypt considera só os primeiros 72 bytes da senha.
            if (request.novaSenha().getBytes(StandardCharsets.UTF_8).length > 72) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nova senha deve ter no máximo 72 bytes");
            }
            usuario.setSenha(encoder.encode(request.novaSenha()));
        }

        Usuario salvo = usuarios.saveAndFlush(usuario);
        log.info("Conta atualizada: {}", salvo.getEmail());
        return new AtualizarContaResponse(UsuarioResponse.fromEntity(salvo), tokenConfig.generateToken(salvo));
    }

    // RF11: exclusão restrita ao ADMIN. Contas com histórico são preservadas.
    @Transactional
    public void excluir(UUID id, UUID adminId) {
        Usuario usuario = buscarEntidade(id);
        if (usuario.getId().equals(adminId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Você não pode excluir a própria conta");
        }
        if (prestadores.existsByUsuarioId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Usuário possui um negócio cadastrado. Exclua ou inative o negócio antes de excluir a conta");
        }
        if (agendamentos.existsByClienteId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Usuário possui agendamentos. A conta não pode ser excluída para preservar o histórico");
        }
        usuarios.delete(usuario);
        log.info("Usuário excluído: {}", usuario.getEmail());
    }

    private Usuario buscarEntidade(UUID id) {
        return usuarios.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado"));
    }
}
