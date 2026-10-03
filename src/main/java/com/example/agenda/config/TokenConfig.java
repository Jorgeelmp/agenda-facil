package com.example.agenda.config;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.example.agenda.entity.Usuario;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Component
public class TokenConfig {

    @Value("${api.security.token.secret}")
    private String secret;

    public String generateToken(Usuario usuario) {
        Algorithm algorithm = Algorithm.HMAC256(secret);
        return JWT.create()
                .withClaim("userId", usuario.getId().toString())
                .withClaim("nome", usuario.getNome())
                .withClaim("tipo", usuario.getTipo().name())
                .withSubject(usuario.getEmail())
                .withExpiresAt(Instant.now().plusSeconds(86400))
                .withIssuedAt(Instant.now())
                .sign(algorithm);
    }

    public Optional<JWTUserData> validateToken(String token) {
        try {
            Algorithm algorithm = Algorithm.HMAC256(secret);

            DecodedJWT decode = JWT.require(algorithm)
                    .build()
                    .verify(token);

            return Optional.of(JWTUserData.builder()
                    .email(decode.getSubject())
                    .userId(UUID.fromString(decode.getClaim("userId").asString()))
                    .nome(decode.getClaim("nome").asString())
                    .tipo(decode.getClaim("tipo").asString())
                    .build());

        } catch (JWTVerificationException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

}
