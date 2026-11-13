
/* =====================================================
   TRALALÁ PRO — GERENCIADOR DA VITRINE
   Temas, modelos de kits, descrições e Pix
   ===================================================== */

(function () {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = () => window.State || {};

  function criar(tag, texto, classe) {
    const elemento = document.createElement(tag);

    if (texto !== undefined) {
      elemento.textContent = texto;
    }

    if (classe) {
      elemento.className = classe;
    }

    return elemento;
  }

  function criarInput(tipo, placeholder = "") {
    const input = criar("input");
    input.type = tipo;
    input.placeholder = placeholder;
    input.style.cssText =
      "width:100%;padding:12px;border:1px solid #ddd;" +
      "border-radius:10px;background:white;";

    return input;
  }

  function criarLabel(titulo, controle) {
    const label = criar("label");

    label.style.cssText =
      "display:grid;gap:7px;margin:15px 0;";

    label.append(
      criar("strong", titulo),
      controle
    );

    return label;
  }

  function criarBotao(titulo, callback) {
    const botao = criar("button", titulo);

    botao.type = "button";
    botao.className = "btn btn-primary";
    botao.style.margin = "10px 10px 10px 0";

    botao.addEventListener("click", callback);

    return botao;
  }

  function textoSeguro(valor, maximo = 150) {
    return String(valor || "").trim().slice(0, maximo);
  }

  function valorValido(valor) {
    return valor !== "" &&
      Number.isFinite(Number(valor)) &&
      Number(valor) > 0;
  }

  function obterBanco() {
    const s = state();

    if (!s.db || !s.usuarioUID) {
      throw new Error(
        "É necessário entrar na Tralalá Pro."
      );
    }

    return s.db;
  }

  function obterArea(titulo) {
    const area = $("tp-vitrine-conteudo");

    if (!area) {
      throw new Error(
        "Não encontrei tp-vitrine-conteudo no HTML."
      );
    }

    const tituloElemento = $("tp-vitrine-titulo");
    const descricao = $("tp-vitrine-descricao");

    if (tituloElemento) {
      tituloElemento.textContent = titulo;
    }

    if (descricao) {
      descricao.textContent = "";
    }

    area.hidden = false;
    area.replaceChildren();

    return area;
  }

  function aviso(texto) {
    const p = criar("p", texto);
    p.style.cssText =
      "padding:12px;background:#fff5f8;" +
      "border:1px solid #f0dce4;border-radius:10px;";

    return p;
  }

  /* =====================================
     ADICIONAR ITEM À VITRINE
     ===================================== */

  async function abrirCadastroTemas() {
    const area = obterArea(
      "🎨 Adicionar item à Vitrine"
    );

    area.append(
      aviso("Carregando temas e modelos de kits...")
    );

    try {
      const db = obterBanco();

      const [
        temasSnap,
        kitsSnap,
        estoqueSnap
      ] = await Promise.all([
        db.ref("vitrineCatalogo/temas").once("value"),
        db.ref("kits").once("value"),
        db.ref("estoque").once("value")
      ]);

      const temas = temasSnap.val() || {};
      const kits = kitsSnap.val() || {};
      const estoque = estoqueSnap.val() || {};

      area.replaceChildren();

      area.append(
        aviso(
          "Cadastre o tema que o cliente verá na " +
          "vitrine. Depois selecione os modelos de " +
          "kits e informe o preço de cada opção."
        )
      );

      const selecionarTema = criar("select");
      selecionarTema.style.cssText =
        "width:100%;padding:12px;border-radius:10px;";

      selecionarTema.append(
        new Option("+ Criar um tema novo", "")
      );

      Object.entries(temas).forEach(([id, tema]) => {
        if (!tema) return;

        selecionarTema.append(
          new Option(
            tema.nome || "Tema sem nome",
            id
          )
        );
      });

      const nome = criarInput(
        "text",
        "Ex.: Safari, Princesas, Fundo do Mar..."
      );
      nome.maxLength = 130;

      const descricao = criar("textarea");
      descricao.rows = 5;
      descricao.maxLength = 2000;
      descricao.placeholder =
        "Descreva o tema para os clientes. " +
        "Você pode falar das cores, decoração, " +
        "estilo da festa e outras informações.";

      descricao.style.cssText =
        "width:100%;padding:12px;border:1px solid #ddd;" +
        "border-radius:10px;resize:vertical;";

      const fotos = criar("select");
      fotos.style.cssText =
        "width:100%;padding:12px;border-radius:10px;";

      fotos.append(
        new Option("Sem foto por enquanto", "")
      );

      Object.entries(estoque).forEach(([id, item]) => {
        if (
          !item ||
          !item.nome ||
          typeof item.imagem !== "string" ||
          !item.imagem
        ) {
          return;
        }

        fotos.append(
          new Option(item.nome, id)
        );
      });

      const fotoPreview = criar("img");
      fotoPreview.alt = "Prévia da foto do tema";
      fotoPreview.style.cssText =
        "display:none;width:220px;max-width:100%;" +
        "height:180px;object-fit:contain;" +
        "border-radius:12px;margin:12px 0;";

      function atualizarFoto() {
        const item = estoque[fotos.value];

        const imagem = item?.imagem;

        if (
          typeof imagem === "string" &&
          /^data:image\/(jpeg|png|webp);base64,/.test(imagem) &&
          imagem.length < 180000
        ) {
          fotoPreview.src = imagem;
          fotoPreview.style.display = "block";
        } else {
          fotoPreview.removeAttribute("src");
          fotoPreview.style.display = "none";
        }
      }

      fotos.addEventListener(
        "change",
        atualizarFoto
      );

      const modelosContainer = criar("div");

      const camposModelos = new Map();

      function renderizarModelos(salvos = {}) {
        modelosContainer.replaceChildren();
        camposModelos.clear();

        modelosContainer.append(
          criar("h3", "🎁 Modelos de kits")
        );

        modelosContainer.append(
          criar(
            "p",
            "Marque os kits disponíveis para este tema " +
            "e defina o preço anunciado."
          )
        );

        const registros = Object.entries(kits);

        if (!registros.length) {
          modelosContainer.append(
            aviso(
              "Nenhum kit cadastrado. Cadastre os modelos " +
              "primeiro no Gerador de Kits."
            )
          );
        }

        registros.forEach(([id, kit]) => {
          if (!kit || typeof kit !== "object") return;

          const caixa = criar("div");
          caixa.style.cssText =
            "padding:15px;margin:12px 0;" +
            "border:1px solid #ead7df;" +
            "border-radius:12px;";

          const marcado = criarInput("checkbox");
          marcado.style.width = "auto";

          const nomeModelo =
            textoSeguro(kit.nome || "Kit", 100);

          marcado.checked =
            salvos[id] !== undefined &&
            salvos[id] !== null;

          const preco = criarInput(
            "number",
            "Ex.: 99.99"
          );

          preco.min = "0.01";
          preco.step = "0.01";

          preco.value =
            salvos[id]?.preco ?? "";

          caixa.append(
            criarLabel(
              "Oferecer " + nomeModelo,
              marcado
            ),
            criarLabel(
              "Preço desse modelo (R$)",
              preco
            )
          );

          camposModelos.set(id, {
            nome: nomeModelo,
            marcado,
            preco
          });

          modelosContainer.append(caixa);
        });
      }

      function preencherTema(id) {
        const tema = temas[id] || {};

        nome.value = tema.nome || "";
        descricao.value = tema.descricao || "";
        fotos.value = tema.imagemId || "";

        atualizarFoto();
        renderizarModelos(tema.modelos || {});
      }

      selecionarTema.addEventListener(
        "change",
        () => preencherTema(selecionarTema.value)
      );

      renderizarModelos();

      const publicar = criarBotao(
        "🌐 Salvar e publicar tema",
        async () => {
          const nomeFinal = textoSeguro(
            nome.value, 130
          );

          if (!nomeFinal) {
            alert("Informe o nome do tema.");
            return;
          }

          const modelosSelecionados = {};

          for (const [id, dados] of camposModelos) {
            if (!dados.marcado.checked) continue;

            if (!valorValido(dados.preco.value)) {
              alert(
                "Informe um preço válido para " +
                dados.nome
              );
              return;
            }

            modelosSelecionados[id] = {
              nome: dados.nome,
              preco: Number(dados.preco.value)
            };
          }

          if (!Object.keys(modelosSelecionados).length) {
            alert(
              "Selecione pelo menos um modelo de kit."
            );
            return;
          }

          const itemFoto = estoque[fotos.value];
          let imagem = "";

          if (
            typeof itemFoto?.imagem === "string" &&
            /^data:image\/(jpeg|png|webp);base64,/.test(
              itemFoto.imagem
            ) &&
            itemFoto.imagem.length < 180000
          ) {
            imagem = itemFoto.imagem;
          }

          if (!confirm(
            'Publicar "' + nomeFinal +
            '" na vitrine dos clientes?'
          )) return;

          publicar.disabled = true;

          try {
            const idExistente =
              selecionarTema.value;

            const ref = idExistente
              ? db.ref(
                  "vitrineCatalogo/temas/" +
                  idExistente
                )
              : db.ref(
                  "vitrineCatalogo/temas"
                ).push();

            const registro = {
              nome: nomeFinal,
              descricao: textoSeguro(
                descricao.value, 2000
              ),
              imagem,
              imagemId: fotos.value,
              modelos: modelosSelecionados,
              atualizadoEm:
                firebase.database.ServerValue.TIMESTAMP
            };

            await ref.set(registro);

            alert(
              "Tema publicado na vitrine com sucesso!"
            );

            await abrirCadastroTemas();

          } catch (erro) {
            alert(
              "Não foi possível publicar: " +
              erro.message
            );
          } finally {
            publicar.disabled = false;
          }
        }
      );

      const excluir = criarBotao(
        "🗑️ Retirar tema da vitrine",
        async () => {
          const id = selecionarTema.value;

          if (!id) {
            alert(
              "Escolha um tema já cadastrado."
            );
            return;
          }

          if (!confirm(
            "Retirar este tema da vitrine?"
          )) return;

          try {
            await db.ref(
              "vitrineCatalogo/temas/" + id
            ).remove();

            alert("Tema retirado!");
            await abrirCadastroTemas();

          } catch (erro) {
            alert(
              "Erro ao retirar tema: " +
              erro.message
            );
          }
        }
      );

      area.append(
        criarLabel(
          "Criar ou editar tema",
          selecionarTema
        ),
        criarLabel(
          "Nome do tema",
          nome
        ),
        criarLabel(
          "Descrição para o cliente",
          descricao
        ),
        criarLabel(
          "Foto do tema (acervo da loja)",
          fotos
        ),
        fotoPreview,
        modelosContainer,
        publicar,
        excluir
      );

      area.append(
        aviso(
          "⚠️ Publicar um tema não significa que " +
          "ele esteja disponível para todas as datas. " +
          "A equipe precisa confirmar a reserva."
        )
      );

    } catch (erro) {
      area.replaceChildren(
        aviso(
          "Não foi possível carregar o cadastro: " +
          erro.message
        )
      );
    }
  }

  /* =====================================
     CADASTRAR QR CODE PIX
     ===================================== */

  async function abrirPagamentos() {
    const area = obterArea(
      "💳 Pagamentos da Vitrine"
    );

    area.append(
      aviso("Carregando dados Pix...")
    );

    try {
      const db = obterBanco();

      // Área privada: o QR não é publicado aqui.
      const ref = db.ref(
        "configuracoes/vitrinePix"
      );

      const snap = await ref.once("value");

      const atual = snap.val() || {};

      area.replaceChildren();

      area.append(
        criar("h3", "📱 Adicionar QR Code Pix")
      );

      area.append(
        aviso(
          "Cadastre a chave Pix e a imagem do " +
          "QR Code oficial da loja. " +
          "Esses dados ficarão no painel interno " +
          "até criarmos um checkout seguro."
        )
      );

      const chave = criarInput(
        "text",
        "Digite a chave Pix da Tralalá"
      );

      chave.maxLength = 150;
      chave.value = atual.chave || "";

      const arquivo = criarInput("file");
      arquivo.accept =
        "image/png,image/jpeg,image/webp";

      const preview = criar("img");
      preview.alt = "QR Code Pix cadastrado";
      preview.style.cssText =
        "display:block;max-width:240px;" +
        "max-height:240px;object-fit:contain;" +
        "margin:15px 0;";

      if (atual.imagem) {
        preview.src = atual.imagem;
      }

      const salvar = criarBotao(
        "💾 Salvar QR Code Pix",
        async () => {
          salvar.disabled = true;

          try {
            let imagem = atual.imagem || "";

            const selecionado = arquivo.files[0];

            if (selecionado) {
              const formatos = [
                "image/png",
                "image/jpeg",
                "image/webp"
              ];

              if (
                !formatos.includes(
                  selecionado.type
                )
              ) {
                throw new Error(
                  "Escolha uma imagem PNG, JPG ou WEBP."
                );
              }

              if (selecionado.size > 100000) {
                throw new Error(
                  "A imagem deve ter no máximo 100 KB."
                );
              }

              imagem = await new Promise(
                (resolver, rejeitar) => {
                  const leitor = new FileReader();

                  leitor.onload = () =>
                    resolver(leitor.result);

                  leitor.onerror = () =>
                    rejeitar(
                      new Error(
                        "Erro ao ler a imagem."
                      )
                    );

                  leitor.readAsDataURL(
                    selecionado
                  );
                }
              );
            }

            if (!chave.value.trim() || !imagem) {
              throw new Error(
                "Informe a chave Pix e o QR Code."
              );
            }

            await ref.set({
              chave: textoSeguro(
                chave.value, 150
              ),
              imagem,
              atualizadoEm:
                firebase.database.ServerValue.TIMESTAMP
            });

            preview.src = imagem;

            alert(
              "Dados Pix salvos com sucesso!"
            );

          } catch (erro) {
            alert(
              "Erro ao salvar Pix: " +
              erro.message
            );
          } finally {
            salvar.disabled = false;
          }
        }
      );

      area.append(
        criarLabel("Chave Pix", chave),
        criarLabel(
          "Imagem do QR Code Pix",
          arquivo
        ),
        preview,
        salvar
      );

    } catch (erro) {
      area.replaceChildren(
        aviso(
          "Erro ao carregar pagamentos: " +
          erro.message
        )
      );
    }
  }

  /* =====================================
     CONECTAR AO PAINEL EXISTENTE
     ===================================== */

/* ==========================================
   PEDIDOS RECEBIDOS PELA VITRINE
   Painel exclusivo para funcionários
   ========================================== */

async function abrirPedidosVitrine() {
  const area = obterArea("📨 Pedidos da Vitrine");

  area.replaceChildren(
    aviso("Consultando solicitações dos clientes...")
  );

  try {
    const db = obterBanco();

    const snap = await db.ref("clientesVitrine")
      .once("value");

    const clientes = snap.val() || {};
    const pedidos = [];

    Object.entries(clientes).forEach(([uid, cliente]) => {
      if (!cliente || typeof cliente !== "object") {
        return;
      }

      const perfil = cliente.perfil || {};
      const solicitacoes = cliente.solicitacoes || {};

      Object.entries(solicitacoes).forEach(
        ([id, pedido]) => {
          if (!pedido || typeof pedido !== "object") {
            return;
          }

          pedidos.push({
            ...pedido,
            id,
            uid,
            nomeCliente: perfil.nome || "Cliente",
            emailCliente: perfil.email || "Não informado"
          });
        }
      );
    });

    pedidos.sort(
      (a, b) =>
        Number(b.criadoEm || 0) -
        Number(a.criadoEm || 0)
    );

    area.replaceChildren();

    const titulo = criar(
      "h3",
      "📋 Solicitações recebidas: " + pedidos.length
    );

    const atualizar = criarBotao(
      "🔄 Atualizar pedidos",
      abrirPedidosVitrine
    );

    area.append(titulo, atualizar);

    if (!pedidos.length) {
      area.append(
        aviso("Nenhum pedido recebido até agora.")
      );
      return;
    }

    const filtro = criar("select");
    
    filtro.style.cssText =
      "padding:12px;border:1px solid #ddd;" +
      "border-radius:10px;margin:15px 0;width:100%;";

    [
      ["todos", "Todas as solicitações"],
      ["atendimento", "💬 Pedidos de atendimento humano"],
      ["orcamento", "🎈 Pedidos de orçamento"],
      ["pendente", "⏳ Pendentes"],
      ["em-atendimento", "🙋 Em atendimento"],
      ["finalizado", "✅ Finalizados"]
    ].forEach(([valor, texto]) => {
      filtro.append(new Option(texto, valor));
    });

    area.append(
      criarLabel("Filtrar solicitações", filtro)
    );


    const lista = criar("div");
    area.append(lista);

    const statusPermitidos = new Set([
      "pendente",
      "em-atendimento",
      "finalizado"
    ]);

    function renderizar() {
      lista.replaceChildren();

      
const filtrados = pedidos.filter(p => {
  if (filtro.value === "todos") return true;

  if (
    filtro.value === "atendimento" ||
    filtro.value === "orcamento"
  ) {
    return p.tipo === filtro.value;
  }

  return p.status === filtro.value;
});

      filtrados.forEach(pedido => {
        const card = criar("article");

        card.style.cssText =
          "background:white;border:1px solid #ead9e0;" +
          "border-radius:14px;padding:18px;" +
          "margin:15px 0;";

        const status = statusPermitidos.has(
          pedido.status
        ) ? pedido.status : "pendente";

        const dataRegistro = Number(pedido.criadoEm)
          ? new Date(pedido.criadoEm)
              .toLocaleString("pt-BR")
          : "Data não informada";

        const dataFesta = pedido.dataFesta
          ? String(pedido.dataFesta)
              .split("-")
              .reverse()
              .join("/")
          : "Não informada";

        card.append(
          criar(
            "h4",
            pedido.tipo === "atendimento"
              ? "💬 Solicitação de atendimento"
              : "🎈 Pedido de orçamento"
          ),

          criar(
            "p",
            "👤 Cliente: " + pedido.nomeCliente
          ),

          criar(
            "p",
            "📧 E-mail: " + pedido.emailCliente
          ),

          criar(
            "p",
            "📅 Recebido em: " + dataRegistro
          ),

          criar(
            "p",
            "🎂 Data da festa: " + dataFesta
          ),

          criar(
            "p",
            "🏠 Modalidade: " +
            (pedido.modalidade || "Não informada")
          ),

          criar(
            "p",
            "📍 Região: " +
            (pedido.regiao || "Não informada")
          ),

          criar(
            "p",
            "📌 Status: " + status
          )
        );

        const itens = Array.isArray(pedido.itens)
          ? pedido.itens
          : [];

        if (itens.length) {
          card.append(
            criar("h4", "🛒 Itens solicitados")
          );

          itens.forEach(item => {
            card.append(
              criar(
                "p",
                "• " +
                String(item.quantidade || 1) +
                "x " +
                String(item.nome || "Item")
              )
            );
          });
        }

        if (pedido.mensagem) {
          card.append(
            criar("h4", "💬 Mensagem do cliente"),
            criar("p", pedido.mensagem)
          );
        }

        const seletor = criar("select");
        seletor.style.cssText =
          "padding:10px;border-radius:10px;" +
          "border:1px solid #ddd;max-width:100%;";

        [
          ["pendente", "⏳ Pendente"],
          ["em-atendimento", "🙋 Em atendimento"],
          ["finalizado", "✅ Finalizado"]
        ].forEach(([valor, texto]) => {
          seletor.append(new Option(texto, valor));
        });

        seletor.value = status;

        const salvarStatus = criarBotao(
          "💾 Atualizar status",
          async () => {
            const novoStatus = seletor.value;

            if (!statusPermitidos.has(novoStatus)) {
              return;
            }

            if (novoStatus === pedido.status) {
              alert("O pedido já está neste status.");
              return;
            }

            salvarStatus.disabled = true;

            try {
              await db.ref(
                "clientesVitrine/" +
                pedido.uid +
                "/solicitacoes/" +
                pedido.id
              ).update({
                status: novoStatus
              });

              pedido.status = novoStatus;

              alert("Status atualizado!");
              renderizar();

            } catch (erro) {
              alert(
                "Não foi possível atualizar: " +
                erro.message
              );
            } finally {
              salvarStatus.disabled = false;
            }
          }
        );

        card.append(
          criar("h4", "Alterar andamento"),
          seletor,
          salvarStatus
        );

// ======================================
// ASSUMIR ATENDIMENTO COM SEGURANÇA
// ======================================

if (pedido.status === "pendente") {

  const assumir = criarBotao(
    "🙋 Assumir atendimento",
    async () => {
      const usuario = state().usuarioUID;

      if (!usuario) {
        alert("Faça login novamente.");
        return;
      }

      assumir.disabled = true;

      try {
        const refPedido = db.ref(
          "clientesVitrine/" +
          pedido.uid +
          "/solicitacoes/" +
          pedido.id
        );

        const resultado = await refPedido.transaction(
          atual => {

            // Outra pessoa pode ter assumido antes.
            if (
              !atual ||
              atual.status !== "pendente"
            ) {
              return;
            }

            return {
              ...atual,
              status: "em-atendimento",
              responsavelUid: usuario,
              atualizadoEm:
                firebase.database.ServerValue.TIMESTAMP
            };
          }
        );

        if (!resultado.committed) {
          alert(
            "Este atendimento já foi assumido " +
            "ou alterado por outra pessoa."
          );
        } else {
          alert("Atendimento assumido com sucesso!");
        }

        await abrirPedidosVitrine();

      } catch (erro) {
        alert(
          "Erro ao assumir atendimento: " +
          erro.message
        );
      } finally {
        assumir.disabled = false;
      }
    }
  );

  card.append(assumir);
}

// ==========================================
// CONFERÊNCIA MANUAL DE PAGAMENTO PIX
// ==========================================

const areaPix = criar("div");

areaPix.style.cssText =
  "padding:14px;margin-top:15px;" +
  "border:1px solid #eedde4;" +
  "border-radius:12px;background:#fff9fb;";

const tituloPix = criar(
  "h4",
  "💳 Conferência de pagamento"
);

const situacaoPix = criar(
  "p",
  pedido.pagamentoConferido
    ? "✅ Pagamento registrado como conferido."
    : "⏳ Pagamento ainda não conferido."
);

const confirmarPix = criar("input");
confirmarPix.type = "checkbox";

const textoConfirmacao = criar("label");
textoConfirmacao.style.cssText =
  "display:flex;align-items:center;gap:8px;";

textoConfirmacao.append(
  confirmarPix,
  criar(
    "span",
    "Conferi o recebimento na conta bancária."
  )
);

const registrarPix = criarBotao(
  "💾 Registrar conferência",
  async () => {

    if (!confirmarPix.checked) {
      alert(
        "Confira o recebimento no banco " +
        "antes de registrar."
      );
      return;
    }

    if (!confirm(
      "Você realmente verificou o " +
      "crédito na conta bancária?"
    )) {
      return;
    }

    registrarPix.disabled = true;

    try {
      await db.ref(
        "clientesVitrine/" +
        pedido.uid +
        "/solicitacoes/" +
        pedido.id
      ).update({
        pagamentoConferido: true,
        pagamentoConferidoPor:
          state().usuarioUID,
        pagamentoConferidoEm:
          firebase.database.ServerValue.TIMESTAMP
      });

      pedido.pagamentoConferido = true;

      situacaoPix.textContent =
        "✅ Pagamento registrado como conferido.";

      alert("Conferência registrada!");

    } catch (erro) {
      alert(
        "Erro ao registrar: " +
        erro.message
      );
    } finally {
      registrarPix.disabled = false;
    }
  }
);

areaPix.append(
  tituloPix,
  situacaoPix,
  textoConfirmacao,
  registrarPix
);

card.append(areaPix);

// ==========================================
// CONSULTA DE KITS PARA RESERVA
// ==========================================

if (
  pedido.tipo === "orcamento" &&
  Array.isArray(pedido.itens) &&
  pedido.itens.length
) {

  const areaReserva = criar("div");

  areaReserva.style.cssText =
    "padding:14px;margin-top:15px;" +
    "border:1px solid #eedde4;" +
    "border-radius:12px;";

  areaReserva.append(
    criar("h4", "📦 Conferir disponibilidade"),
    criar(
      "p",
      "Consulta informativa. Não bloqueia " +
      "o estoque e não confirma a reserva."
    )
  );

  const kitsParaConferir = new Set();

  pedido.itens.forEach(item => {
    const partes = String(item.id || "")
      .split(":");

    if (
      partes[0] === "kits" &&
      partes[1]
    ) {
      kitsParaConferir.add(partes[1]);
    }

    if (
      partes[0] === "temas" &&
      partes[2]
    ) {
      kitsParaConferir.add(partes[2]);
    }
  });

  const resultadoReserva = criar("div");

  if (!kitsParaConferir.size) {
    areaReserva.append(
      criar(
        "p",
        "Este pedido não possui modelos de kits " +
        "identificáveis. Confira as peças manualmente."
      )
    );
  }

  kitsParaConferir.forEach(kitId => {

    const conferir = criarBotao(
      "🔎 Consultar kit",
      async () => {

        const integracao =
          window.TralalaLalaIntegracoes;

        if (!integracao?.conferirKit) {
          alert(
            "O verificador de kits não está carregado."
          );
          return;
        }

        if (!pedido.dataFesta) {
          alert("O pedido não possui data da festa.");
          return;
        }

        conferir.disabled = true;

        try {
          const resultado =
            await integracao.conferirKit(
              kitId,
              pedido.dataFesta
            );

          resultadoReserva.replaceChildren();

          resultadoReserva.append(
            criar(
              "h4",
              "Resultado: " + resultado.kit
            )
          );

          resultado.lines.forEach(peca => {
            resultadoReserva.append(
              criar(
                "p",
                peca.name +
                " — necessário: " +
                peca.needed +
                " — saldo: " +
                (peca.current ?? "desconhecido") +
                " — " + peca.status
              )
            );
          });

          resultadoReserva.append(
            criar(
              "p",
              "Reservas possivelmente relacionadas " +
              "na data: " + resultado.possible
            )
          );

          resultadoReserva.append(
            criar("p", resultado.limitations)
          );

        } catch (erro) {
          alert(
            "Erro na consulta: " + erro.message
          );
        } finally {
          conferir.disabled = false;
        }
      }
    );

    areaReserva.append(conferir);
  });

  areaReserva.append(resultadoReserva);
  card.append(areaReserva);
}

        lista.append(card);
      });
    }

    filtro.addEventListener("change", renderizar);

    renderizar();

  } catch (erro) {
    console.error("Erro nos pedidos da vitrine:", erro);

    area.replaceChildren(
      aviso(
        "Não foi possível carregar as solicitações. " +
        "Confira as permissões do Firebase. " +
        "Detalhes: " + erro.message
      )
    );
  }
}

  
function iniciar() {

  // 🎨 ADICIONAR ITEM À VITRINE
  document.querySelectorAll(
    '[data-vitrine="catalogo"]'
  ).forEach(botao => {
    botao.addEventListener("click", () => {
      setTimeout(abrirCadastroTemas, 100);
    });
  });

  // 💳 PAGAMENTOS / QR CODE PIX
  document.querySelectorAll(
    '[data-vitrine="pagamentos"]'
  ).forEach(botao => {
    botao.addEventListener("click", () => {
      setTimeout(abrirPagamentos, 100);
    });
  });

  // 📨 PEDIDOS RECEBIDOS
  document.querySelectorAll(
    '[data-vitrine="solicitacoes"]'
  ).forEach(botao => {
    botao.addEventListener("click", () => {
      setTimeout(abrirPedidosVitrine, 150);
    });
  });

 
    // FUNÇÕES DISPONÍVEIS PARA TESTES
    window.TralalaGerenciarVitrine = {
      abrirCadastroTemas,
      abrirPagamentos,
      abrirPedidosVitrine
    };
  }

  // INICIALIZAÇÃO DO GERENCIADOR
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      iniciar
    );
  } else {
    iniciar();
  }

})();
