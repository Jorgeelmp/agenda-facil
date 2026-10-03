package com.example.agenda.dto.response;

import com.example.agenda.entity.Prestador;

import java.util.UUID;

public record PrestadorResponse(UUID id, UUID usuarioId, String nomeNegocio,
                                String descricao, String endereco, String telefoneComercial, Boolean ativo) {

    public static PrestadorResponse fromEntity(Prestador prestador) {
        return new PrestadorResponse(prestador.getId(), prestador.getUsuario().getId(),
                prestador.getNomeNegocio(), prestador.getDescricao(), prestador.getEndereco(),
                prestador.getTelefoneComercial(), prestador.getAtivo());
    }
}
