package com.example.agenda.service;
 
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
 
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
 
import com.example.agenda.config.JWTUserData;
import com.example.agenda.dto.request.AvaliacaoRequest;
import com.example.agenda.dto.request.AvaliacaoUpdateRequest;
import com.example.agenda.dto.response.AvaliacaoResponse;
import com.example.agenda.dto.response.NotaMediaResponse;
import com.example.agenda.entity.Agendamento;
import com.example.agenda.entity.Avaliacao;
import com.example.agenda.entity.Prestador;
import com.example.agenda.entity.Servico;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.StatusAgendamento;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.AgendamentoRepository;
import com.example.agenda.repository.AvaliacaoRepository;
import com.example.agenda.repository.PrestadorRepository;
 
@ExtendWith(MockitoExtension.class)
class AvaliacaoServiceTest {
 
    @Mock
    private AvaliacaoRepository avaliacaoRepository;
    @Mock
    private AgendamentoRepository agendamentoRepository;
    @Mock
    private PrestadorRepository prestadorRepository;
 
    private AvaliacaoService avaliacaoService;
 
    private Usuario cliente;
    private Usuario outroCliente;
    private Usuario donoPrestador;
    private Usuario admin;
    private Prestador prestador;
    private Agendamento agendamento;
 
    @BeforeEach
    void preparar() {
        avaliacaoService = new AvaliacaoService(avaliacaoRepository, agendamentoRepository, prestadorRepository);
 
        cliente = usuario(TipoUsuario.CLIENTE);
        outroCliente = usuario(TipoUsuario.CLIENTE);
        donoPrestador = usuario(TipoUsuario.PRESTADOR);
        admin = usuario(TipoUsuario.ADMIN);
 
        prestador = new Prestador();
        prestador.setId(UUID.randomUUID());
        prestador.setUsuario(donoPrestador);
        prestador.setNomeNegocio("Barbearia Teste");
 
        Servico servico = new Servico();
        servico.setId(UUID.randomUUID());
        servico.setPrestador(prestador);
        servico.setNome("Corte de cabelo");
        servico.setDuracaoMinutos(60);
 
        agendamento = new Agendamento();
        agendamento.setId(UUID.randomUUID());
        agendamento.setCliente(cliente);
        agendamento.setServico(servico);
        agendamento.setDataHora(LocalDateTime.of(2025, 1, 6, 9, 0));
        agendamento.setStatus(StatusAgendamento.CONCLUIDO);
    }
 
    // ---------- helpers ----------
 
    private Usuario usuario(TipoUsuario tipo) {
        Usuario usuario = new Usuario();
        usuario.setId(UUID.randomUUID());
        usuario.setNome("Usuário " + tipo);
        usuario.setEmail(UUID.randomUUID() + "@teste.com");
        usuario.setTipo(tipo);
        return usuario;
    }
 
    private JWTUserData token(Usuario usuario) {
        return new JWTUserData(usuario.getId(), usuario.getEmail(), usuario.getNome(), usuario.getTipo().name());
    }
 
    private Avaliacao avaliacao(int nota) {
        Avaliacao avaliacao = new Avaliacao();
        avaliacao.setId(UUID.randomUUID());
        avaliacao.setAgendamento(agendamento);
        avaliacao.setNota(nota);
        avaliacao.setComentario("Comentário");
        return avaliacao;
    }
 
    private void agendamentoEncontrado() {
        when(agendamentoRepository.findByIdParaAlterar(agendamento.getId())).thenReturn(Optional.of(agendamento));
    }
 
    private void avaliacaoEncontrada(Avaliacao avaliacao) {
        when(avaliacaoRepository.findDetalhadoById(avaliacao.getId())).thenReturn(Optional.of(avaliacao));
    }
 
    // Simula o banco: devolve a própria entidade recebida, já com id
    private void salvarDevolveEntidade() {
        when(avaliacaoRepository.saveAndFlush(any(Avaliacao.class))).thenAnswer(invocacao -> {
            Avaliacao salva = invocacao.getArgument(0);
            if (salva.getId() == null) {
                salva.setId(UUID.randomUUID());
            }
            return salva;
        });
    }
 
