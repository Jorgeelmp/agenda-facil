package com.example.agenda.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.agenda.config.JWTUserData;
import com.example.agenda.dto.request.AgendamentoRequest;
import com.example.agenda.dto.response.AgendamentoResponse;
import com.example.agenda.dto.response.DisponibilidadeResponse;
import com.example.agenda.entity.Agendamento;
import com.example.agenda.entity.Servico;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.StatusAgendamento;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.AgendamentoRepository;
import com.example.agenda.repository.PrestadorRepository;
import com.example.agenda.repository.ServicoRepository;
import com.example.agenda.repository.UsuarioRepository;

@Service
@Transactional(readOnly = true)
public class AgendamentoService {

    private static final String HORARIO_INDISPONIVEL =
            "Horário indisponível. Consulte os horários livres e escolha outro";
    private static final String CLIENTE_OCUPADO =
            "Você já possui um agendamento ativo que coincide com este horário";

    private final AgendamentoRepository agendamentoRepository;
    private final ServicoRepository servicoRepository;
    private final PrestadorRepository prestadorRepository;
    private final UsuarioRepository usuarioRepository;
    private final DisponibilidadeService disponibilidadeService;
    private final Clock clock;

    public AgendamentoService(AgendamentoRepository agendamentoRepository, ServicoRepository servicoRepository,
            PrestadorRepository prestadorRepository, UsuarioRepository usuarioRepository,
            DisponibilidadeService disponibilidadeService, Clock clock) {
        this.agendamentoRepository = agendamentoRepository;
        this.servicoRepository = servicoRepository;
        this.prestadorRepository = prestadorRepository;
        this.usuarioRepository = usuarioRepository;
        this.disponibilidadeService = disponibilidadeService;
        this.clock = clock;
    }

