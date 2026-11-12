
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

  function iniciar() {
    document.querySelectorAll(
      '[data-vitrine="catalogo"]'
    ).forEach(botao => {
      botao.addEventListener(
        "click",
        () => setTimeout(
          abrirCadastroTemas, 100
        )
      );
    });

    document.querySelectorAll(
      '[data-vitrine="pagamentos"]'
    ).forEach(botao => {
      botao.addEventListener(
        "click",
        () => setTimeout(
          abrirPagamentos, 100
        )
      );
    });

    // Disponibiliza as funções para testes.
    window.TralalaGerenciarVitrine = {
      abrirCadastroTemas,
      abrirPagamentos
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded", iniciar
    );
  } else {
    iniciar();
  }

})();