    private void esperaErro(Runnable acao, HttpStatus status, String mensagem) {
        assertThatThrownBy(acao::run).isInstanceOfSatisfying(ResponseStatusException.class, erro -> {
            assertThat(erro.getStatusCode()).isEqualTo(status);
            assertThat(erro.getReason()).isEqualTo(mensagem);
        });
    }
 
    // ---------- criar (RF09) ----------
 
    @Test
    void criaAvaliacaoParaAgendamentoConcluido() {
        agendamentoEncontrado();
        when(avaliacaoRepository.existsByAgendamentoId(agendamento.getId())).thenReturn(false);
        salvarDevolveEntidade();
 
        AvaliacaoResponse response = avaliacaoService.criar(
                new AvaliacaoRequest(agendamento.getId(), 5, "  Ótimo atendimento  "), token(cliente));
 
        ArgumentCaptor<Avaliacao> captor = ArgumentCaptor.forClass(Avaliacao.class);
        verify(avaliacaoRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getAgendamento()).isSameAs(agendamento);
        assertThat(captor.getValue().getNota()).isEqualTo(5);
        assertThat(captor.getValue().getComentario()).isEqualTo("Ótimo atendimento");
 
        assertThat(response.id()).isNotNull();
        assertThat(response.agendamentoId()).isEqualTo(agendamento.getId());
        assertThat(response.clienteId()).isEqualTo(cliente.getId());
        assertThat(response.prestadorId()).isEqualTo(prestador.getId());
        assertThat(response.prestadorNome()).isEqualTo("Barbearia Teste");
        assertThat(response.servicoNome()).isEqualTo("Corte de cabelo");
    }
 
    @Test
    void comentarioEmBrancoViraNulo() {
        agendamentoEncontrado();
        when(avaliacaoRepository.existsByAgendamentoId(agendamento.getId())).thenReturn(false);
        salvarDevolveEntidade();
 
        AvaliacaoResponse response = avaliacaoService.criar(
                new AvaliacaoRequest(agendamento.getId(), 4, "   "), token(cliente));
 
        assertThat(response.comentario()).isNull();
    }
 
    @Test
    void agendamentoInexistenteRetorna404() {
        UUID inexistente = UUID.randomUUID();
        when(agendamentoRepository.findByIdParaAlterar(inexistente)).thenReturn(Optional.empty());
 
        esperaErro(() -> avaliacaoService.criar(new AvaliacaoRequest(inexistente, 5, null), token(cliente)),
                HttpStatus.NOT_FOUND, "Agendamento não encontrado");
        verify(avaliacaoRepository, never()).saveAndFlush(any());
    }
 
    @Test
    void outroClienteNaoPodeAvaliar() {
        agendamentoEncontrado();
 
        esperaErro(() -> avaliacaoService.criar(new AvaliacaoRequest(agendamento.getId(), 5, null),
                token(outroCliente)), HttpStatus.FORBIDDEN, "Somente o cliente do agendamento pode avaliá-lo");
        verify(avaliacaoRepository, never()).saveAndFlush(any());
    }
 
    @Test
    void prestadorNaoPodeAvaliarOProprioAtendimento() {
        agendamentoEncontrado();
 
        esperaErro(() -> avaliacaoService.criar(new AvaliacaoRequest(agendamento.getId(), 5, null),
                token(donoPrestador)), HttpStatus.FORBIDDEN, "Somente o cliente do agendamento pode avaliá-lo");
        verify(avaliacaoRepository, never()).saveAndFlush(any());
    }
 
    @ParameterizedTest
    @EnumSource(value = StatusAgendamento.class, names = "CONCLUIDO", mode = EnumSource.Mode.EXCLUDE)
    void naoAvaliaAgendamentoQueNaoEstaConcluido(StatusAgendamento status) {
        agendamento.setStatus(status);
        agendamentoEncontrado();
 
        esperaErro(() -> avaliacaoService.criar(new AvaliacaoRequest(agendamento.getId(), 5, null),
                token(cliente)), HttpStatus.CONFLICT, "Somente agendamentos concluídos podem ser avaliados");
        verify(avaliacaoRepository, never()).saveAndFlush(any());
    }
 