    @Transactional
    public AgendamentoResponse criar(AgendamentoRequest request, JWTUserData userData) {
        Usuario cliente = usuarioRepository.findById(userData.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado"));
        if (cliente.getTipo() != TipoUsuario.CLIENTE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente clientes podem realizar agendamentos");
        }
        Servico servico = buscarServico(request.servicoId());
        validarReserva(servico, cliente, request.dataHora(), null);

        Agendamento agendamento = new Agendamento();
        agendamento.setCliente(cliente);
        agendamento.setServico(servico);
        agendamento.setDataHora(request.dataHora());
        agendamento.setObservacoes(normalizarObservacoes(request.observacoes()));
        agendamento.setStatus(StatusAgendamento.PENDENTE);
        return AgendamentoResponse.fromEntity(agendamentoRepository.saveAndFlush(agendamento));
    }

    public List<AgendamentoResponse> listar(StatusAgendamento status, JWTUserData userData) {
        List<Agendamento> agendamentos = switch (TipoUsuario.valueOf(userData.tipo())) {
            case ADMIN -> agendamentoRepository.findAllByOrderByDataHoraDesc();
            case CLIENTE -> agendamentoRepository.findByClienteIdOrderByDataHoraDesc(userData.userId());
            case PRESTADOR -> prestadorRepository.findByUsuarioId(userData.userId())
                    .map(prestador -> agendamentoRepository.findByServicoPrestadorIdOrderByDataHoraDesc(prestador.getId()))
                    .orElse(List.of());
        };
        return agendamentos.stream()
                .filter(agendamento -> status == null || agendamento.getStatus() == status)
                .map(AgendamentoResponse::fromEntity).toList();
    }

    public AgendamentoResponse buscar(UUID id, JWTUserData userData) {
        Agendamento agendamento = agendamentoRepository.findDetalhadoById(id)
                .orElseThrow(this::naoEncontrado);
        if (!isAdmin(userData) && !isCliente(agendamento, userData) && !isPrestador(agendamento, userData)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão para acessar este agendamento");
        }
        return AgendamentoResponse.fromEntity(agendamento);
    }

    /** Horários livres para remarcar: o próprio agendamento não conta como ocupado. */
    public DisponibilidadeResponse disponibilidadeParaRemarcar(UUID id, UUID servicoId, LocalDate data,
            JWTUserData userData) {
        Agendamento agendamento = agendamentoRepository.findDetalhadoById(id)
                .orElseThrow(this::naoEncontrado);
        exigirPodeAlterar(agendamento, userData);
        return disponibilidadeService.consultar(agendamento.getServico().getPrestador().getId(),
                servicoId == null ? agendamento.getServico().getId() : servicoId, data, agendamento.getId());
    }

    @Transactional
    public AgendamentoResponse atualizar(UUID id, AgendamentoRequest request, JWTUserData userData) {
        Agendamento agendamento = buscarParaAlterar(id);
        exigirPodeAlterar(agendamento, userData);
        Servico servico = buscarServico(request.servicoId());
        if (!servico.getPrestador().getId().equals(agendamento.getServico().getPrestador().getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Não é possível trocar de prestador. Cancele e faça um novo agendamento");
        }

        boolean remarcado = !servico.getId().equals(agendamento.getServico().getId())
                || !request.dataHora().equals(agendamento.getDataHora());
        if (remarcado) {
            validarReserva(servico, agendamento.getCliente(), request.dataHora(), agendamento.getId());
            agendamento.setServico(servico);
            agendamento.setDataHora(request.dataHora());
            // Nova data/serviço precisa ser confirmada novamente pelo prestador.
            agendamento.setStatus(StatusAgendamento.PENDENTE);
        }
        agendamento.setObservacoes(normalizarObservacoes(request.observacoes()));
        return AgendamentoResponse.fromEntity(agendamentoRepository.saveAndFlush(agendamento));
    }

    @Transactional
    public AgendamentoResponse alterarStatus(UUID id, StatusAgendamento novoStatus, JWTUserData userData) {
        Agendamento agendamento = buscarParaAlterar(id);
        boolean admin = isAdmin(userData);
        boolean cliente = isCliente(agendamento, userData);
        boolean prestador = isPrestador(agendamento, userData);
        if (!admin && !cliente && !prestador) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão para alterar este agendamento");
        }

        StatusAgendamento atual = agendamento.getStatus();
        switch (novoStatus) {
            case CONFIRMADO -> {
                if (!admin && !prestador) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o prestador pode confirmar o agendamento");
                }
                exigirStatus(atual, novoStatus, StatusAgendamento.PENDENTE);
            }
            case CONCLUIDO -> {
                if (!admin && !prestador) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o prestador pode concluir o agendamento");
                }
                exigirStatus(atual, novoStatus, StatusAgendamento.CONFIRMADO);
                if (agendamento.getDataHora().isAfter(LocalDateTime.now(clock))) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "O agendamento só pode ser concluído a partir do horário marcado");
                }
            }
            case CANCELADO -> exigirStatus(atual, novoStatus, StatusAgendamento.PENDENTE, StatusAgendamento.CONFIRMADO);
            case PENDENTE -> throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Um agendamento não pode voltar para PENDENTE. Remarque-o para solicitar nova confirmação");
        }
        agendamento.setStatus(novoStatus);
        return AgendamentoResponse.fromEntity(agendamentoRepository.saveAndFlush(agendamento));
    }

    @Transactional
    public void excluir(UUID id) {
        agendamentoRepository.delete(buscarParaAlterar(id));
        agendamentoRepository.flush();
    }

    private Agendamento buscarParaAlterar(UUID id) {
        return agendamentoRepository.findByIdParaAlterar(id).orElseThrow(this::naoEncontrado);
    }

    private ResponseStatusException naoEncontrado() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Agendamento não encontrado");
    }

    private Servico buscarServico(UUID servicoId) {
        return servicoRepository.findById(servicoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Serviço não encontrado"));
    }

    private void exigirPodeAlterar(Agendamento agendamento, JWTUserData userData) {
        if (!isAdmin(userData) && !isCliente(agendamento, userData)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o cliente do agendamento pode alterá-lo");
        }
        if (!estaAtivo(agendamento)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Somente agendamentos pendentes ou confirmados podem ser alterados");
        }
    }

    /**
     * Bloqueia o prestador e depois o cliente até o fim da transação (sempre nessa ordem, evitando deadlock):
     * reservas simultâneas são processadas em fila e cada uma já enxerga o que a anterior gravou (RF08).
     */
    private void validarReserva(Servico servico, Usuario cliente, LocalDateTime dataHora, UUID ignorarAgendamentoId) {
        prestadorRepository.findByIdParaAgendar(servico.getPrestador().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Prestador não encontrado"));
        if (!Boolean.TRUE.equals(servico.getPrestador().getAtivo()) || !Boolean.TRUE.equals(servico.getAtivo())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Serviço indisponível para agendamento");
        }
        if (!dataHora.isAfter(LocalDateTime.now(clock))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Data e hora do agendamento devem estar no futuro");
        }
        if (!disponibilidadeService.horarioDisponivel(servico, dataHora, ignorarAgendamentoId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, HORARIO_INDISPONIVEL);
        }

        usuarioRepository.findByIdParaAgendar(cliente.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado"));
        boolean clienteOcupado = agendamentoRepository
                .findAtivosDoClienteNoPeriodo(cliente.getId(), dataHora, dataHora.plusMinutes(servico.getDuracaoMinutos()))
                .stream().anyMatch(outro -> !outro.getId().equals(ignorarAgendamentoId));
        if (clienteOcupado) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, CLIENTE_OCUPADO);
        }
    }

    private String normalizarObservacoes(String observacoes) {
        return observacoes == null || observacoes.isBlank() ? null : observacoes.strip();
    }

    private void exigirStatus(StatusAgendamento atual, StatusAgendamento novo, StatusAgendamento... permitidos) {
        for (StatusAgendamento permitido : permitidos) {
            if (atual == permitido) {
                return;
            }
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Não é possível alterar o status de " + atual + " para " + novo);
    }

    private boolean estaAtivo(Agendamento agendamento) {
        return agendamento.getStatus() == StatusAgendamento.PENDENTE
                || agendamento.getStatus() == StatusAgendamento.CONFIRMADO;
    }

    private boolean isAdmin(JWTUserData userData) {
        return TipoUsuario.ADMIN.name().equals(userData.tipo());
    }

    private boolean isCliente(Agendamento agendamento, JWTUserData userData) {
        return TipoUsuario.CLIENTE.name().equals(userData.tipo())
                && Objects.equals(agendamento.getCliente().getId(), userData.userId());
    }

    private boolean isPrestador(Agendamento agendamento, JWTUserData userData) {
        return TipoUsuario.PRESTADOR.name().equals(userData.tipo())
                && Objects.equals(agendamento.getServico().getPrestador().getUsuario().getId(), userData.userId());
    }
}
