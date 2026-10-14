package com.example.agenda.service;


import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.agenda.config.JWTUserData;
import com.example.agenda.dto.request.AvaliacaoRequest;
import com.example.agenda.dto.request.AvaliacaoUpdateRequest;
import com.example.agenda.dto.response.AvaliacaoResponse;
import com.example.agenda.dto.response.NotaMediaResponse;
import com.example.agenda.entity.Agendamento;
import com.example.agenda.entity.Avaliacao;
import com.example.agenda.entity.enums.StatusAgendamento;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.AgendamentoRepository;
import com.example.agenda.repository.AvaliacaoRepository;
import com.example.agenda.repository.PrestadorRepository;


@Service 
@Transactional(readOnly = true)
public class AvaliacaoService {
    private static final Logger log = LoggerFactory.getLogger(AvaliacaoService.class);

    private final AvaliacaoRepository avaliacaoRepository;
    private final AgendamentoRepository agendamentoRepository;
    private final PrestadorRepository prestadorRepository;

    public AvaliacaoService(AvaliacaoRepository avaliacaoRepository, AgendamentoRepository agendamentoRepository, PrestadorRepository prestadorRepository) {
        this.avaliacaoRepository = avaliacaoRepository;
        this.agendamentoRepository = agendamentoRepository;
        this.prestadorRepository = prestadorRepository;
    }

    @Transactional
    public AvaliacaoResponse criar(AvaliacaoRequest request, JWTUserData userData) {
        Agendamento agendamento = agendamentoRepository.findByIdParaAlterar(request.agendamentoId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Agendamento não encontrado"));

        if (!isClienteDoAgendamento(agendamento, userData)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o cliente do agendamento pode avaliá-lo");
        }

        if (agendamento.getStatus() != StatusAgendamento.CONCLUIDO) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Somente agendamentos concluídos podem ser avaliados");
        }

        if (avaliacaoRepository.existsByAgendamentoId(agendamento.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este agendamento já foi avaliado");
        }

        Avaliacao avaliacao = new Avaliacao();
        avaliacao.setAgendamento(agendamento);
        avaliacao.setNota(request.nota());
        avaliacao.setComentario(normalizarComentario(request.comentario()));
        Avaliacao salva = avaliacaoRepository.saveAndFlush(avaliacao);

        log.info("Avalição {} criada para o agendamento {} com nota {}", salva.getId(), agendamento.getId(), salva.getNota());

        return AvaliacaoResponse.fromEntity(salva);
    }

    public List<AvaliacaoResponse> listar(JWTUserData userData) {
        List<Avaliacao> avaliacoes = switch (TipoUsuario.valueOf(userData.tipo())) {
            case ADMIN -> avaliacaoRepository.findAllByOrderByDataAvaliacaoDesc();
            case CLIENTE -> avaliacaoRepository.findByAgendamentoClienteIdOrderByDataAvaliacaoDesc(userData.userId());
            case PRESTADOR -> prestadorRepository.findByUsuarioId(userData.userId()).map(prestador -> 
                avaliacaoRepository.findByAgendamentoServicoPrestadorIdOrderByDataAvaliacaoDesc(prestador.getId())).orElse(List.of());
        };

        return avaliacoes.stream().map(AvaliacaoResponse::fromEntity).toList();
    }

    public AvaliacaoResponse buscar(UUID id, JWTUserData userData) {
        Avaliacao avaliacao = buscaDetalhada(id);
        Agendamento agendamento = avaliacao.getAgendamento();
        if (!isAdmin(userData) && !isClienteDoAgendamento(agendamento, userData) && !isPrestadorDoAgendamento(agendamento, userData)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão para acessar esta avaliação");
        }

        return AvaliacaoResponse.fromEntity(avaliacao);
    }

    public List<AvaliacaoResponse> listarPorPrestador(UUID prestadorId) {
        exigirPrestadorExistente(prestadorId);
        return avaliacaoRepository.findByAgendamentoServicoPrestadorIdOrderByDataAvaliacaoDesc(prestadorId)
        .stream().map(AvaliacaoResponse::fromEntity).toList();
    }

    public NotaMediaResponse notaMedia(UUID prestadorId) {
        exigirPrestadorExistente(prestadorId);
        Double media = avaliacaoRepository.calcularMediaPorPrestador(prestadorId);
        long total = avaliacaoRepository.countByAgendamentoServicoPrestadorId(prestadorId);
        Double arredondada = media == null ? null : Math.round(media * 10) / 10.0;
        return new NotaMediaResponse(prestadorId, arredondada, total);
    }

    @Transactional
    public AvaliacaoResponse atualizar(UUID id, AvaliacaoUpdateRequest request, JWTUserData userData) {
        Avaliacao avaliacao = buscaDetalhada(id);
        if (!isClienteDoAgendamento(avaliacao.getAgendamento(), userData)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o autor pode editar esta avaliação");
        }

        avaliacao.setNota(request.nota());
        avaliacao.setComentario(normalizarComentario(request.comentario()));
        Avaliacao salva = avaliacaoRepository.saveAndFlush(avaliacao);
        log.info("Avaliação {} atualiazada para nota {}", salva.getId(), salva.getNota());
        return AvaliacaoResponse.fromEntity(salva);
    }

    @Transactional
    public void excluir(UUID id, JWTUserData userData) {
        Avaliacao avaliacao = buscaDetalhada(id);
        if (!isAdmin(userData) && !isClienteDoAgendamento(avaliacao.getAgendamento(), userData)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o autor ou um administrador pode excluir esta avaliação");
        }

        avaliacaoRepository.delete(avaliacao);
        avaliacaoRepository.flush();
        log.info("Avaliação {} excluída por {}", id, userData.userId());
    }

    private void exigirPrestadorExistente(UUID prestadorId) {
        if (!prestadorRepository.existsById(prestadorId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Prestador não encontrado");
        }
    }

    private Avaliacao buscaDetalhada(UUID id) {
        return avaliacaoRepository.findDetalhadoById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Avaliação não encontrada"));
    }

    private boolean isClienteDoAgendamento(Agendamento agendamento, JWTUserData userData) {
        return TipoUsuario.CLIENTE.name().equals(userData.tipo()) && Objects.equals(agendamento.getCliente().getId(), userData.userId());
    }

    private boolean isAdmin(JWTUserData userData) {
        return TipoUsuario.ADMIN.name().equals(userData.tipo());
    }

    private boolean isPrestadorDoAgendamento(Agendamento agendamento, JWTUserData userData) {
        return TipoUsuario.PRESTADOR.name().equals(userData.tipo()) && Objects.equals(agendamento.getServico().getPrestador().getUsuario().getId(), userData.userId());
    }

    private String normalizarComentario(String comentario) {
        return comentario == null || comentario.isBlank() ? null : comentario.strip();
    }
}
