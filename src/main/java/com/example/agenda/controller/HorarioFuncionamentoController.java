package com.example.agenda.controller;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.agenda.config.JWTUserData;
import com.example.agenda.dto.request.HorarioFuncionamentoRequest;
import com.example.agenda.dto.response.HorarioFuncionamentoResponse;
import com.example.agenda.service.HorarioFuncionamentoService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/prestadores/{prestadorId}/horarios")
public class HorarioFuncionamentoController {

    private final HorarioFuncionamentoService horarioService;

    public HorarioFuncionamentoController(HorarioFuncionamentoService horarioService) {
        this.horarioService = horarioService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('PRESTADOR', 'ADMIN')")
    public ResponseEntity<HorarioFuncionamentoResponse> criar(@PathVariable UUID prestadorId,
            @Valid @RequestBody HorarioFuncionamentoRequest request,
            @AuthenticationPrincipal JWTUserData userData) {
        HorarioFuncionamentoResponse response = horarioService.criar(prestadorId, request, userData);
        return ResponseEntity.created(URI.create("/prestadores/" + prestadorId + "/horarios/" + response.id())).body(response);
    }

    @GetMapping
    public ResponseEntity<List<HorarioFuncionamentoResponse>> listar(@PathVariable UUID prestadorId) {
        return ResponseEntity.ok(horarioService.listar(prestadorId));
    }

    @GetMapping("/{horarioId}")
    public ResponseEntity<HorarioFuncionamentoResponse> buscar(@PathVariable UUID prestadorId,
            @PathVariable UUID horarioId) {
        return ResponseEntity.ok(horarioService.buscar(prestadorId, horarioId));
    }

    @PutMapping("/{horarioId}")
    @PreAuthorize("hasAnyRole('PRESTADOR', 'ADMIN')")
    public ResponseEntity<HorarioFuncionamentoResponse> atualizar(@PathVariable UUID prestadorId,
            @PathVariable UUID horarioId,
            @Valid @RequestBody HorarioFuncionamentoRequest request,
            @AuthenticationPrincipal JWTUserData userData) {
        return ResponseEntity.ok(horarioService.atualizar(prestadorId, horarioId, request, userData));
    }

    @DeleteMapping("/{horarioId}")
    @PreAuthorize("hasAnyRole('PRESTADOR', 'ADMIN')")
    public ResponseEntity<Void> excluir(@PathVariable UUID prestadorId, @PathVariable UUID horarioId,
            @AuthenticationPrincipal JWTUserData userData) {
        horarioService.excluir(prestadorId, horarioId, userData);
        return ResponseEntity.noContent().build();
    }
}
