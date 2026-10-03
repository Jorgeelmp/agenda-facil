package com.example.agenda.dto.response;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record DisponibilidadeResponse(UUID prestadorId, UUID servicoId, LocalDate data,
                                      int duracaoMinutos, List<LocalTime> horarios) {
}
