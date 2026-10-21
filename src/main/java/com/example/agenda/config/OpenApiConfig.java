package com.example.agenda.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

// Documentação da API (RNF08): http://localhost:8080/swagger-ui.html
// Para testar rotas protegidas: faça POST /auth/login, copie o token e clique em "Authorize".
@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearerAuth";

    @Bean
    public OpenAPI agendaFacilOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("AgendaFácil API")
                        .version("1.0")
                        .description("API REST de agendamento de serviços: usuários, prestadores, horários de funcionamento, "
                                + "serviços, categorias, agendamentos e avaliações."))
                .components(new Components().addSecuritySchemes(BEARER, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("Token retornado por POST /auth/login")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER));
    }
}
