package com.example.agenda.controller;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.agenda.config.JWTUserData;
import com.example.agenda.dto.request.AgendamentoRequest;
import com.example.agenda.dto.request.StatusAgendamentoRequest;
import com.example.agenda.dto.response.AgendamentoResponse;
import com.example.agenda.dto.response.DisponibilidadeResponse;
import com.example.agenda.entity.enums.StatusAgendamento;
import com.example.agenda.service.AgendamentoService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/agendamentos")
public class AgendamentoController {

    private final AgendamentoService agendamentoService;

    public AgendamentoController(AgendamentoService agendamentoService) {
        this.agendamentoService = agendamentoService;
    }

    @PostMapping
    @PreAuthorize("hasRole('CLIENTE')")
    public ResponseEntity<AgendamentoResponse> criar(@Valid @RequestBody AgendamentoRequest request,
            @AuthenticationPrincipal JWTUserData userData) {
        AgendamentoResponse response = agendamentoService.criar(request, userData);
        return ResponseEntity.created(URI.create("/agendamentos/" + response.id())).body(response);
    }

    @GetMapping
    public ResponseEntity<List<AgendamentoResponse>> listar(@RequestParam(required = false) StatusAgendamento status,
            @AuthenticationPrincipal JWTUserData userData) {
        return ResponseEntity.ok(agendamentoService.listar(status, userData));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AgendamentoResponse> buscar(@PathVariable UUID id,
            @AuthenticationPrincipal JWTUserData userData) {
        return ResponseEntity.ok(agendamentoService.buscar(id, userData));
    }

    @GetMapping("/{id}/disponibilidade")
    @PreAuthorize("hasAnyRole('CLIENTE', 'ADMIN')")
    public ResponseEntity<DisponibilidadeResponse> disponibilidadeParaRemarcar(@PathVariable UUID id,
            @RequestParam(required = false) UUID servicoId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate data,
            @AuthenticationPrincipal JWTUserData userData) {
        return ResponseEntity.ok(agendamentoService.disponibilidadeParaRemarcar(id, servicoId, data, userData));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('CLIENTE', 'ADMIN')")
    public ResponseEntity<AgendamentoResponse> atualizar(@PathVariable UUID id,
            @Valid @RequestBody AgendamentoRequest request,
            @AuthenticationPrincipal JWTUserData userData) {
        return ResponseEntity.ok(agendamentoService.atualizar(id, request, userData));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AgendamentoResponse> alterarStatus(@PathVariable UUID id,
            @Valid @RequestBody StatusAgendamentoRequest request,
            @AuthenticationPrincipal JWTUserData userData) {
        return ResponseEntity.ok(agendamentoService.alterarStatus(id, request.status(), userData));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) {
        agendamentoService.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
