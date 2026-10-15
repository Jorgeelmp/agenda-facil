package com.example.agenda.dto.response;

import java.util.UUID;
import com.example.agenda.entity.Categoria;

public record CategoriaResponse(UUID id, String nome, String descricao) {
    public static CategoriaResponse fromEntity(Categoria categoria) {
        return new CategoriaResponse(categoria.getId(), categoria.getNome(), categoria.getDescricao());
    }
}
