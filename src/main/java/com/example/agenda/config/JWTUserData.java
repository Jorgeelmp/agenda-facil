package com.example.agenda.config;

import lombok.Builder;

import java.util.UUID;

@Builder
public record JWTUserData(UUID userId, String email, String nome, String tipo) {
}
