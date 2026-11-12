
/* ==========================================
   TRALALÁ PRO — LALÁ ATENDENTE
   Painel de treinamento e gerenciamento
   ========================================== */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const PERSONALIDADES = [
    ["carinhosa", "💗", "Carinhosa"],
    ["alegre", "🎉", "Alegre"],
    ["profissional", "💼", "Profissional"],
    ["direta", "🎯", "Direta"],
    ["divertida", "😂", "Divertida"],
    ["delicada", "🌷", "Delicada"],
    ["animada", "⚡", "Animada"],
    ["acolhedora", "🤗", "Acolhedora"],
    ["elegante", "✨", "Elegante"],
    ["criativa", "🎨", "Criativa"],
    ["paciente", "🕊️", "Paciente"],
    ["entusiasmada", "😍", "Entusiasmada"],
    ["objetiva", "📋", "Objetiva"],
    ["consultiva", "🧠", "Consultiva"],
    ["conclusiva", "✅", "Conclusiva"]
  ];

  const TITULOS = {
    regras: "📋 Regras",
    personalidade: "💗 Modo de atendimento",
    conhecimentos: "🧠 Conhecimentos",
    kits: "🎁 Gerador de Kits",
    objetivos: "🎯 Objetivos",
    fluxo: "🔀 Fluxo de conversa",
    humano: "🚨 Atendimento Humano",
    teste: "🧪 Testar Lalá",
    desempenho: "📊 Desempenho"
  };

  const TUTORIAL = [
    [
      "Bem-vinda à Lalá Atendente!",
      "Esta é a nova assistente da vitrine da Tralalá. " +
      "Você poderá definir o jeito de atender e " +
      "ensinar as informações comerciais."
    ],
    [
      "Regras e conhecimentos",
      "Escreva regras simples, como 'Não dar desconto'. " +
      "Cadastre horários, procedimentos e informações " +
      "da loja na área Conhecimentos."
    ],
    [
      "15 modos de atendimento",
      "Escolha a personalidade da Lalá. Carinhosa " +
      "usa linguagem acolhedora e mais emojis. " +
      "Profissional utiliza uma linguagem mais formal."
    ],
    [
      "Gerador de Kits e estoque",
      "A Lalá precisará consultar os kits, preços, " +
      "quantidades e reservas cadastrados. " +
      "Um item existente pode já estar alugado " +
      "na data solicitada."
    ],
    [
      "Atendimento Humano",
      "Clientes poderão solicitar uma pessoa. " +
      "Reclamações, dúvidas não resolvidas e " +
      "negociações especiais devem ser encaminhadas."
    ],
    [
      "Vitrine e publicação",
      "Treine a Lalá, teste as informações e " +
      "publique a configuração aprovada. " +
      "A vitrine pública e a integração com IA " +
      "precisam estar conectadas para atender clientes."
    ]
  ];

  const NOVO = () => ({
    regras: [],
    conhecimentos: [],
    personalidade: "carinhosa",
    intensidade: 65,
    kitsLiberados: [],
    objetivos: ["Gerar pedidos de orçamento"],
    fluxo: [
      "Perguntar o tema",
      "Perguntar a data",
      "Perguntar o local",
      "Perguntar se deseja Pegue e Monte ou montagem"
    ],
    humano: {
      ativo: true,
      mensagem: "Vou encaminhar você para nossa equipe.",
      whatsapp: ""
    },
    tutorialConcluido: false
  });

  let dados = NOVO();
  let publicado = null;
  let etapa = 0;
  let editorAtual = "";
  let painelAtual = "";
  let salvando = false;
  let uidAtual = null;

  const estado = () => window.State || {};
  const usuario = () => estado().usuarioUID;
  const banco = () => estado().db;

  function raiz() {
    const uid = usuario();
    if (!uid || !banco()) {
      throw new Error("Faça login primeiro.");
    }
    return banco().ref(
      "lalaAtendente/administracao/" + uid
    );
  }

  function elemento(tag, texto, classe) {
    const el = document.createElement(tag);
    if (texto != null) el.textContent = texto;
    if (classe) el.className = classe;
    return el;
  }

  function botao(texto, acao, classe = "btn btn-primary") {
    const b = elemento("button", texto, classe);
    b.type = "button";
    b.addEventListener("click", acao);
    return b;
  }

  function aviso(texto) {
    return elemento("p", texto, "tp-publicacao-info");
  }

  function campo(valor = "", placeholder = "") {
    const input = elemento("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = valor;
    return input;
  }

  function limpar(el) {
    el?.replaceChildren();
  }

  function mostrar(ids, ativo) {
    ids.forEach(id => {
      const el = $(id);
      if (el) el.hidden = id !== ativo;
    });
  }

  function mudou() {
    const status = $("tp-lala-status");
    if (status) {
      status.textContent = "● Alterações não publicadas";
      status.className = "tp-status";
    }
  }

  async function salvar() {
    if (salvando) return;
    salvando = true;
    try {
      await raiz().child("rascunho").set(dados);
      mudou();
    } catch (erro) {
      console.error(erro);
      alert("Erro ao salvar: " + erro.message);
    } finally {
      salvando = false;
    }
  }

  async function carregar() {
    try {
      const atual = usuario();
      if (!atual) return;
      const snap = await raiz().once("value");
      if (usuario() !== atual) return;

      const valor = snap.val() || {};
      dados = { ...NOVO(), ...(valor.rascunho || {}) };
      dados.humano = {
        ...NOVO().humano,
        ...(dados.humano || {}),
        ativo: true
      };
      publicado = valor.publicado || null;
      uidAtual = atual;

      const status = $("tp-lala-status");
      if (status) {
        status.textContent = publicado
          ? "● Treinamento publicado"
          : "● Treinamento em preparação";
        status.className = publicado
          ? "tp-status ativo"
          : "tp-status";
      }

      // Tutorial obrigatório no primeiro acesso.
      if (!dados.tutorialConcluido &&
          !sessionStorage.getItem("tp-lala-tutorial-aberto")) {
        sessionStorage.setItem(
          "tp-lala-tutorial-aberto", "1"
        );
        abrirPainel("tutorial");
      }
    } catch (erro) {
      console.error("Erro ao carregar treinamento:", erro);
    }
  }

  function abrirPrincipal() {
    $("tp-lala-menu").hidden = false;
    $("tp-lala-detalhes").hidden = true;
    painelAtual = "";
  }

  function abrirPainel(tipo) {
    painelAtual = tipo;
    $("tp-lala-menu").hidden = true;
    $("tp-lala-detalhes").hidden = false;

    mostrar([
      "tp-lala-cards-treinamento",
      "tp-lala-editor",
      "tp-lala-atendimentos",
      "tp-lala-publicacao",
      "tp-lala-tutorial"
    ], tipo === "treinamento"
      ? "tp-lala-cards-treinamento"
      : tipo === "atendimentos"
        ? "tp-lala-atendimentos"
        : tipo === "publicacao"
          ? "tp-lala-publicacao"
          : "tp-lala-tutorial");

    const titulos = {
      treinamento: "🎓 Central de Treinamento",
      atendimentos: "💬 Atendimentos",
      publicacao: "🚀 Publicação",
      tutorial: "📖 Tutorial da Lalá"
    };

    $("tp-lala-titulo").textContent = titulos[tipo] || "";
    $("tp-lala-descricao").textContent =
      "Configure e acompanhe sua assistente.";

    if (tipo === "tutorial") {
      etapa = 0;
      renderTutorial();
    }
    if (tipo === "publicacao") renderPublicacao();
    if (tipo === "atendimentos") renderAtendimentos();
  }

  function abrirEditor(tipo) {
    editorAtual = tipo;
    $("tp-lala-cards-treinamento").hidden = true;
    $("tp-lala-editor").hidden = false;
    $("tp-lala-editor-titulo").textContent = TITULOS[tipo];
    renderEditor();
  }

  function renderLista(chave, placeholder) {
    const area = $("tp-lala-editor-conteudo");
    limpar(area);

    const entrada = campo("", placeholder);
    const adicionar = botao("➕ Adicionar", async () => {
      const texto = entrada.value.trim();
      if (!texto) return;
      dados[chave] = [...dados[chave], texto];
      await salvar();
      renderLista(chave, placeholder);
    });

    area.append(entrada, adicionar);

    dados[chave].forEach((texto, indice) => {
      const linha = elemento("div", null, "tp-lala-regra");
      const conteudo = elemento("span", texto);
      const remover = botao("🗑️", async () => {
        dados[chave].splice(indice, 1);
        await salvar();
        renderLista(chave, placeholder);
      }, "btn btn-outline");

      linha.append(conteudo, remover);
      area.appendChild(linha);
    });
  }

  function renderPersonalidade() {
    const area = $("tp-lala-editor-conteudo");
    limpar(area);

    const grade = elemento("div", null, "tp-lala-personalidades");

    PERSONALIDADES.forEach(([id, emoji, nome]) => {
      const b = botao(emoji + " " + nome, async () => {
        dados.personalidade = id;
        await salvar();
        renderPersonalidade();
      }, "tp-lala-personalidade");

      b.classList.toggle("ativo", dados.personalidade === id);
      b.setAttribute(
        "aria-pressed",
        String(dados.personalidade === id)
      );
      grade.appendChild(b);
    });

    const intensidade = elemento("input");
    intensidade.type = "range";
    intensidade.min = "0";
    intensidade.max = "100";
    intensidade.value = dados.intensidade;

    const indicador = elemento(
      "p", "Intensidade: " + dados.intensidade + "%"
    );

    intensidade.addEventListener("input", () => {
      indicador.textContent =
        "Intensidade: " + intensidade.value + "%";
    });

    intensidade.addEventListener("change", async () => {
      dados.intensidade = Number(intensidade.value);
      await salvar();
    });

    area.append(grade, indicador, intensidade);
    area.appendChild(aviso(
      "O estilo só será aplicado às respostas " +
      "quando o mecanismo de IA estiver integrado."
    ));
  }

  function renderKits() {
    const area = $("tp-lala-editor-conteudo");
    limpar(area);

    const estoque = Array.isArray(estado().estoqueArray)
      ? estado().estoqueArray
      : [];

    area.appendChild(aviso(
      "Itens cadastrados: " + estoque.length +
      ". A existência no estoque não garante " +
      "disponibilidade na data da festa."
    ));

    if (!estoque.length) {
      area.appendChild(aviso(
        "Nenhum item carregado. Confira o estoque " +
        "e aguarde a sincronização do Firebase."
      ));
      return;
    }

    const pesquisa = campo("", "Pesquisar peça ou tema...");
    const resultados = elemento("div");
    area.append(pesquisa, resultados);

    function listar() {
      limpar(resultados);
      const termo = pesquisa.value.toLowerCase();
      estoque
        .filter(item =>
          String(item.nome || "")
            .toLowerCase().includes(termo)
        )
        .slice(0, 60)
        .forEach(item => {
          const linha = elemento(
            "div", null, "tp-lala-kit-item"
          );

          linha.append(
            elemento("strong", item.nome || "Sem nome"),
            elemento("small",
              "Categoria: " + (item.categoria || "Não informada")
            ),
            elemento("small",
              "Quantidade cadastrada: " +
              (Number(item.quantidade) || 0)
            ),
            elemento("small",
              "Preço cadastrado: " +
              Number(item.preco || 0).toLocaleString(
                "pt-BR", {
                  style: "currency",
                  currency: "BRL"
                }
              )
            )
          );
          resultados.appendChild(linha);
        });
    }

    pesquisa.addEventListener("input", listar);
    listar();
  }

  function renderHumano() {
    const area = $("tp-lala-editor-conteudo");
    limpar(area);

    area.appendChild(aviso(
      "🚨 A transferência humana é obrigatória. " +
      "O cliente sempre poderá pedir uma pessoa."
    ));

    const whatsapp = campo(
      dados.humano.whatsapp,
      "WhatsApp da equipe com DDD"
    );

    const mensagem = campo(
      dados.humano.mensagem,
      "Mensagem de transferência"
    );

    const salvarBtn = botao("💾 Salvar configuração", async () => {
      dados.humano = {
        ativo: true,
        whatsapp: whatsapp.value.trim(),
        mensagem: mensagem.value.trim()
      };
      await salvar();
      alert("Configuração salva!");
    });

    area.append(
      elemento("label", "WhatsApp da equipe"),
      whatsapp,
      elemento("label", "Mensagem de transferência"),
      mensagem,
      salvarBtn
    );
  }

  function renderEditor() {
    if (editorAtual === "regras") {
      renderLista("regras", "Ex.: Não oferecer desconto");
    } else if (editorAtual === "conhecimentos") {
      renderLista(
        "conhecimentos",
        "Ex.: Retirada sexta e devolução segunda"
      );
    } else if (editorAtual === "personalidade") {
      renderPersonalidade();
    } else if (editorAtual === "kits") {
      renderKits();
    } else if (editorAtual === "humano") {
      renderHumano();
    } else if (editorAtual === "objetivos") {
      renderLista("objetivos", "Ex.: Gerar orçamentos");
    } else if (editorAtual === "fluxo") {
      renderLista(
        "fluxo",
        "Ex.: Perguntar a data da festa"
      );
    } else if (editorAtual === "teste") {
      renderTeste();
    } else {
      renderDesempenho();
    }
  }

  function renderTeste() {
    const area = $("tp-lala-editor-conteudo");
    limpar(area);

    area.appendChild(aviso(
      "Prévia das configurações. Este teste " +
      "não conversa com uma IA real."
    ));

    const texto = campo(
      "", "Digite uma pergunta de cliente"
    );
    const resposta = elemento(
      "div", null, "tp-lala-previa"
    );

    const testar = botao("🧪 Simular", () => {
      const pergunta = texto.value.trim();
      if (!pergunta) return;
      const nome = PERSONALIDADES.find(
        p => p[0] === dados.personalidade
      )?.[2] || "Carinhosa";

      resposta.textContent =
        "Pergunta: " + pergunta +
        "\nPersonalidade configurada: " + nome +
        "\nRegras ativas: " + dados.regras.length +
        "\nConhecimentos: " + dados.conhecimentos.length +
        "\nPróxima etapa: conectar o mecanismo de IA.";
    });

    resposta.style.whiteSpace = "pre-line";
    area.append(texto, testar, resposta);
  }

  function renderDesempenho() {
    const area = $("tp-lala-editor-conteudo");
    limpar(area);
    area.appendChild(aviso(
      "📊 O desempenho aparecerá depois que " +
      "a vitrine pública registrar atendimentos reais."
    ));
  }

  function renderTutorial() {
    const [titulo, texto] = TUTORIAL[etapa];

    $("tp-lala-tutorial-etapa").textContent =
      `Etapa ${etapa + 1} de ${TUTORIAL.length}`;

    $("tp-lala-tutorial-titulo").textContent = titulo;
    $("tp-lala-tutorial-texto").textContent = texto;

    $("tp-tutorial-anterior").disabled = etapa === 0;
    $("tp-tutorial-proximo").textContent =
      etapa === TUTORIAL.length - 1
        ? "✅ Concluir tutorial"
        : "Próximo →";
  }

  async function renderPublicacao() {
    const area = $("tp-lala-publicacao");

    area.querySelector(".tp-publicacao-info")?.remove();
    area.prepend(aviso(
      "A publicação abaixo salva a versão aprovada " +
      "das configurações. Ainda não ativa uma IA " +
      "nem publica um site externo."
    ));
  }

  async function publicar() {
    if (!dados.tutorialConcluido) {
      alert("Conclua o tutorial primeiro.");
      abrirPainel("tutorial");
      return;
    }

    if (!confirm(
      "Publicar esta versão das configurações?"
    )) return;

    try {
      const versao = {
        ...dados,
        humano: { ...dados.humano, ativo: true },
        publicadoEm: Date.now()
      };

      await raiz().child("publicado").set(versao);
      publicado = versao;

      $("tp-lala-status").textContent =
        "● Treinamento publicado";
      $("tp-lala-status").className = "tp-status ativo";

      alert("Configurações publicadas no Firebase!");
    } catch (erro) {
      alert("Erro ao publicar: " + erro.message);
    }
  }

  async function restaurar() {
    if (!publicado) {
      alert("Ainda não há uma versão publicada.");
      return;
    }
    if (!confirm(
      "Restaurar o rascunho para a versão publicada?"
    )) return;

    dados = {
      ...NOVO(),
      ...publicado,
      humano: {
        ...NOVO().humano,
        ...(publicado.humano || {}),
        ativo: true
      }
    };

    await salvar();
    alert("Rascunho restaurado!");
  }

  async function renderAtendimentos() {
    const fila = $("tp-lala-fila-atendimento");
    limpar(fila);

    fila.appendChild(aviso(
      "Fila de atendimento humano. A integração " +
      "com as conversas públicas será feita " +
      "na etapa da vitrine."
    ));
  }

  function abrirVitrine(tipo) {
    const detalhes = $("tp-vitrine-detalhes");
    detalhes.hidden = false;

    const titulos = {
      catalogo: "🎨 Catálogo público",
      atendente: "🌸 Lalá na Vitrine",
      visualizar: "👁️ Prévia",
      solicitacoes: "📨 Solicitações"
    };

    $("tp-vitrine-titulo").textContent =
      titulos[tipo] || "Vitrine";

    $("tp-vitrine-descricao").textContent =
      "Configurações da vitrine.";

    const area = $("tp-vitrine-conteudo");
    limpar(area);

    if (tipo === "catalogo") {
      const estoque = estado().estoqueArray || [];
      area.appendChild(aviso(
        "Itens do estoque carregados: " +
        estoque.length +
        ". A seleção pública de produtos será " +
        "conectada ao catálogo autorizado."
      ));
    } else if (tipo === "atendente") {
      area.appendChild(aviso(
        "Personalidade atual: " +
        (PERSONALIDADES.find(
          p => p[0] === dados.personalidade
        )?.[2] || "Carinhosa")
      ));
    } else if (tipo === "visualizar") {
      area.appendChild(aviso(
        "A prévia pública estará disponível " +
        "quando criarmos a página da vitrine."
      ));
    } else {
      area.appendChild(aviso(
        "As solicitações aparecerão depois " +
        "da integração com a vitrine pública."
      ));
    }
  }

  function eventos() {
    document.querySelectorAll("[data-lala-tela]")
      .forEach(b => b.addEventListener(
        "click",
        () => abrirPainel(b.dataset.lalaTela)
      ));

    document.querySelectorAll("[data-treino]")
      .forEach(b => b.addEventListener(
        "click",
        () => abrirEditor(b.dataset.treino)
      ));

    $("tp-lala-voltar")?.addEventListener(
      "click", abrirPrincipal
    );

    $("tp-lala-voltar-treinamento")
      ?.addEventListener("click", () => {
        $("tp-lala-editor").hidden = true;
        $("tp-lala-cards-treinamento").hidden = false;
      });

    $("tp-tutorial-anterior")
      ?.addEventListener("click", () => {
        etapa = Math.max(0, etapa - 1);
        renderTutorial();
      });

    $("tp-tutorial-proximo")
      ?.addEventListener("click", async () => {
        if (etapa < TUTORIAL.length - 1) {
          etapa++;
          renderTutorial();
        } else {
          dados.tutorialConcluido = true;
          await salvar();
          abrirPainel("treinamento");
        }
      });

    $("tp-lala-publicar")?.addEventListener(
      "click", publicar
    );

    $("tp-lala-restaurar")?.addEventListener(
      "click", restaurar
    );

    document.querySelectorAll("[data-vitrine]")
      .forEach(b => b.addEventListener(
        "click",
        () => abrirVitrine(b.dataset.vitrine)
      ));

    $("tp-vitrine-voltar")?.addEventListener(
      "click",
      () => $("tp-vitrine-detalhes").hidden = true
    );

    document.querySelectorAll(
      '[data-pagina="lala-atendente"]'
    ).forEach(b => b.addEventListener(
      "click", async () => {
        if (uidAtual !== usuario()) await carregar();
      }
    ));
  }

  function iniciar() {
    if (!$("tp-lala-atendente") || !$("tp-vitrine")) {
      console.warn("Páginas Lalá/Vitrine não encontradas.");
      return;
    }
    eventos();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  // A Lalá administrativa poderá chamar este comando.
  window.abrirTutorialLalaAtendente = async () => {
    if (uidAtual !== usuario()) await carregar();
    document.querySelector(
      '[data-pagina="lala-atendente"]'
    )?.click();
    abrirPainel("tutorial");
  };
})();
