package com.example.agenda.controller;

import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.springframework.transaction.annotation.Transactional;
import com.example.agenda.config.TokenConfig;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.UsuarioRepository;
import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class UsuarioControllerTest {
    @Autowired MockMvc mvc;
    @Autowired UsuarioRepository usuarios;
    @Autowired TokenConfig tokens;
    Usuario admin, cliente, prestador;

    @BeforeEach
    void preparar() {
        admin = criar(TipoUsuario.ADMIN);
        cliente = criar(TipoUsuario.CLIENTE);
        prestador = criar(TipoUsuario.PRESTADOR);
    }

    @Test
    void exigeAutenticacao() throws Exception {
        mvc.perform(get("/usuarios")).andExpect(status().isUnauthorized());
        mvc.perform(get("/usuarios/resumo")).andExpect(status().isUnauthorized());
    }

    @Test
    void clientesEPrestadoresNaoAcessamDadosAdministrativos() throws Exception {
        for (Usuario user : new Usuario[]{cliente, prestador}) {
            mvc.perform(get("/usuarios").header("Authorization", "Bearer " + tokens.generateToken(user)))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/usuarios/resumo").header("Authorization", "Bearer " + tokens.generateToken(user)))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void adminListaTodosUsuariosSemSenhasOuPropriedadesDoUserDetails() throws Exception {
        String body = mvc.perform(get("/usuarios").header("Authorization", "Bearer " + tokens.generateToken(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(usuarios.count()))
                .andReturn().getResponse().getContentAsString();
        java.util.List<Map<String, Object>> lista = JsonPath.read(body, "$");
        assertThat(lista).anySatisfy(item -> assertThat(item.get("id")).isEqualTo(cliente.getId().toString()));
        assertThat(lista).allSatisfy(item -> assertThat(item).containsOnlyKeys("id", "nome", "email", "telefone", "tipo", "criadoEm"));
        assertThat(body).doesNotContain("hash-privado", "password", "senha", "authorities");
    }

    @Test
    void resumoRefleteAsContagensReaisDeTodosOsPerfis() throws Exception {
        mvc.perform(get("/usuarios/resumo").header("Authorization", "Bearer " + tokens.generateToken(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(usuarios.count()))
                .andExpect(jsonPath("$.clientes").value(usuarios.countByTipo(TipoUsuario.CLIENTE)))
                .andExpect(jsonPath("$.prestadores").value(usuarios.countByTipo(TipoUsuario.PRESTADOR)))
                .andExpect(jsonPath("$.administradores").value(usuarios.countByTipo(TipoUsuario.ADMIN)));
    }

    private Usuario criar(TipoUsuario tipo) {
        Usuario u = new Usuario();
        u.setNome("Usuário " + tipo); u.setEmail(UUID.randomUUID() + "@teste.com"); u.setSenha("hash-privado"); u.setTipo(tipo);
        return usuarios.saveAndFlush(u);
    }
}
