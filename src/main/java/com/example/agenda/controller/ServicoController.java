package com.example.agenda.controller;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;
import com.example.agenda.dto.response.ServicoDetalheResponse;
import com.example.agenda.service.ServicoService;

@RestController
@RequestMapping("/servicos")
public class ServicoController {
    private final ServicoService servicos;
    public ServicoController(ServicoService servicos) { this.servicos = servicos; }

    @GetMapping
    public List<ServicoDetalheResponse> listar(@RequestParam(required = false) UUID categoriaId,
            @RequestParam(required = false) BigDecimal precoMin, @RequestParam(required = false) BigDecimal precoMax,
            @RequestParam(required = false) String nome) {
        return servicos.catalogo(categoriaId, precoMin, precoMax, nome);
    }
}