    @Test
    void naoAvaliaOMesmoAgendamentoDuasVezes() {
        agendamentoEncontrado();
        when(avaliacaoRepository.existsByAgendamentoId(agendamento.getId())).thenReturn(true);
 
        esperaErro(() -> avaliacaoService.criar(new AvaliacaoRequest(agendamento.getId(), 5, null),
                token(cliente)), HttpStatus.CONFLICT, "Este agendamento já foi avaliado");
        verify(avaliacaoRepository, never()).saveAndFlush(any());
    }
 
    // ---------- listar ----------
 
    @Test
    void adminListaTodas() {
        List<Avaliacao> todas = List.of(avaliacao(5), avaliacao(3));
        when(avaliacaoRepository.findAllByOrderByDataAvaliacaoDesc()).thenReturn(todas);
 
        assertThat(avaliacaoService.listar(token(admin))).hasSize(2);
    }
 
    @Test
    void clienteListaSomenteAsSuas() {
        when(avaliacaoRepository.findByAgendamentoClienteIdOrderByDataAvaliacaoDesc(cliente.getId()))
                .thenReturn(List.of(avaliacao(5)));
 
        assertThat(avaliacaoService.listar(token(cliente))).singleElement()
                .satisfies(response -> assertThat(response.clienteId()).isEqualTo(cliente.getId()));
    }
 
    @Test
    void prestadorListaAsQueRecebeu() {
        when(prestadorRepository.findByUsuarioId(donoPrestador.getId())).thenReturn(Optional.of(prestador));
        when(avaliacaoRepository.findByAgendamentoServicoPrestadorIdOrderByDataAvaliacaoDesc(prestador.getId()))
                .thenReturn(List.of(avaliacao(4), avaliacao(2)));
 
        assertThat(avaliacaoService.listar(token(donoPrestador))).hasSize(2);
    }
 
    @Test
    void prestadorSemPerfilRecebeListaVazia() {
        when(prestadorRepository.findByUsuarioId(donoPrestador.getId())).thenReturn(Optional.empty());
 
        assertThat(avaliacaoService.listar(token(donoPrestador))).isEmpty();
        verify(avaliacaoRepository, never()).findByAgendamentoServicoPrestadorIdOrderByDataAvaliacaoDesc(any());
    }
 
    @Test
    void listarPorPrestadorInexistenteRetorna404() {
        UUID inexistente = UUID.randomUUID();
        when(prestadorRepository.existsById(inexistente)).thenReturn(false);
 
        esperaErro(() -> avaliacaoService.listarPorPrestador(inexistente),
                HttpStatus.NOT_FOUND, "Prestador não encontrado");
    }
 
    // ---------- buscar ----------
 
    @Test
    void autorPrestadorEAdminPodemVerAAvaliacao() {
        Avaliacao avaliacao = avaliacao(5);
        avaliacaoEncontrada(avaliacao);
 
        for (Usuario usuario : new Usuario[]{cliente, donoPrestador, admin}) {
            assertThat(avaliacaoService.buscar(avaliacao.getId(), token(usuario)).nota()).isEqualTo(5);
        }
    }
 
    @Test
    void outroClienteNaoPodeVerAAvaliacao() {
        Avaliacao avaliacao = avaliacao(5);
        avaliacaoEncontrada(avaliacao);
 
        esperaErro(() -> avaliacaoService.buscar(avaliacao.getId(), token(outroCliente)),
                HttpStatus.FORBIDDEN, "Sem permissão para acessar esta avaliação");
    }
 
    @Test
    void avaliacaoInexistenteRetorna404() {
        UUID inexistente = UUID.randomUUID();
        when(avaliacaoRepository.findDetalhadoById(inexistente)).thenReturn(Optional.empty());
 
        esperaErro(() -> avaliacaoService.buscar(inexistente, token(cliente)),
                HttpStatus.NOT_FOUND, "Avaliação não encontrada");
    }
 
    // ---------- nota média (RF10) ----------
 
    @Test
    void notaMediaArredondadaParaUmaCasaDecimal() {
        when(prestadorRepository.existsById(prestador.getId())).thenReturn(true);
        when(avaliacaoRepository.calcularMediaPorPrestador(prestador.getId())).thenReturn(13.0 / 3); // 4.333...
        when(avaliacaoRepository.countByAgendamentoServicoPrestadorId(prestador.getId())).thenReturn(3L);
 
        NotaMediaResponse response = avaliacaoService.notaMedia(prestador.getId());
 
        assertThat(response.prestadorId()).isEqualTo(prestador.getId());
        assertThat(response.notaMedia()).isEqualTo(4.3);
        assertThat(response.totalAvaliacoes()).isEqualTo(3);
    }
 
