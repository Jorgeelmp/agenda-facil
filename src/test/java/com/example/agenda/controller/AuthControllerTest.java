package com.example.agenda.controller;

import com.example.agenda.config.AuthConfig;
import com.example.agenda.config.SecurityConfig;
import com.example.agenda.config.SecurityFilter;
import com.example.agenda.config.TokenConfig;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.UsuarioRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {AuthController.class, TestController.class})
@Import({SecurityConfig.class, SecurityFilter.class, TokenConfig.class, AuthConfig.class, AuthControllerTest.SomentePrestadorController.class})
class AuthControllerTest {

    @RestController
    static class SomentePrestadorController {
        @GetMapping("/somente-prestador")
        @PreAuthorize("hasRole('PRESTADOR')")
        public String somentePrestador() {
            return "ok";
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockitoBean
    private UsuarioRepository usuarioRepository;

    private Usuario usuarioSalvo() {
        Usuario usuario = new Usuario();
        usuario.setId(UUID.randomUUID());
        usuario.setNome("Maria Silva");
        usuario.setEmail("maria@email.com");
        usuario.setSenha(passwordEncoder.encode("123456"));
        usuario.setTipo(TipoUsuario.CLIENTE);
        return usuario;
    }

    private String login(String email, String senha) throws Exception {
        String body = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"senha\":\"" + senha + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }

    @Test
    void registerCriaUsuarioComSenhaCriptografada() throws Exception {
        when(usuarioRepository.existsByEmail("joao@email.com")).thenReturn(false);

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"João","email":"joao@email.com","senha":"123456","telefone":"48999999999","tipo":"PRESTADOR"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nome").value("João"))
                .andExpect(jsonPath("$.email").value("joao@email.com"))
                .andExpect(jsonPath("$.tipo").value("PRESTADOR"));

        verify(usuarioRepository).save(org.mockito.ArgumentMatchers.argThat(u ->
                !u.getSenha().equals("123456") && passwordEncoder.matches("123456", u.getSenha())));
    }

    @Test
    void registerComEmailDuplicadoRetorna409() throws Exception {
        when(usuarioRepository.existsByEmail("maria@email.com")).thenReturn(true);

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Maria","email":"maria@email.com","senha":"123456","tipo":"CLIENTE"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Email já cadastrado"));

        verify(usuarioRepository, never()).save(any());
    }

    @Test
    void registerComoAdminRetorna400() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Hacker","email":"h@email.com","senha":"123456","tipo":"ADMIN"}
                                """))
                .andExpect(status().isBadRequest());

        verify(usuarioRepository, never()).save(any());
    }

    @Test
    void registerComDadosInvalidosRetorna400ComMensagens() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"\",\"email\":\"invalido\",\"senha\":\"1\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.length()").value(4));
    }

    @Test
    void loginRetornaTokenEOTokenDaAcessoARotaProtegida() throws Exception {
        Usuario usuario = usuarioSalvo();
        when(usuarioRepository.findUserByEmail("maria@email.com")).thenReturn(Optional.of(usuario));

        String token = login("maria@email.com", "123456");

        mockMvc.perform(get("/test").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().string("Testando segurança!"));

        mockMvc.perform(get("/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(usuario.getId().toString()))
                .andExpect(jsonPath("$.email").value("maria@email.com"))
                .andExpect(jsonPath("$.nome").value("Maria Silva"))
                .andExpect(jsonPath("$.tipo").value("CLIENTE"));
    }

    @Test
    void loginComSenhaErradaRetorna401() throws Exception {
        when(usuarioRepository.findUserByEmail("maria@email.com")).thenReturn(Optional.of(usuarioSalvo()));

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"maria@email.com\",\"senha\":\"errada\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Email ou senha inválidos"));
    }

    @Test
    void loginComEmailInexistenteRetorna401() throws Exception {
        when(usuarioRepository.findUserByEmail(anyString())).thenReturn(Optional.empty());

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"ninguem@email.com\",\"senha\":\"123456\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rotaProtegidaSemTokenOuComTokenInvalidoRetorna401() throws Exception {
        mockMvc.perform(get("/test"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/test").header("Authorization", "Bearer token.invalido.aqui"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void corsPermiteFrontReact() throws Exception {
        mockMvc.perform(options("/auth/login")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    @Test
    void autorizacaoPorTipoDeUsuario() throws Exception {
        Usuario cliente = usuarioSalvo();
        Usuario prestador = usuarioSalvo();
        prestador.setEmail("prestador@email.com");
        prestador.setTipo(TipoUsuario.PRESTADOR);
        when(usuarioRepository.findUserByEmail("maria@email.com")).thenReturn(Optional.of(cliente));
        when(usuarioRepository.findUserByEmail("prestador@email.com")).thenReturn(Optional.of(prestador));

        mockMvc.perform(get("/somente-prestador").header("Authorization", "Bearer " + login("maria@email.com", "123456")))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/somente-prestador").header("Authorization", "Bearer " + login("prestador@email.com", "123456")))
                .andExpect(status().isOk());
    }

    @Test
    void camposSomenteComEspacosSaoRecusados() throws Exception {
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"   \",\"senha\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }
}
