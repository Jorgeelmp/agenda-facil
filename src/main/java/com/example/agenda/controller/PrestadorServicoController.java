package com.example.agenda.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.agenda.dto.response.ServicoResponse;
import com.example.agenda.service.PrestadorServicoService;

@RestController
@RequestMapping("/prestadores/{prestadorId}/servicos")
public class PrestadorServicoController {

    private final PrestadorServicoService prestadorServicoService;

    public PrestadorServicoController(PrestadorServicoService prestadorServicoService) {
        this.prestadorServicoService = prestadorServicoService;
    }

    @GetMapping
    public ResponseEntity<List<ServicoResponse>> listar(@PathVariable UUID prestadorId) {
        return ResponseEntity.ok(prestadorServicoService.listarAtivos(prestadorId));
    }
}