    @Test
    void notaMediaArredondaMeioParaCima() {
        when(prestadorRepository.existsById(prestador.getId())).thenReturn(true);
        when(avaliacaoRepository.calcularMediaPorPrestador(prestador.getId())).thenReturn(4.25);
        when(avaliacaoRepository.countByAgendamentoServicoPrestadorId(prestador.getId())).thenReturn(4L);
 
        assertThat(avaliacaoService.notaMedia(prestador.getId()).notaMedia()).isEqualTo(4.3);
    }
 
    @Test
    void prestadorSemAvaliacoesTemMediaNula() {
        when(prestadorRepository.existsById(prestador.getId())).thenReturn(true);
        when(avaliacaoRepository.calcularMediaPorPrestador(prestador.getId())).thenReturn(null);
        when(avaliacaoRepository.countByAgendamentoServicoPrestadorId(prestador.getId())).thenReturn(0L);
 
        NotaMediaResponse response = avaliacaoService.notaMedia(prestador.getId());
 
        assertThat(response.notaMedia()).isNull();
        assertThat(response.totalAvaliacoes()).isZero();
    }
 
    @Test
    void notaMediaDePrestadorInexistenteRetorna404() {
        UUID inexistente = UUID.randomUUID();
        when(prestadorRepository.existsById(inexistente)).thenReturn(false);
 
        esperaErro(() -> avaliacaoService.notaMedia(inexistente), HttpStatus.NOT_FOUND, "Prestador não encontrado");
        verify(avaliacaoRepository, never()).calcularMediaPorPrestador(any());
    }
 
    // ---------- atualizar ----------
 
    @Test
    void autorAtualizaNotaEComentario() {
        Avaliacao avaliacao = avaliacao(2);
        avaliacaoEncontrada(avaliacao);
        salvarDevolveEntidade();
 
        AvaliacaoResponse response = avaliacaoService.atualizar(avaliacao.getId(),
                new AvaliacaoUpdateRequest(4, " Melhorou "), token(cliente));
 
        assertThat(response.nota()).isEqualTo(4);
        assertThat(response.comentario()).isEqualTo("Melhorou");
        verify(avaliacaoRepository).saveAndFlush(avaliacao);
    }
 
    @Test
    void somenteOAutorPodeAtualizar() {
        Avaliacao avaliacao = avaliacao(2);
        avaliacaoEncontrada(avaliacao);
 
        for (Usuario usuario : new Usuario[]{outroCliente, donoPrestador, admin}) {
            esperaErro(() -> avaliacaoService.atualizar(avaliacao.getId(), new AvaliacaoUpdateRequest(5, null),
                    token(usuario)), HttpStatus.FORBIDDEN, "Somente o autor pode editar esta avaliação");
        }
        assertThat(avaliacao.getNota()).isEqualTo(2);
        verify(avaliacaoRepository, never()).saveAndFlush(any());
    }
 
    // ---------- excluir ----------
 
    @Test
    void autorExcluiAvaliacao() {
        Avaliacao avaliacao = avaliacao(5);
        avaliacaoEncontrada(avaliacao);
 
        avaliacaoService.excluir(avaliacao.getId(), token(cliente));
 
        verify(avaliacaoRepository).delete(avaliacao);
    }
 
    @Test
    void adminExcluiAvaliacao() {
        Avaliacao avaliacao = avaliacao(5);
        avaliacaoEncontrada(avaliacao);
 
        avaliacaoService.excluir(avaliacao.getId(), token(admin));
 
        verify(avaliacaoRepository).delete(avaliacao);
    }
 
    @Test
    void outroClienteEPrestadorNaoExcluem() {
        Avaliacao avaliacao = avaliacao(5);
        avaliacaoEncontrada(avaliacao);
 
        for (Usuario usuario : new Usuario[]{outroCliente, donoPrestador}) {
            esperaErro(() -> avaliacaoService.excluir(avaliacao.getId(), token(usuario)), HttpStatus.FORBIDDEN,
                    "Somente o autor ou um administrador pode excluir esta avaliação");
        }
        verify(avaliacaoRepository, never()).delete(any());
    }
}