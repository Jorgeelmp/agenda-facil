package com.example.agenda.controller;
 
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
 
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.transaction.annotation.Transactional;
 
import com.example.agenda.config.TokenConfig;
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
import com.example.agenda.repository.ServicoRepository;
import com.example.agenda.repository.UsuarioRepository;
import com.jayway.jsonpath.JsonPath;
 
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AvaliacaoControllerTest {
 
    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private TokenConfig tokenConfig;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private PrestadorRepository prestadorRepository;
    @Autowired
    private ServicoRepository servicoRepository;
    @Autowired
    private AgendamentoRepository agendamentoRepository;
    @Autowired
    private AvaliacaoRepository avaliacaoRepository;
 
    private Usuario donoPrestador;
    private Usuario cliente;
    private Usuario outroCliente;
    private Usuario admin;
    private Prestador prestador;
    private Servico servico;
    private Agendamento concluido;
    private int horarios;
 
    @BeforeEach
    void preparar() {
        donoPrestador = usuario(TipoUsuario.PRESTADOR);
        cliente = usuario(TipoUsuario.CLIENTE);
        outroCliente = usuario(TipoUsuario.CLIENTE);
        admin = usuario(TipoUsuario.ADMIN);
 
        prestador = new Prestador();
        prestador.setUsuario(donoPrestador);
        prestador.setNomeNegocio("Negócio " + UUID.randomUUID());
        prestadorRepository.saveAndFlush(prestador);
 
        servico = new Servico();
        servico.setPrestador(prestador);
        servico.setNome("Corte de cabelo");
        servico.setDuracaoMinutos(60);
        servico.setPreco(new BigDecimal("50.00"));
        servicoRepository.saveAndFlush(servico);
 
        concluido = agendamento(cliente, StatusAgendamento.CONCLUIDO);
    }
 
    // ---------- helpers ----------
 
    private Usuario usuario(TipoUsuario tipo) {
        Usuario usuario = new Usuario();
        usuario.setNome("Usuário de teste");
        usuario.setEmail(UUID.randomUUID() + "@teste.com");
        usuario.setSenha("$2a$10$7EqJtq98hPqEX7fNZaFWoO5QG.8tME.vG8zE2hVQ2jJz0XQdZ7M.K");
        usuario.setTipo(tipo);
        return usuarioRepository.saveAndFlush(usuario);
    }
 
    // Cada agendamento em um horário diferente, no passado (já que vários estão concluídos)
    private Agendamento agendamento(Usuario dono, StatusAgendamento status) {
        Agendamento agendamento = new Agendamento();
        agendamento.setCliente(dono);
        agendamento.setServico(servico);
        agendamento.setDataHora(LocalDateTime.of(2025, 1, 6, 9, 0).plusHours(horarios++));
        agendamento.setStatus(status);
        return agendamentoRepository.saveAndFlush(agendamento);
    }
 
    private Avaliacao avaliacaoSalva(Agendamento agendamento, int nota) {
        Avaliacao avaliacao = new Avaliacao();
        avaliacao.setAgendamento(agendamento);
        avaliacao.setNota(nota);
        avaliacao.setComentario("Comentário de teste");
        return avaliacaoRepository.saveAndFlush(avaliacao);
    }
 
    private MockHttpServletRequestBuilder autenticado(MockHttpServletRequestBuilder request, Usuario usuario) {
        return request.header("Authorization", "Bearer " + tokenConfig.generateToken(usuario));
    }
 
    private String corpo(UUID agendamentoId, Object nota, String comentario) {
        return "{\"agendamentoId\":\"" + agendamentoId + "\",\"nota\":" + nota
                + (comentario == null ? "" : ",\"comentario\":\"" + comentario + "\"") + "}";
    }
 
    private ResultActions avaliar(Usuario usuario, Agendamento agendamento, Object nota) throws Exception {
        return mockMvc.perform(autenticado(post("/avaliacoes"), usuario)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(agendamento.getId(), nota, "Muito bom")));
    }
 
    // ---------- RF09: criar ----------
 
    @Test
    void clienteAvaliaAgendamentoConcluido() throws Exception {
        String body = avaliar(cliente, concluido, 5)
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/avaliacoes/")))
                .andExpect(jsonPath("$.agendamentoId").value(concluido.getId().toString()))
                .andExpect(jsonPath("$.clienteId").value(cliente.getId().toString()))
                .andExpect(jsonPath("$.prestadorId").value(prestador.getId().toString()))
                .andExpect(jsonPath("$.servicoNome").value("Corte de cabelo"))
                .andExpect(jsonPath("$.nota").value(5))
                .andExpect(jsonPath("$.comentario").value("Muito bom"))
                .andReturn().getResponse().getContentAsString();
 
        assertThat(avaliacaoRepository.existsById(UUID.fromString(JsonPath.read(body, "$.id")))).isTrue();
    }
 
    @Test
    void comentarioEOpcionalEEmBrancoViraNulo() throws Exception {
        mockMvc.perform(autenticado(post("/avaliacoes"), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(concluido.getId(), 4, "   ")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.comentario").value(nullValue()));
    }
 
    @Test
    void naoPermiteAvaliarAgendamentoQueNaoEstaConcluido() throws Exception {
        for (StatusAgendamento status : new StatusAgendamento[]{
                StatusAgendamento.PENDENTE, StatusAgendamento.CONFIRMADO, StatusAgendamento.CANCELADO}) {
            avaliar(cliente, agendamento(cliente, status), 5)
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.message").value("Somente agendamentos concluídos podem ser avaliados"));
        }
    }
 
    @Test
    void naoPermiteAvaliarOMesmoAgendamentoDuasVezes() throws Exception {
        avaliar(cliente, concluido, 5).andExpect(status().isCreated());
        avaliar(cliente, concluido, 1)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Este agendamento já foi avaliado"));
        assertThat(avaliacaoRepository.findByAgendamentoId(concluido.getId()))
                .hasValueSatisfying(avaliacao -> assertThat(avaliacao.getNota()).isEqualTo(5));
    }
 
    @Test
    void somenteOClienteDoAgendamentoPodeAvaliar() throws Exception {
        avaliar(outroCliente, concluido, 5)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Somente o cliente do agendamento pode avaliá-lo"));
        // Prestador e admin são barrados pelo @PreAuthorize
        avaliar(donoPrestador, concluido, 5).andExpect(status().isForbidden());
        avaliar(admin, concluido, 5).andExpect(status().isForbidden());
    }
 
    @Test
    void exigeAutenticacao() throws Exception {
        mockMvc.perform(post("/avaliacoes").contentType(MediaType.APPLICATION_JSON)
                .content(corpo(concluido.getId(), 5, null)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/avaliacoes")).andExpect(status().isUnauthorized());
    }
 
    @Test
    void agendamentoInexistenteRetorna404() throws Exception {
        mockMvc.perform(autenticado(post("/avaliacoes"), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(UUID.randomUUID(), 5, null)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Agendamento não encontrado"));
    }
 
    // ---------- RF12: validações ----------
 
    @Test
    void validaNotaEntreUmECinco() throws Exception {
        avaliar(cliente, concluido, 0).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value("Nota deve ser no mínimo 1"));
        avaliar(cliente, concluido, 6).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value("Nota deve ser no máximo 5"));
        avaliar(cliente, concluido, null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value("Nota obrigatória"));
        assertThat(avaliacaoRepository.existsByAgendamentoId(concluido.getId())).isFalse();
    }
 
    @Test
    void validaTamanhoDoComentario() throws Exception {
        mockMvc.perform(autenticado(post("/avaliacoes"), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(concluido.getId(), 5, "a".repeat(1001))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value("Comentário deve ter no máximo 1000 caracteres"));
    }
 
    // ---------- RF10: nota média ----------
 
    @Test
    void calculaNotaMediaDoPrestadorComUmaCasaDecimal() throws Exception {
        avaliacaoSalva(concluido, 5);
        avaliacaoSalva(agendamento(cliente, StatusAgendamento.CONCLUIDO), 4);
        avaliacaoSalva(agendamento(outroCliente, StatusAgendamento.CONCLUIDO), 4);
 
        mockMvc.perform(autenticado(get("/prestadores/" + prestador.getId() + "/avaliacoes/media"), outroCliente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prestadorId").value(prestador.getId().toString()))
                .andExpect(jsonPath("$.notaMedia").value(4.3))
                .andExpect(jsonPath("$.totalAvaliacoes").value(3));
    }
 
    @Test
    void prestadorSemAvaliacoesTemMediaNula() throws Exception {
        mockMvc.perform(autenticado(get("/prestadores/" + prestador.getId() + "/avaliacoes/media"), cliente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notaMedia").value(nullValue()))
                .andExpect(jsonPath("$.totalAvaliacoes").value(0));
    }
 
    @Test
    void mediaDePrestadorInexistenteRetorna404() throws Exception {
        mockMvc.perform(autenticado(get("/prestadores/" + UUID.randomUUID() + "/avaliacoes/media"), cliente))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Prestador não encontrado"));
    }
 
    // ---------- listagem e consulta ----------
 
    @Test
    void listaAvaliacoesDoPrestador() throws Exception {
        avaliacaoSalva(concluido, 5);
        avaliacaoSalva(agendamento(outroCliente, StatusAgendamento.CONCLUIDO), 3);
 
        mockMvc.perform(autenticado(get("/prestadores/" + prestador.getId() + "/avaliacoes"), cliente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }
 
    @Test
    void listagemDependeDoPerfil() throws Exception {
        avaliacaoSalva(concluido, 5);
        avaliacaoSalva(agendamento(outroCliente, StatusAgendamento.CONCLUIDO), 3);
 
        mockMvc.perform(autenticado(get("/avaliacoes"), cliente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].clienteId").value(cliente.getId().toString()));
        mockMvc.perform(autenticado(get("/avaliacoes"), donoPrestador))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }
 
    @Test
    void buscarPorIdRespeitaPermissoes() throws Exception {
        Avaliacao avaliacao = avaliacaoSalva(concluido, 5);
        String url = "/avaliacoes/" + avaliacao.getId();
 
        mockMvc.perform(autenticado(get(url), cliente)).andExpect(status().isOk())
                .andExpect(jsonPath("$.nota").value(5));
        mockMvc.perform(autenticado(get(url), donoPrestador)).andExpect(status().isOk());
        mockMvc.perform(autenticado(get(url), admin)).andExpect(status().isOk());
        mockMvc.perform(autenticado(get(url), outroCliente)).andExpect(status().isForbidden());
        mockMvc.perform(autenticado(get("/avaliacoes/" + UUID.randomUUID()), cliente))
                .andExpect(status().isNotFound());
    }
 
    // ---------- atualizar e excluir ----------
 
    @Test
    void autorAtualizaAvaliacao() throws Exception {
        Avaliacao avaliacao = avaliacaoSalva(concluido, 2);
 
        mockMvc.perform(autenticado(put("/avaliacoes/" + avaliacao.getId()), cliente)
                .contentType(MediaType.APPLICATION_JSON).content("{\"nota\":4,\"comentario\":\"Melhorou\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nota").value(4))
                .andExpect(jsonPath("$.comentario").value("Melhorou"));
 
        mockMvc.perform(autenticado(put("/avaliacoes/" + avaliacao.getId()), outroCliente)
                .contentType(MediaType.APPLICATION_JSON).content("{\"nota\":1}"))
                .andExpect(status().isForbidden());
    }
 
    @Test
    void autorOuAdminExcluemAvaliacao() throws Exception {
        Avaliacao doCliente = avaliacaoSalva(concluido, 5);
        Avaliacao outra = avaliacaoSalva(agendamento(outroCliente, StatusAgendamento.CONCLUIDO), 1);
 
        mockMvc.perform(autenticado(delete("/avaliacoes/" + doCliente.getId()), outroCliente))
                .andExpect(status().isForbidden());
        mockMvc.perform(autenticado(delete("/avaliacoes/" + doCliente.getId()), donoPrestador))
                .andExpect(status().isForbidden());
 
        mockMvc.perform(autenticado(delete("/avaliacoes/" + doCliente.getId()), cliente))
                .andExpect(status().isNoContent());
        mockMvc.perform(autenticado(delete("/avaliacoes/" + outra.getId()), admin))
                .andExpect(status().isNoContent());
 
        assertThat(avaliacaoRepository.existsById(doCliente.getId())).isFalse();
        assertThat(avaliacaoRepository.existsById(outra.getId())).isFalse();
    }
}
 
