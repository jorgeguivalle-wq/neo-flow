
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
kitsPrecos: {},

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

  const kits = Array.isArray(estado().kits)
    ? estado().kits
    : [];

  const estoque = Array.isArray(estado().estoqueArray)
    ? estado().estoqueArray
    : [];

  const titulo = elemento(
    "h4",
    "🎁 Kits cadastrados na Tralalá Pro"
  );

  area.appendChild(titulo);

  area.appendChild(aviso(
    "A Lalá utilizará os kits reais do sistema. " +
    "Informe o preço comercial autorizado e " +
    "libere somente os kits que deseja oferecer."
  ));

  if (!kits.length) {
    area.appendChild(aviso(
      "Nenhum kit cadastrado foi encontrado. " +
      "Cadastre um kit no Gerador de Kits " +
      "e aguarde a sincronização do Firebase."
    ));
    return;
  }

  if (!dados.kitsPrecos) dados.kitsPrecos = {};
  if (!Array.isArray(dados.kitsLiberados)) {
    dados.kitsLiberados = [];
  }

  const lista = elemento(
    "div",
    null,
    "tp-lala-kits-lista"
  );

  kits.forEach(kit => {
    const id = String(kit.id || "");
    if (!id) return;

    const card = elemento(
      "div",
      null,
      "tp-lala-kit-item"
    );

    const nome = elemento(
      "strong",
      kit.nome || "Kit sem nome"
    );

    const pecas = Array.isArray(kit.pecas)
      ? kit.pecas
      : [];

    const temas = Array.isArray(kit.temas)
      ? kit.temas
      : [];

    const detalhes = elemento(
      "small",
      `${pecas.length} peças cadastradas · ` +
      `${temas.length} temas vinculados`
    );

    // Calcula somente a referência dos itens.
    // Este NÃO é o preço comercial do pacote.
    let somaPecas = 0;

    pecas.forEach(nomePeca => {
      const item = estoque.find(
        p => p.nome === nomePeca
      );

      if (!item) return;

      const quantidade = Math.max(
        1,
        Number(kit.pecasQtd?.[nomePeca]) || 1
      );

      somaPecas +=
        (Number(item.preco) || 0) * quantidade;
    });

    const referencia = elemento(
      "small",
      "Referência das peças: " +
      somaPecas.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      }) +
      " — não é o preço de venda do kit"
    );

    const labelPreco = elemento(
      "label",
      "Preço oficial do kit (R$)"
    );

    const preco = elemento("input");
    preco.type = "number";
    preco.min = "0";
    preco.step = "0.01";
    preco.placeholder = "Ex.: 99.99";

    const precoSalvo = dados.kitsPrecos[id];

    preco.value =
      precoSalvo !== undefined &&
      precoSalvo !== null
        ? precoSalvo
        : "";

    const labelLiberado = elemento("label");
    const checkbox = elemento("input");

    checkbox.type = "checkbox";
    checkbox.checked =
      dados.kitsLiberados.includes(id);

    labelLiberado.append(
      checkbox,
      document.createTextNode(
        " Permitir que a Lalá ofereça este kit"
      )
    );

    const salvarKit = botao(
      "💾 Salvar configuração do kit",
      async () => {
        const valor = preco.value.trim();

        if (
          valor === "" ||
          !Number.isFinite(Number(valor)) ||
          Number(valor) <= 0
        ) {
          alert(
            "Informe um preço oficial maior que zero."
          );
          return;
        }

        if (checkbox.checked) {
          if (!dados.kitsLiberados.includes(id)) {
            dados.kitsLiberados.push(id);
          }
        } else {
          dados.kitsLiberados =
            dados.kitsLiberados.filter(
              salvo => salvo !== id
            );
        }

        dados.kitsPrecos[id] = Number(valor);

        await salvar();

        alert(
          "Configuração do kit registrada!"
        );
      }
    );

    card.append(
      nome,
      detalhes,
      referencia,
      labelPreco,
      preco,
      labelLiberado,
      salvarKit
    );

    lista.appendChild(card);
  });

  area.appendChild(lista);

criarPainelConferenciaKits(area);

  area.appendChild(aviso(
    "⚠️ Liberar um kit não significa que " +
    "suas peças estejam disponíveis em " +
    "qualquer data. A conferência de reservas " +
    "será uma operação separada."
  ));
}


/* ==========================================
   LALÁ - CONFERÊNCIA DE KIT E ESTOQUE
   Consulta administrativa, sem reserva automática
   ========================================== */

