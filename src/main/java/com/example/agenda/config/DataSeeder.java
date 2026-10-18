package com.example.agenda.config;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.agenda.entity.Agendamento;
import com.example.agenda.entity.Avaliacao;
import com.example.agenda.entity.Categoria;
import com.example.agenda.entity.HorarioFuncionamento;
import com.example.agenda.entity.Prestador;
import com.example.agenda.entity.Servico;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.DiaSemana;
import com.example.agenda.entity.enums.StatusAgendamento;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.AgendamentoRepository;
import com.example.agenda.repository.AvaliacaoRepository;
import com.example.agenda.repository.CategoriaRepository;
import com.example.agenda.repository.HorarioFuncionamentoRepository;
import com.example.agenda.repository.PrestadorRepository;
import com.example.agenda.repository.ServicoRepository;
import com.example.agenda.repository.UsuarioRepository;

/**
 * Popula o banco com dados de demonstração na inicialização.
 * Roda uma única vez: se o primeiro prestador de seed já existir, não faz nada.
 * Desative com SEED_ENABLED=false.
 */
@Component
@Order(2)
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final String DOMINIO = "@seed.agendafacil.com";
    private static final String MARCADOR = "prestador1" + DOMINIO;

    private static final String[][] CATEGORIAS = {
            {"Cabelo", "Cortes, escovas, coloração e tratamentos capilares"},
            {"Barbearia", "Barba, bigode e cortes masculinos"},
            {"Unhas", "Manicure, pedicure e alongamento"},
            {"Estética", "Limpeza de pele, depilação e procedimentos faciais"},
            {"Massagem", "Massagens relaxantes e terapêuticas"},
            {"Maquiagem", "Maquiagem social, para eventos e noivas"},
            {"Sobrancelha", "Design, henna e micropigmentação"},
            {"Saúde", "Fisioterapia, nutrição e acompanhamento"},
            {"Fitness", "Personal trainer, pilates e funcional"},
            {"Pet", "Banho, tosa e cuidados para pets"},
            {"Tatuagem", "Tatuagens e piercings"},
            {"Bem-estar", "Terapias holísticas e relaxamento"},
    };

    // nome do serviço, categoria, duração (min), preço
    private static final Object[][] SERVICOS = {
            {"Corte feminino", "Cabelo", 60, "80.00"}, {"Escova", "Cabelo", 45, "50.00"},
            {"Coloração", "Cabelo", 60, "150.00"}, {"Hidratação", "Cabelo", 45, "70.00"},
            {"Corte masculino", "Barbearia", 30, "40.00"}, {"Barba completa", "Barbearia", 30, "35.00"},
            {"Corte + barba", "Barbearia", 60, "65.00"}, {"Pigmentação de barba", "Barbearia", 45, "55.00"},
            {"Manicure", "Unhas", 45, "35.00"}, {"Pedicure", "Unhas", 45, "40.00"},
            {"Alongamento em gel", "Unhas", 60, "120.00"}, {"Esmaltação em gel", "Unhas", 60, "70.00"},
            {"Limpeza de pele", "Estética", 60, "130.00"}, {"Depilação a cera", "Estética", 45, "60.00"},
            {"Peeling facial", "Estética", 60, "180.00"},
            {"Massagem relaxante", "Massagem", 60, "120.00"}, {"Drenagem linfática", "Massagem", 60, "110.00"},
            {"Quick massage", "Massagem", 30, "50.00"},
            {"Maquiagem social", "Maquiagem", 60, "150.00"}, {"Maquiagem para noiva", "Maquiagem", 60, "350.00"},
            {"Design de sobrancelha", "Sobrancelha", 30, "40.00"}, {"Henna", "Sobrancelha", 30, "45.00"},
            {"Consulta de fisioterapia", "Saúde", 60, "150.00"}, {"Consulta nutricional", "Saúde", 60, "180.00"},
            {"Aula de pilates", "Fitness", 60, "90.00"}, {"Personal trainer", "Fitness", 60, "100.00"},
            {"Banho pet porte pequeno", "Pet", 60, "60.00"}, {"Tosa higiênica", "Pet", 45, "50.00"},
            {"Tatuagem pequena", "Tatuagem", 60, "250.00"}, {"Piercing", "Tatuagem", 30, "120.00"},
            {"Reiki", "Bem-estar", 60, "100.00"}, {"Acupuntura", "Bem-estar", 60, "130.00"},
    };

    // nome do negócio, categorias principais
    private static final String[][] NEGOCIOS = {
            {"Studio Bella Hair", "Cabelo,Maquiagem"}, {"Barbearia Dom Bigode", "Barbearia"},
            {"Esmalteria Cor & Arte", "Unhas"}, {"Clínica Pele Viva", "Estética,Sobrancelha"},
            {"Espaço Zen Massagens", "Massagem,Bem-estar"}, {"Salão Glamour", "Cabelo,Unhas,Sobrancelha"},
            {"Barbearia Navalha de Ouro", "Barbearia"}, {"Make Up by Carol", "Maquiagem,Sobrancelha"},
            {"FisioVida", "Saúde,Massagem"}, {"Studio Pilates Equilíbrio", "Fitness"},
            {"PetLove Banho e Tosa", "Pet"}, {"Tattoo Black Ink", "Tatuagem"},
            {"Nutri & Saúde", "Saúde"}, {"Espaço Harmonia", "Bem-estar,Massagem"},
            {"Beleza Pura", "Cabelo,Estética,Unhas"}, {"The Barber Club", "Barbearia"},
            {"Unhas de Diva", "Unhas,Sobrancelha"}, {"Personal Fit", "Fitness,Saúde"},
            {"Estética Renove", "Estética,Massagem"}, {"Cão Cheiroso", "Pet"},
            {"Studio Sobrancelha Perfeita", "Sobrancelha,Maquiagem"}, {"Corte Certo", "Barbearia,Cabelo"},
    };

    private static final String[] NOMES = {"Ana", "Bruno", "Carla", "Diego", "Eduarda", "Felipe", "Gabriela",
            "Henrique", "Isabela", "João", "Larissa", "Lucas", "Mariana", "Matheus", "Natália", "Otávio",
            "Paula", "Rafael", "Sabrina", "Thiago", "Vanessa", "Vinícius", "Amanda", "Gustavo", "Beatriz",
            "Leonardo", "Camila", "Pedro", "Juliana", "Rodrigo"};
    private static final String[] SOBRENOMES = {"Silva", "Souza", "Oliveira", "Santos", "Pereira", "Costa",
            "Rodrigues", "Almeida", "Nascimento", "Lima", "Araújo", "Fernandes", "Carvalho", "Gomes",
            "Martins", "Rocha", "Ribeiro", "Alves", "Monteiro", "Mendes"};
    private static final String[] RUAS = {"Rua das Flores", "Av. Centenário", "Rua Henrique Lage",
            "Rua Marechal Deodoro", "Av. Universitária", "Rua São José", "Rua XV de Novembro",
            "Av. Getúlio Vargas", "Rua Coronel Pedro Benedet", "Rua Seis de Janeiro"};
    private static final String[] COMENTARIOS_BONS = {"Atendimento excelente, super recomendo!",
            "Profissional muito atencioso e pontual.", "Ambiente limpo e agradável. Voltarei com certeza.",
            "Ficou perfeito, exatamente como eu queria!", "Melhor experiência que já tive, nota 10.",
            "Muito caprichoso, valeu cada centavo."};
    private static final String[] COMENTARIOS_MEDIOS = {"Bom serviço, mas atrasou um pouco.",
            "Gostei do resultado, porém achei o preço alto.", "Atendimento ok, nada de excepcional."};
    private static final String[] COMENTARIOS_RUINS = {"Demorou muito para me atender.",
            "Não ficou como combinado.", "Esperava mais pelo valor cobrado."};
    private static final String[] OBSERVACOES = {"Prefiro atendimento pontual.", "Primeira vez no local.",
            "Tenho alergia a alguns produtos, favor verificar.", "Chegarei 5 minutos antes.",
            "Gostaria de ver opções antes de começar."};

    private static final int[] SLOTS_SEMANA = {8, 9, 10, 11, 13, 14, 15, 16, 17};
    private static final int[] SLOTS_SABADO = {8, 9, 10, 11};

    private final UsuarioRepository usuarios;
    private final PrestadorRepository prestadores;
    private final HorarioFuncionamentoRepository horarios;
    private final CategoriaRepository categorias;
    private final ServicoRepository servicos;
    private final AgendamentoRepository agendamentos;
    private final AvaliacaoRepository avaliacoes;
    private final PasswordEncoder encoder;
    private final Clock clock;
    private final boolean habilitado;
    private final String senha;
    private final int quantidadeClientes;
    private final Random random = new Random(42);

    public DataSeeder(UsuarioRepository usuarios, PrestadorRepository prestadores,
            HorarioFuncionamentoRepository horarios, CategoriaRepository categorias, ServicoRepository servicos,
            AgendamentoRepository agendamentos, AvaliacaoRepository avaliacoes, PasswordEncoder encoder, Clock clock,
            @Value("${app.seed.enabled:true}") boolean habilitado,
            @Value("${app.seed.password:Senha@123}") String senha,
            @Value("${app.seed.clientes:80}") int quantidadeClientes) {
        this.usuarios = usuarios;
        this.prestadores = prestadores;
        this.horarios = horarios;
        this.categorias = categorias;
        this.servicos = servicos;
        this.agendamentos = agendamentos;
        this.avaliacoes = avaliacoes;
        this.encoder = encoder;
        this.clock = clock;
        this.habilitado = habilitado;
        this.senha = senha;
        this.quantidadeClientes = quantidadeClientes;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (!habilitado || usuarios.existsByEmail(MARCADOR)) return;

        // BCrypt é lento: gera o hash uma vez e reutiliza em todas as contas de seed
        String hash = encoder.encode(senha);

        Map<String, Categoria> cats = criarCategorias();
        List<Usuario> clientes = criarClientes(hash);
        List<Servico> todosServicos = new ArrayList<>();
        int totalAgendamentos = 0;
        int totalAvaliacoes = 0;

        for (int i = 0; i < NEGOCIOS.length; i++) {
            Prestador prestador = criarPrestador(i, hash);
            criarHorarios(prestador);
            List<Servico> servicosPrestador = criarServicos(prestador, NEGOCIOS[i][1].split(","), cats);
            todosServicos.addAll(servicosPrestador);
            if (!prestador.getAtivo()) continue;

            int[] criados = criarAgendamentos(servicosPrestador, clientes);
            totalAgendamentos += criados[0];
            totalAvaliacoes += criados[1];
        }

        log.info("Seed concluído: {} categorias, {} prestadores, {} clientes, {} serviços, {} agendamentos, {} avaliações (senha: {})",
                cats.size(), NEGOCIOS.length, clientes.size(), todosServicos.size(), totalAgendamentos,
                totalAvaliacoes, senha);
    }

    private Map<String, Categoria> criarCategorias() {
        Map<String, Categoria> existentes = new HashMap<>();
        for (Categoria c : categorias.findAll()) existentes.put(normalizar(c.getNome()), c);

        Map<String, Categoria> resultado = new HashMap<>();
        for (String[] dados : CATEGORIAS) {
            Categoria categoria = existentes.get(normalizar(dados[0]));
            if (categoria == null) {
                categoria = new Categoria();
                categoria.setNome(dados[0]);
                categoria.setDescricao(dados[1]);
                categoria = categorias.save(categoria);
            }
            resultado.put(dados[0], categoria);
        }
        return resultado;
    }

    private List<Usuario> criarClientes(String hash) {
        List<Usuario> lista = new ArrayList<>();
        for (int i = 1; i <= quantidadeClientes; i++) {
            lista.add(novoUsuario("cliente" + i + DOMINIO, hash, TipoUsuario.CLIENTE));
        }
        return usuarios.saveAll(lista);
    }

    private Prestador criarPrestador(int indice, String hash) {
        Usuario usuario = usuarios.save(novoUsuario("prestador" + (indice + 1) + DOMINIO, hash, TipoUsuario.PRESTADOR));

        Prestador prestador = new Prestador();
        prestador.setUsuario(usuario);
        prestador.setNomeNegocio(NEGOCIOS[indice][0]);
        prestador.setDescricao("Atendimento de qualidade em " + NEGOCIOS[indice][1].replace(",", ", ").toLowerCase(Locale.ROOT)
                + ". Agende seu horário!");
        prestador.setEndereco(sortear(RUAS) + ", " + (10 + random.nextInt(1990)) + " - Criciúma/SC");
        prestador.setTelefoneComercial(telefone());
        // alguns prestadores inativos para testar o painel
        prestador.setAtivo(indice % 10 != 9);
        return prestadores.save(prestador);
    }

    private void criarHorarios(Prestador prestador) {
        List<HorarioFuncionamento> lista = new ArrayList<>();
        for (DiaSemana dia : List.of(DiaSemana.SEG, DiaSemana.TER, DiaSemana.QUA, DiaSemana.QUI, DiaSemana.SEX)) {
            lista.add(horario(prestador, dia, LocalTime.of(8, 0), LocalTime.of(18, 0), LocalTime.of(12, 0), LocalTime.of(13, 0)));
        }
        lista.add(horario(prestador, DiaSemana.SAB, LocalTime.of(8, 0), LocalTime.of(12, 0), null, null));
        horarios.saveAll(lista);
    }

    private List<Servico> criarServicos(Prestador prestador, String[] nomesCategorias, Map<String, Categoria> cats) {
        List<Servico> lista = new ArrayList<>();
        for (String nomeCategoria : nomesCategorias) {
            for (Object[] dados : SERVICOS) {
                if (!dados[1].equals(nomeCategoria) || random.nextInt(10) < 2) continue;
                Servico servico = new Servico();
                servico.setPrestador(prestador);
                servico.setNome((String) dados[0]);
                servico.setDescricao(dados[0] + " realizado por profissionais experientes.");
                servico.setDuracaoMinutos((Integer) dados[2]);
                // varia o preço em até ±15% entre prestadores
                BigDecimal base = new BigDecimal((String) dados[3]);
                servico.setPreco(base.multiply(BigDecimal.valueOf(0.85 + random.nextInt(31) / 100.0))
                        .setScale(0, java.math.RoundingMode.HALF_UP).setScale(2));
                servico.setAtivo(random.nextInt(15) != 0);
                servico.getCategorias().add(cats.get(nomeCategoria));
                lista.add(servico);
            }
        }
        return servicos.saveAll(lista);
    }

    /** Cria agendamentos dos últimos 60 dias aos próximos 30, sem sobreposição no mesmo prestador. */
    private int[] criarAgendamentos(List<Servico> servicosPrestador, List<Usuario> clientes) {
        List<Servico> ativos = servicosPrestador.stream().filter(Servico::getAtivo).toList();
        if (ativos.isEmpty()) return new int[] {0, 0};

        LocalDateTime agora = LocalDateTime.now(clock);
        LocalDate hoje = agora.toLocalDate();
        List<Agendamento> lista = new ArrayList<>();

        for (LocalDate data = hoje.minusDays(60); !data.isAfter(hoje.plusDays(30)); data = data.plusDays(1)) {
            if (data.getDayOfWeek() == DayOfWeek.SUNDAY) continue;
            int[] slots = data.getDayOfWeek() == DayOfWeek.SATURDAY ? SLOTS_SABADO : SLOTS_SEMANA;
            for (int hora : slots) {
                if (random.nextInt(100) >= 35) continue;
                LocalDateTime dataHora = data.atTime(hora, 0);

                Agendamento agendamento = new Agendamento();
                agendamento.setCliente(clientes.get(random.nextInt(clientes.size())));
                agendamento.setServico(ativos.get(random.nextInt(ativos.size())));
                agendamento.setDataHora(dataHora);
                agendamento.setStatus(status(dataHora.isBefore(agora)));
                if (random.nextInt(4) == 0) agendamento.setObservacoes(sortear(OBSERVACOES));
                lista.add(agendamento);
            }
        }
        lista = agendamentos.saveAll(lista);

        List<Avaliacao> notas = new ArrayList<>();
        for (Agendamento agendamento : lista) {
            if (agendamento.getStatus() != StatusAgendamento.CONCLUIDO || random.nextInt(10) >= 7) continue;
            int nota = nota();
            Avaliacao avaliacao = new Avaliacao();
            avaliacao.setAgendamento(agendamento);
            avaliacao.setNota(nota);
            if (random.nextInt(5) != 0) {
                avaliacao.setComentario(sortear(nota >= 4 ? COMENTARIOS_BONS : nota == 3 ? COMENTARIOS_MEDIOS : COMENTARIOS_RUINS));
            }
            notas.add(avaliacao);
        }
        avaliacoes.saveAll(notas);
        return new int[] {lista.size(), notas.size()};
    }

    private StatusAgendamento status(boolean passado) {
        int r = random.nextInt(100);
        if (passado) return r < 80 ? StatusAgendamento.CONCLUIDO : StatusAgendamento.CANCELADO;
        if (r < 45) return StatusAgendamento.PENDENTE;
        if (r < 90) return StatusAgendamento.CONFIRMADO;
        return StatusAgendamento.CANCELADO;
    }

    private int nota() {
        int r = random.nextInt(100);
        if (r < 50) return 5;
        if (r < 80) return 4;
        if (r < 92) return 3;
        if (r < 97) return 2;
        return 1;
    }

    private Usuario novoUsuario(String email, String hash, TipoUsuario tipo) {
        Usuario usuario = new Usuario();
        usuario.setNome(sortear(NOMES) + " " + sortear(SOBRENOMES) + " " + sortear(SOBRENOMES));
        usuario.setEmail(email);
        usuario.setSenha(hash);
        usuario.setTelefone(telefone());
        usuario.setTipo(tipo);
        return usuario;
    }

    private HorarioFuncionamento horario(Prestador prestador, DiaSemana dia, LocalTime inicio, LocalTime fim,
            LocalTime intervaloInicio, LocalTime intervaloFim) {
        HorarioFuncionamento horario = new HorarioFuncionamento();
        horario.setPrestador(prestador);
        horario.setDiaSemana(dia);
        horario.setHoraInicio(inicio);
        horario.setHoraFim(fim);
        horario.setIntervaloInicio(intervaloInicio);
        horario.setIntervaloFim(intervaloFim);
        return horario;
    }

    private String telefone() {
        return String.format("(48) 9%04d-%04d", random.nextInt(10000), random.nextInt(10000));
    }

    private String sortear(String[] opcoes) {
        return opcoes[random.nextInt(opcoes.length)];
    }

    private static String normalizar(String nome) {
        return nome.strip().toLowerCase(Locale.ROOT);
    }
}
