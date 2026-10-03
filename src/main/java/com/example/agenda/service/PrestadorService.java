package com.example.agenda.service;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.agenda.config.JWTUserData;
import com.example.agenda.dto.request.PrestadorRequest;
import com.example.agenda.dto.response.PrestadorResponse;
import com.example.agenda.entity.Prestador;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.HorarioFuncionamentoRepository;
import com.example.agenda.repository.PrestadorRepository;
import com.example.agenda.repository.ServicoRepository;
import com.example.agenda.repository.UsuarioRepository;

@Service
@Transactional(readOnly = true)
public class PrestadorService {

    private final PrestadorRepository prestadorRepository;
    private final UsuarioRepository usuarioRepository;
    private final ServicoRepository servicoRepository;
    private final HorarioFuncionamentoRepository horarioRepository;

    public PrestadorService(PrestadorRepository prestadorRepository, UsuarioRepository usuarioRepository,
            ServicoRepository servicoRepository, HorarioFuncionamentoRepository horarioRepository) {
        this.prestadorRepository = prestadorRepository;
        this.usuarioRepository = usuarioRepository;
        this.servicoRepository = servicoRepository;
        this.horarioRepository = horarioRepository;
    }

    @Transactional
    public PrestadorResponse criar(PrestadorRequest request, JWTUserData userData) {
        Usuario usuario = usuarioRepository.findById(userData.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado"));
        if (usuario.getTipo() != TipoUsuario.PRESTADOR) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente usuários PRESTADOR podem criar um perfil de negócio");
        }
        if (prestadorRepository.existsByUsuarioId(usuario.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Usuário já possui um perfil de prestador");
        }

        Prestador prestador = new Prestador();
        prestador.setUsuario(usuario);
        preencher(prestador, request);
        return PrestadorResponse.fromEntity(prestadorRepository.saveAndFlush(prestador));
    }

    public List<PrestadorResponse> listar(Boolean ativo) {
        List<Prestador> prestadores = ativo == null
                ? prestadorRepository.findAllByOrderByNomeNegocioAsc()
                : prestadorRepository.findByAtivoOrderByNomeNegocioAsc(ativo);
        return prestadores.stream().map(PrestadorResponse::fromEntity).toList();
    }

    public PrestadorResponse buscar(UUID id) {
        return PrestadorResponse.fromEntity(buscarEntidade(id));
    }

    public PrestadorResponse buscarMeuPerfil(JWTUserData userData) {
        return prestadorRepository.findByUsuarioId(userData.userId())
                .map(PrestadorResponse::fromEntity)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Perfil de prestador não encontrado"));
    }

    @Transactional
    public PrestadorResponse atualizar(UUID id, PrestadorRequest request, JWTUserData userData) {
        Prestador prestador = buscarParaGerenciar(id, userData);
        preencher(prestador, request);
        return PrestadorResponse.fromEntity(prestadorRepository.save(prestador));
    }

    @Transactional
    public PrestadorResponse alterarStatus(UUID id, Boolean ativo, JWTUserData userData) {
        Prestador prestador = buscarParaGerenciar(id, userData);
        prestador.setAtivo(ativo);
        return PrestadorResponse.fromEntity(prestadorRepository.save(prestador));
    }

    @Transactional
    public void excluir(UUID id, JWTUserData userData) {
        Prestador prestador = buscarParaGerenciar(id, userData);
        if (servicoRepository.existsByPrestadorId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Prestador possui serviços vinculados. Inative o perfil para preservar o histórico");
        }
        // Remove também as entidades gerenciadas antes do perfil, mantendo o JPA sincronizado.
        horarioRepository.deleteByPrestadorId(id);
        horarioRepository.flush();
        prestadorRepository.delete(prestador);
        prestadorRepository.flush();
    }

    public Prestador buscarEntidade(UUID id) {
        return prestadorRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Prestador não encontrado"));
    }

    public Prestador buscarParaGerenciar(UUID id, JWTUserData userData) {
        Prestador prestador = buscarEntidade(id);
        boolean administrador = TipoUsuario.ADMIN.name().equals(userData.tipo());
        boolean dono = TipoUsuario.PRESTADOR.name().equals(userData.tipo())
                && prestador.getUsuario().getId().equals(userData.userId());
        if (!administrador && !dono) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão para gerenciar este prestador");
        }
        return prestador;
    }

    private void preencher(Prestador prestador, PrestadorRequest request) {
        prestador.setNomeNegocio(request.nomeNegocio().strip());
        prestador.setDescricao(request.descricao());
        prestador.setEndereco(request.endereco());
        prestador.setTelefoneComercial(request.telefoneComercial());
    }
}