function conferirKitLala(idKit, dataFesta) {
  const state = estado();

  const kits = Array.isArray(state.kits)
    ? state.kits : [];

  const estoque = Array.isArray(state.estoqueArray)
    ? state.estoqueArray : [];

  const reservas = Array.isArray(state.reservas)
    ? state.reservas : [];

  const kit = kits.find(k => String(k.id) === String(idKit));

  if (!kit) {
    return {
      ok: false,
      titulo: "Kit não encontrado",
      itens: [],
      alertas: ["Esse kit não está no cadastro atual."]
    };
  }

  const normalizar = valor =>
    String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  // Junta peças e temas usados na montagem.
  const nomes = [
    ...new Set([
      ...(Array.isArray(kit.pecas) ? kit.pecas : []),
      ...(Array.isArray(kit.temas) ? kit.temas : [])
    ])
  ];

  const itens = [];
  const alertas = [];

  if (!nomes.length) {
    alertas.push(
      "Este kit não possui peças ou temas vinculados."
    );
  }

  nomes.forEach(nome => {
    const encontrados = estoque.filter(
      p => normalizar(p.nome) === normalizar(nome)
    );

    if (encontrados.length !== 1) {
      itens.push({
        nome,
        necessario: 1,
        quantidadeAtual: null,
        situacao: encontrados.length === 0
          ? "Não cadastrado"
          : "Cadastro duplicado"
      });

      alertas.push(
        encontrados.length === 0
          ? `Peça não encontrada: ${nome}`
          : `Nome duplicado no estoque: ${nome}`
      );
      return;
    }

    const peca = encontrados[0];

    const quantidadeInformada = Number(
      kit.pecasQtd?.[nome] ?? 1
    );

    const quantidadeValida =
      Number.isInteger(quantidadeInformada) &&
      quantidadeInformada > 0;

    const necessario = quantidadeValida
      ? quantidadeInformada : 1;

    const atual = Number(peca.quantidade);

    const atualValido =
      peca.quantidade !== "" &&
      peca.quantidade != null &&
      Number.isInteger(atual) &&
      atual >= 0;

    let situacao = "Conferir com a equipe";

    if (!quantidadeValida || !atualValido) {
      situacao = "Cadastro incompleto";
      alertas.push(
        `Revise a quantidade cadastrada de ${nome}.`
      );
    } else if (atual < necessario) {
      situacao = "Quantidade atual insuficiente";
      alertas.push(
        `${nome}: precisa de ${necessario}, ` +
        `mas o saldo atual é ${atual}.`
      );
    }

    itens.push({
      nome,
      necessario,
      quantidadeAtual: atualValido ? atual : null,
      situacao
    });
  });

  // Identifica reservas na data.
  // Não subtrai quantidades porque o app.js
  // já faz movimentação do estoque.
  const reservasNaData = dataFesta
    ? reservas.filter(r => r.data === dataFesta)
    : [];

  const nomesKit = new Set(nomes.map(normalizar));

  const conflitosPossiveis = reservasNaData.filter(r => {
    const pecasReservadas = Array.isArray(r.pecas)
      ? r.pecas : [];

    return pecasReservadas.some(
      nome => nomesKit.has(normalizar(nome))
    ) || nomesKit.has(normalizar(r.tema));
  });

  if (conflitosPossiveis.length) {
    alertas.push(
      `${conflitosPossiveis.length} reserva(s) ` +
      "na data utilizam peças ou temas deste kit."
    );
  }

  alertas.push(
    "A conferência por data ainda é preliminar. " +
    "O cadastro atual não garante controle " +
    "completo de retirada, devolução e reservas " +
    "simultâneas. A equipe deve confirmar."
  );

  return {
    ok: alertas.length === 1,
    titulo: kit.nome || "Kit sem nome",
    itens,
    reservasNaData: conflitosPossiveis.length,
    alertas,
    dataFesta
  };
}

function criarPainelConferenciaKits(area) {
  const kits = Array.isArray(estado().kits)
    ? estado().kits : [];

  const painel = elemento("div", null, "tp-publicacao-info");
  const titulo = elemento("h4", "🔎 Conferir disponibilidade");

  const descricao = elemento(
    "p",
    "Consulte os componentes e identifique possíveis " +
    "problemas antes de oferecer o kit."
  );

  const labelKit = elemento("label", "Kit");
  const select = elemento("select");

  const placeholder = elemento("option", "Escolha um kit...");
  placeholder.value = "";
  select.appendChild(placeholder);

  kits.forEach(kit => {
    const opcao = elemento(
      "option", kit.nome || "Kit sem nome"
    );
    opcao.value = String(kit.id || "");
    select.appendChild(opcao);
  });

  const labelData = elemento("label", "Data da festa");
  const data = elemento("input");
  data.type = "date";

  const resultado = elemento("div");
  resultado.style.marginTop = "15px";

  const conferir = botao("🔍 Conferir kit", () => {
    resultado.replaceChildren();

    if (!select.value || !data.value) {
      alert("Selecione o kit e a data da festa.");
      return;
    }

    const consulta = conferirKitLala(
      select.value, data.value
    );

    resultado.appendChild(
      elemento("h4", consulta.titulo)
    );

    consulta.itens.forEach(item => {
      const linha = elemento(
        "div", null, "tp-lala-kit-item"
      );

      linha.style.marginBottom = "9px";

      linha.append(
        elemento("strong", item.nome),
        elemento(
          "small",
          "Necessário: " + item.necessario
        ),
        elemento(
          "small",
          "Saldo atual cadastrado: " +
          (item.quantidadeAtual ?? "Não informado")
        ),
        elemento(
          "small",
          "Situação: " + item.situacao
        )
      );

      resultado.appendChild(linha);
    });

    consulta.alertas.forEach(texto => {
      const alerta = elemento(
        "p", "⚠️ " + texto,
        "tp-lala-alerta-humano"
      );

      resultado.appendChild(alerta);
    });

    resultado.appendChild(
      elemento(
        "strong",
        "Resultado: requer confirmação humana."
      )
    );
  });

  painel.append(
    titulo,
    descricao,
    labelKit,
    select,
    labelData,
    data,
    conferir,
    resultado
  );

  area.appendChild(painel);
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
