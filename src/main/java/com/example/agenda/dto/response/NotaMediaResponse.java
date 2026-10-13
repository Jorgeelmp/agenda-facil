package com.example.agenda.dto.response;

import java.util.UUID;

public record NotaMediaResponse(UUID prestadorId, Double notaMedia, long totalAvaliacoes) {

}
