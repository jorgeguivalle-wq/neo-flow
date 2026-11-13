
/* VITRINE TRALALÁ — CLIENTES */
(() => {
  'use strict';

  const firebaseConfig = {
    apiKey: 'AIzaSyCS6ofyis160STTrjhFJZDCsqAIyh_Ghmc',
    authDomain: 'tralala-d8ce2.firebaseapp.com',
    databaseURL: 'https://tralala-d8ce2-default-rtdb.firebaseio.com/',
    projectId: 'tralala-d8ce2',
    storageBucket: 'tralala-d8ce2.appspot.com',
    messagingSenderId: '704078064009',
    appId: '1:704078064009:web:4d6ffc34c21b14322f9958'
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  const db = firebase.database();

  const $ = id => document.getElementById(id);

  const fmt = n => Number(n).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  function getCart() {
    try {
      const value = JSON.parse(
        sessionStorage.getItem('trl_carrinho') || '{}'
      );
      return value && typeof value === 'object' &&
        !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  let catalog = { kits: {}, itens: {}, temas: {} };
  let cart = getCart();
  let mode = 'login';
  let pendingAction = null;
  let filter = 'todos';

  function localToday() {
    const d = new Date();

    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function toast(msg) {
    const e = $('notificacao');
    e.textContent = msg;
    e.style.display = 'block';

    clearTimeout(toast.t);

    toast.t = setTimeout(() => {
      e.style.display = 'none';
    }, 3500);
  }

  function dialog(id, open = true) {
    const el = $(id);

    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }

  function el(tag, text, cls) {
    const e = document.createElement(tag);

    if (text !== undefined) {
      e.textContent = text;
    }

    if (cls) e.className = cls;

    return e;
  }

  function safeCat(raw) {
    const clean = { kits: {}, itens: {} };

    for (const type of ['kits', 'itens']) {
      for (const [id, p] of Object.entries(raw?.[type] || {})) {
        if (!p || typeof p !== 'object' ||
            typeof p.nome !== 'string') {
          continue;
        }

        clean[type][id] = {
          id,
          nome: p.nome.slice(0, 130),
          categoria: String(p.categoria || '').slice(0, 60),

          preco: Number.isFinite(Number(p.preco)) &&
            Number(p.preco) > 0
              ? Number(p.preco)
              : null,

          imagem:
            typeof p.imagem === 'string' &&
            /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/
              .test(p.imagem) &&
            p.imagem.length < 180000
              ? p.imagem
              : null
        };
      }
    }

    return clean;
  }

function prepararTemasPublicos(raw) {
  const temas = {};

  for (const [id, tema] of Object.entries(raw || {})) {
    if (!tema || typeof tema !== 'object' ||
        !tema.nome) continue;

    const modelos = {};

    for (const [modeloId, modelo] of
      Object.entries(tema.modelos || {})) {

      const valor = Number(modelo?.preco);

      if (!Number.isFinite(valor) || valor <= 0) continue;

      modelos[modeloId] = {
        nome: String(modelo.nome || 'Kit').slice(0, 100),
        preco: valor
      };
    }

    if (!Object.keys(modelos).length) continue;

    temas[id] = {
      id,
      nome: String(tema.nome).slice(0, 130),
      descricao: String(tema.descricao || '').slice(0, 2000),
      imagem: typeof tema.imagem === 'string' &&
        /^data:image\/(jpeg|png|webp);base64,/.test(tema.imagem) &&
        tema.imagem.length < 180000
          ? tema.imagem : '',
      modelos
    };
  }

  return temas;
}

  
function productByKey(key) {
  const partes = String(key).split(':');
  const tipo = partes[0];
  const id = partes[1];

  if (tipo === 'temas') {
    const modeloId = partes[2];
    const tema = catalog.temas?.[id];
    const modelo = tema?.modelos?.[modeloId];

    if (!tema || !modelo) return null;

    return {
      id: key,
      nome: tema.nome + ' — ' + modelo.nome,
      categoria: 'Tema com kit',
      preco: modelo.preco,
      imagem: tema.imagem,
      temaId: id,
      modeloId
    };
  }

  if (tipo === 'kits' || tipo === 'itens') {
    return catalog[tipo]?.[id] || null;
  }

  return null;
}


  function saveCart() {
    sessionStorage.setItem(
      'trl_carrinho',
      JSON.stringify(cart)
    );

    renderCart();
  }

  function add(key) {
    if (!productByKey(key)) {
      return toast('Item indisponível no catálogo.');
    }

    cart[key] = Math.min(20, (cart[key] || 0) + 1);
    saveCart();

    toast('Adicionado ao carrinho! 💗');
  }

let temaSelecionadoId = '';

function abrirEscolhaTema(id) {
  const tema = catalog.temas?.[id];

  if (!tema) {
    toast('Este tema não está mais disponível.');
    return;
  }

  temaSelecionadoId = id;

  $('tema-modal-titulo').textContent = tema.nome;
  $('tema-modal-descricao').textContent =
    tema.descricao || 'Escolha o modelo do kit.';

  const select = $('tema-modal-modelo');
  select.replaceChildren();

  for (const [modeloId, modelo] of
    Object.entries(tema.modelos)) {

    select.append(
      new Option(
        modelo.nome + ' — ' + fmt(modelo.preco),
        modeloId
      )
    );
  }

  function atualizarValor() {
    const modelo = tema.modelos[select.value];

    $('tema-modal-preco').textContent = modelo
      ? fmt(modelo.preco)
      : 'Escolha um modelo';
  }

  select.onchange = atualizarValor;
  atualizarValor();

  dialog('dialog-tema');
}

function adicionarTemaEscolhido() {
  const tema = catalog.temas?.[temaSelecionadoId];
  const modeloId = $('tema-modal-modelo').value;

  if (!tema || !tema.modelos?.[modeloId]) {
    toast('Selecione um modelo válido.');
    return;
  }

  const key = 'temas:' + temaSelecionadoId + ':' + modeloId;

  add(key);
  dialog('dialog-tema', false);
  dialog('dialog-carrinho');
}

function renderizarCardsTemas(grid, busca) {
  let encontrados = 0;

  for (const tema of Object.values(catalog.temas || {})) {
    const texto = (
      tema.nome + ' ' + tema.descricao
    ).toLocaleLowerCase('pt-BR');

    if (!texto.includes(busca)) continue;

    encontrados++;

    const card = el('article', undefined, 'produto');
    const foto = el('div', undefined, 'foto-produto');

    if (tema.imagem) {
      const img = el('img');
      img.src = tema.imagem;
      img.alt = 'Tema ' + tema.nome;
      img.loading = 'lazy';
      foto.append(img);
    } else {
      foto.textContent = '🎈';
    }

    const corpo = el('div', undefined, 'corpo-produto');

    corpo.append(
      el('small', 'Tema para festa'),
      el('h3', tema.nome),
      el('p', tema.descricao || 'Escolha seu modelo favorito.')
    );

    const valores = Object.values(tema.modelos)
      .map(m => m.preco);

    const menor = Math.min(...valores);

    corpo.append(
      el('div', 'A partir de ' + fmt(menor), 'preco')
    );

    const reservar = el(
      'button',
      '🎁 Reservar tema',
      'botao primaria'
    );

    reservar.type = 'button';
    reservar.addEventListener(
      'click',
      () => abrirEscolhaTema(tema.id)
    );

    corpo.append(reservar);
    card.append(foto, corpo);
    grid.append(card);
  }

  return encontrados;
}

  function renderProducts() {
    const grid = $('grade-produtos');
    grid.replaceChildren();
    const q = $('busca').value
      .toLocaleLowerCase('pt-BR')
      .trim();

    let count = 0;
    
if (filter === 'todos' || filter === 'temas') {
  count += renderizarCardsTemas(grid, q);
}

    for (const type of ['kits', 'itens']) {
      if (filter !== 'todos' && filter !== type) continue;

      for (const p of Object.values(catalog[type])) {
        if (!(p.nome + ' ' + p.categoria)
          .toLocaleLowerCase('pt-BR')
          .includes(q)) {
          continue;
        }

        count++;

        const card = el('article', undefined, 'produto');
        const photo = el('div', undefined, 'foto-produto');

        if (p.imagem) {
          const img = el('img');
          img.src = p.imagem;
          img.alt = 'Foto de ' + p.nome;
          img.loading = 'lazy';
          photo.append(img);
        } else {
          photo.textContent = type === 'kits' ? '🎁' : '🎈';
        }

        const body = el('div', undefined, 'corpo-produto');

        body.append(
          el('small', type === 'kits' ? 'Kit' : 'Tema / peça'),
          el('h3', p.nome),
          el('small', p.categoria || 'Tralalá Festas'),
          el(
            'div',
            p.preco === null
              ? 'Valor sob consulta'
              : fmt(p.preco),
            'preco'
          )
        );

        const b = el(
          'button',
          '🛒 Adicionar ao carrinho',
          'botao primaria'
        );

        b.type = 'button';
        b.addEventListener(
          'click',
          () => add(type + ':' + p.id)
        );

        body.append(b);
        card.append(photo, body);
        grid.append(card);
      }
    }

    $('estado-catalogo').textContent = count
      ? `${count} opção(ões) encontrada(s).`
      : 'Nenhum item encontrado. Experimente outra busca.';
  }

  function renderCart() {
    const container = $('itens-carrinho');
    container.replaceChildren();

    let total = 0;
    let count = 0;
    let unpriced = 0;

    for (const [key, qty] of Object.entries(cart)) {
      const p = productByKey(key);

      if (!p || !Number.isInteger(qty) || qty < 1) {
        delete cart[key];
        continue;
      }

      count += qty;

      if (p.preco === null) {
        unpriced++;
      } else {
        total += p.preco * qty;
      }

      const row = el('div', undefined, 'linha-carrinho');

      row.append(
        el('strong', p.nome),
        el('span', '× ' + qty)
      );

      const minus = el('button', '−');
      minus.type = 'button';
      minus.addEventListener('click', () => {
        cart[key]--;

        if (cart[key] <= 0) delete cart[key];

        saveCart();
      });

      const plus = el('button', '+');
      plus.type = 'button';
      plus.addEventListener('click', () => {
        cart[key] = Math.min(20, cart[key] + 1);
        saveCart();
      });

      const del = el('button', '✕');
      del.type = 'button';
      del.setAttribute('aria-label', 'Remover ' + p.nome);

      del.addEventListener('click', () => {
        delete cart[key];
        saveCart();
      });

      row.append(minus, plus, del);
      container.append(row);
    }

    if (!count) {
      container.append(
        el('p', 'Seu carrinho está vazio.')
      );
    }

    $('total-carrinho').textContent =
      fmt(total) +
      (unpriced ? ' + itens sob consulta' : '');

    $('contador-carrinho').textContent = count;
    $('btn-checkout').disabled = count === 0;

    sessionStorage.setItem(
      'trl_carrinho',
      JSON.stringify(cart)
    );
  }

  function showAccount(next) {
    pendingAction = next;
    dialog('dialog-carrinho', false);
    dialog('dialog-conta');
  }

  function afterAuth(next) {
    const user = auth.currentUser;

    if (!user) {
      showAccount(next);
      return;
    }

    if (!user.emailVerified) {
      showAccount(next);

      $('status-conta').textContent =
        'Confirme seu e-mail. Depois clique em Entrar ' +
        'novamente para atualizar a verificação.';

      return;
    }

    if (next === 'checkout') {
      dialog('dialog-conta', false);
      dialog('dialog-pedido');
    }

    if (next === 'chat') {
      dialog('dialog-conta', false);
      dialog('dialog-lala');
    }
  }

  async function submitAccount(event) {
    event.preventDefault();

    const email = $('conta-email').value.trim();
    const password = $('conta-senha').value;
    const name = $('conta-nome').value.trim();
    const button = $('btn-enviar-conta');

    button.disabled = true;
    $('status-conta').textContent = 'Aguarde...';

    try {
      if (mode === 'register') {
        if (name.length < 2 || password.length < 8) {
          throw Error(
            'Informe seu nome e senha com no mínimo 8 caracteres.'
          );
        }

        const cred = await auth.createUserWithEmailAndPassword(
          email, password
        );

        await cred.user.updateProfile({
          displayName: name
        });

        await db.ref(
          'clientesVitrine/' + cred.user.uid + '/perfil'
        ).set({
          nome: name,
          email: cred.user.email,
          criadoEm: firebase.database.ServerValue.TIMESTAMP
        });

        await cred.user.sendEmailVerification();

        $('status-conta').textContent =
          'Conta criada! Enviamos um link de confirmação ' +
          'ao seu e-mail. Confirme antes de continuar.';

      } else {
        const cred = await auth.signInWithEmailAndPassword(
          email, password
        );

        await cred.user.reload();

        if (!cred.user.emailVerified) {
          $('status-conta').textContent =
            'Você precisa confirmar seu e-mail antes de continuar. ' +
            'Verifique a caixa de entrada e o spam.';
        } else {
          $('status-conta').textContent =
            'Login realizado!';

          dialog('dialog-conta', false);

          if (pendingAction) {
            afterAuth(pendingAction);
          } else {
            toast('Bem-vindo(a) à Tralalá!');
          }
        }
      }
    } catch (err) {
      console.error(
        'Falha de autenticação:',
        err.code || err.message
      );

      $('status-conta').textContent =
        'Não foi possível concluir. Confira seus dados ' +
        'ou tente recuperar a senha.';
    } finally {
      button.disabled = false;
    }
  }

  function requestItems() {
    return Object.entries(cart)
      .map(([key, qtd]) => {
        const p = productByKey(key);

        return p ? {
          id: key,
          nome: p.nome.slice(0, 130),
          quantidade: Math.min(20, Number(qtd))
        } : null;
      })
      .filter(Boolean);
  }

  async function writeRequest(payload) {
    const user = auth.currentUser;

    if (!user) {
      throw Error('Faça login primeiro.');
    }

    await user.reload();

    if (!user.emailVerified) {
      throw Error('Confirme seu e-mail primeiro.');
    }

await user.getIdToken(true);

    const ref = db.ref(
      'clientesVitrine/' +
      user.uid +
      '/solicitacoes'
    ).push();

    await ref.set({
      ...payload,
      status: 'pendente',
      criadoEm: firebase.database.ServerValue.TIMESTAMP
    });

    return ref.key;
  }

  async function submitOrder(ev) {
    ev.preventDefault();

    const button = $('btn-enviar-pedido');
    button.disabled = true;

    try {
      const items = requestItems();

      if (!items.length) {
        throw Error('Seu carrinho está vazio.');
      }

      const date = $('pedido-data').value;

      if (date < localToday()) {
        throw Error('Escolha uma data futura.');
      }

      await writeRequest({
        tipo: 'orcamento',
        dataFesta: date,
        modalidade: $('pedido-modalidade').value,
        regiao: $('pedido-regiao').value.trim().slice(0, 120),
        mensagem: $('pedido-obs').value.trim().slice(0, 1500) ||
          'Solicitação de orçamento',
        itens: items
      });

      cart = {};
      saveCart();

      $('form-pedido').reset();

      $('status-pedido').textContent =
        'Pedido enviado! A equipe irá conferir e entrar ' +
        'em contato. Nenhuma reserva ou pagamento foi confirmado.';

    } catch (e) {
      $('status-pedido').textContent =
        e.message || 'Não foi possível enviar a solicitação.';
    } finally {
      button.disabled = false;
    }
  }

  async function submitHelp(ev) {
    ev.preventDefault();

    const button = ev.submitter;
    button.disabled = true;

    try {
      await writeRequest({
        tipo: 'atendimento',
        dataFesta: '',
        modalidade: '',
        regiao: '',
        mensagem: $('ajuda-texto').value.trim().slice(0, 1500),
        itens: []
      });

      $('form-ajuda').reset();

      $('status-ajuda').textContent =
        'Pedido encaminhado à equipe. Aguarde o retorno humano.';

    } catch (e) {
      $('status-ajuda').textContent =
        e.message || 'Erro ao solicitar atendimento.';
    } finally {
      button.disabled = false;
    }
  }

  async function load() {
    try {
      const snap = await db.ref('vitrineCatalogo').once('value');

      catalog = safeCat(snap.val() || {});

catalog.temas = prepararTemasPublicos(
  snap.val()?.temas || {}
);

      renderProducts();
      renderCart();
    } catch (e) {
      $('estado-catalogo').textContent =
        'Catálogo temporariamente indisponível.';

      console.error(e);
    }
  }

/* ==========================================
   LALÁ — ATENDIMENTO GUIADO
   ========================================== */

function iniciarAtendimentoGuiado() {

  const respostas = {

    kits:
      "🎁 Temos diversos modelos de kits " +
      "e temas para sua comemoração! " +
      "Explore a Vitrine e escolha o seu favorito. " +
      "A equipe confirma a disponibilidade.",

    reservas:
      "📅 Para solicitar uma reserva, " +
      "escolha o tema e modelo, adicione " +
      "ao carrinho e informe a data da festa. " +
      "A reserva só será confirmada " +
      "pela nossa equipe.",

    pagamentos:
      "💳 As informações de pagamento " +
      "são fornecidas pela equipe após " +
      "a conferência do orçamento. " +
      "Não realize transferências sem " +
      "confirmar os dados oficiais da loja.",

    humano:
      "🙋 Claro! Conte sua dúvida no " +
      "campo abaixo e envie a solicitação. " +
      "Um atendente humano poderá ajudar você."
  };

  document.querySelectorAll(
    "[data-lala-ajuda]"
  ).forEach(botao => {

    botao.addEventListener(
      "click",
      () => {

        const tipo =
          botao.dataset.lalaAjuda;

        const resposta = respostas[tipo];

        if (!resposta) return;

        const destino =
          document.getElementById(
            "lala-resposta"
          );

        if (destino) {
          destino.textContent = resposta;
        }

        if (tipo === "humano") {
          document.getElementById(
            "ajuda-texto"
          )?.focus();
        }
      }
    );
  });
}

/* =====================================================
   LALÁ — INTERPRETADOR SEM API
   Gírias, erros de grafia, contexto e confirmação
   ===================================================== */

const lalaMemoria = {
  tema: "",
  modelo: "",
  data: "",
  aguardandoTema: ""
};

const lalaGirias = {
  vc: "voce",
  vcs: "voces",
  q: "que",
  qnt: "quanto",
  qto: "quanto",
  qt: "quanto",
  agr: "agora",
  hj: "hoje",
  amnh: "amanha",
  amanhaa: "amanha",
  pfv: "por favor",
  pfvr: "por favor",
  pls: "por favor",
  tbm: "tambem",
  tb: "tambem",
  pq: "porque",
  pqq: "porque",
  obg: "obrigado",
  vlw: "valeu",
  blz: "beleza",
  msg: "mensagem",
  disp: "disponivel",
  precoo: "preco",
  basco: "basico",
  bazico: "basico",
  basiku: "basico",
  stori: "story",
  safare: "safari",
  p: "para",
  pra: "para"
};

function lalaNormalizar(texto) {
  return String(texto || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/[^a-z0-9/\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lalaExpandir(texto) {
  return lalaNormalizar(texto)
    .split(" ")
    .map(palavra => lalaGirias[palavra] || palavra)
    .join(" ");
}

function lalaDistancia(a, b) {
  const anterior = Array.from(
    { length: b.length + 1 },
    (_, i) => i
  );

  let linha = anterior;

  for (let i = 1; i <= a.length; i++) {
    const nova = [i];

    for (let j = 1; j <= b.length; j++) {
      nova[j] = Math.min(
        nova[j - 1] + 1,
        linha[j] + 1,
        linha[j - 1] +
          (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }

    linha = nova;
  }

  return linha[b.length];
}

function lalaSimilaridade(a, b) {
  if (!a || !b) return 0;

  return 1 -
    lalaDistancia(a, b) /
    Math.max(a.length, b.length);
}

function lalaTemas() {
  return Object.entries(catalog.temas || {})
    .filter(([, tema]) => tema?.nome)
    .map(([id, tema]) => ({
      id,
      nome: tema.nome,
      modelos: tema.modelos || {}
    }));
}

function lalaDetectarTema(texto) {
  const temas = lalaTemas();
  const entrada = lalaExpandir(texto);
  const palavras = entrada.match(/[a-z]+/g) || [];

  const resultados = [];

  for (const tema of temas) {
    const nome = lalaNormalizar(tema.nome);

    if (!nome) continue;

    // Primeiro: nome completo, sem erros.
    if (
      (" " + entrada + " ").includes(
        " " + nome + " "
      )
    ) {
      resultados.push({
        tema,
        confianca: 1
      });
      continue;
    }

    // Depois: comparação aproximada.
    const partes = nome.split(" ");
    let melhor = 0;

    for (let i = 0; i < palavras.length; i++) {
      for (
        let tamanho = Math.max(1, partes.length - 1);
        tamanho <= partes.length + 1;
        tamanho++
      ) {
        const trecho = palavras
          .slice(i, i + tamanho)
          .join(" ");

        if (!trecho || trecho.length < 4) continue;

        const nota = lalaSimilaridade(
          trecho,
          nome
        );

        melhor = Math.max(melhor, nota);
      }
    }

    if (melhor >= 0.68) {
      resultados.push({
        tema,
        confianca: melhor
      });
    }
  }

  resultados.sort(
    (a, b) => b.confianca - a.confianca
  );

  const primeiro = resultados[0];
  const segundo = resultados[1];

  if (!primeiro) return null;

  // Se dois temas forem muito parecidos,
  // não escolher arbitrariamente.
  const ambiguo = segundo &&
    primeiro.confianca - segundo.confianca < 0.12;

  return {
    ...primeiro,
    confirmar:
      primeiro.confianca < 0.90 ||
      Boolean(ambiguo)
  };
}

function lalaDetectarModelo(texto) {
  const entrada = lalaExpandir(texto);

  const modelosConhecidos = [
    ["Só um Bolinho", ["so um bolinho", "bolinho"]],
    ["Básico", ["basico", "basic"]],
    ["Prata", ["prata"]],
    ["Ouro", ["ouro"]]
  ];

  for (const [modelo, alternativas] of modelosConhecidos) {
    if (alternativas.some(palavra =>
      (" " + entrada + " ").includes(
        " " + palavra + " "
      )
    )) {
      return modelo;
    }
  }

  return "";
}

function lalaDetectarData(texto) {
  const achou = String(texto).match(
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/
  );

  if (!achou) return "";

  const dia = Number(achou[1]);
  const mes = Number(achou[2]);

  if (
    dia < 1 || dia > 31 ||
    mes < 1 || mes > 12
  ) {
    return "";
  }

  // Sem ano: manter a data incompleta.
  // A Lalá deve pedir confirmação.
  if (!achou[3]) {
    return (
      String(dia).padStart(2, "0") + "/" +
      String(mes).padStart(2, "0")
    );
  }

  let ano = Number(achou[3]);

  if (ano < 100) ano += 2000;

  const data = new Date(ano, mes - 1, dia);

  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    return "";
  }

  return (
    String(dia).padStart(2, "0") + "/" +
    String(mes).padStart(2, "0") + "/" +
    ano
  );
}

function lalaFalar(texto, cliente = false) {
  const conversa = document.getElementById(
    "lala-conversa"
  );

  if (!conversa) return;

  const mensagem = document.createElement("div");

  mensagem.textContent = texto;

  mensagem.style.cssText =
    "padding:12px 14px;border-radius:15px;" +
    "line-height:1.6;white-space:pre-line;" +
    "overflow-wrap:anywhere;" +
    "background:" +
    (cliente ? "#f4dce6" : "#f8f4f6") + ";" +
    "margin-left:" +
    (cliente ? "28px" : "0") + ";" +
    "margin-right:" +
    (cliente ? "0" : "28px") + ";";

  conversa.append(mensagem);
  conversa.scrollTop = conversa.scrollHeight;
}

function lalaConfirmarTema(tema) {
  const conversa = document.getElementById(
    "lala-conversa"
  );

  if (!conversa) return;

  const linha = document.createElement("div");
  linha.style.cssText =
    "display:flex;gap:8px;flex-wrap:wrap;";

  const sim = document.createElement("button");
  sim.type = "button";
  sim.className = "botao primaria";
  sim.textContent = "💗 Isso mesmo!";

  const nao = document.createElement("button");
  nao.type = "button";
  nao.className = "botao claro";
  nao.textContent = "Outro tema";

  sim.addEventListener("click", () => {
    lalaMemoria.tema = tema.nome;
    lalaMemoria.aguardandoTema = "";

    linha.remove();

    lalaFalar(
      "Perfeito! 💕 Então vamos considerar " +
      tema.nome + ". " +
      "Qual modelo de kit você gostaria?"
    );
  });

  nao.addEventListener("click", () => {
    lalaMemoria.aguardandoTema = "";
    linha.remove();

    lalaFalar(
      "Sem problemas! 🌷 Pode me escrever " +
      "o nome do tema novamente ou me dar " +
      "mais alguma pista? Vou tentar encontrar!"
    );
  });

  linha.append(sim, nao);
  conversa.append(linha);
}

function lalaEncontrarPreco() {
  if (
    !lalaMemoria.tema ||
    !lalaMemoria.modelo
  ) return null;

  const tema = lalaTemas().find(
    t => lalaNormalizar(t.nome) ===
      lalaNormalizar(lalaMemoria.tema)
  );

  if (!tema) return null;

  const modelo = Object.values(tema.modelos)
    .find(m =>
      lalaNormalizar(m.nome) ===
      lalaNormalizar(lalaMemoria.modelo)
    );

  const preco = Number(modelo?.preco);

  return Number.isFinite(preco) && preco > 0
    ? preco
    : null;
}

function lalaInterpretar(texto) {
  const entrada = lalaExpandir(texto);

  // Enquanto aguarda confirmação, não
  // sobrescrever o tema por uma suposição.
  if (lalaMemoria.aguardandoTema) {
    if (/^(sim|isso|isso mesmo|correto|ss|s)$/i.test(entrada)) {
      const tema = lalaTemas().find(
        t => t.nome === lalaMemoria.aguardandoTema
      );

      lalaMemoria.aguardandoTema = "";

      if (tema) {
        lalaMemoria.tema = tema.nome;
        return (
          "Isso mesmo! 💗 Tema " + tema.nome +
          " confirmado. Qual kit você deseja?"
        );
      }
    }

    lalaMemoria.aguardandoTema = "";
  }

  const temaEncontrado = lalaDetectarTema(texto);

  if (temaEncontrado?.confirmar) {
    lalaMemoria.aguardandoTema =
      temaEncontrado.tema.nome;

    return {
      confirmar: temaEncontrado.tema,
      texto:
        "Acho que encontrei uma possibilidade! 💗 " +
        "Você está procurando o tema " +
        temaEncontrado.tema.nome +
        "? Me confirma para eu não confundir."
    };
  }

  if (temaEncontrado) {
    lalaMemoria.tema =
      temaEncontrado.tema.nome;
  }

  const modelo = lalaDetectarModelo(texto);
  const data = lalaDetectarData(texto);

  if (modelo) lalaMemoria.modelo = modelo;
  if (data) lalaMemoria.data = data;

  const saudacao =
    /^(oi|ola|bom dia|boa tarde|boa noite|eai)$/i
      .test(entrada);

  if (saudacao) {
    return "Oiê! 💗 Me conta qual tema, " +
      "modelo de kit ou data você está procurando!";
  }

  const querPreco =
    /\b(quanto|preco|valor|custa|ta)\b/.test(
      entrada
    );

  const querDisponibilidade =
    /\b(disponivel|disponibilidade|tem|reserva)\b/
      .test(entrada);

  const querHumano =
    /\b(atendente|humano|pessoa|funcionario)\b/
      .test(entrada);

  if (querHumano) {
    return "Claro! 💗 Você pode solicitar " +
      "o atendimento de alguém da nossa equipe " +
      "no formulário logo abaixo.";
  }

  if (
    !lalaMemoria.tema &&
    !lalaMemoria.modelo &&
    !lalaMemoria.data
  ) {
    return (
      "Opa, acho que ainda não consegui " +
      "identificar o tema direitinho. 💗 " +
      "Pode me dar mais uma pista ou escrever " +
      "o nome de outra forma?"
    );
  }

  let resposta = "Entendi até aqui! 💗\n\n";

  if (lalaMemoria.tema) {
    resposta += "🎨 Tema: " +
      lalaMemoria.tema + "\n";
  }

  if (lalaMemoria.modelo) {
    resposta += "🎁 Kit: " +
      lalaMemoria.modelo + "\n";
  }

  if (lalaMemoria.data) {
    resposta += "📅 Data: " +
      lalaMemoria.data + "\n";
  }

  const preco = lalaEncontrarPreco();

  if (querPreco) {
    resposta += "\n";

    resposta += preco !== null
      ? "💰 Valor cadastrado: " +
        fmt(preco) + ".\n"
      : "O valor desse modelo precisa " +
        "ser confirmado pela equipe.\n";
  }

  if (querDisponibilidade) {
    resposta +=
      "\nA disponibilidade será conferida " +
      "pela equipe antes da confirmação. 🌷";
  }

  if (
    lalaMemoria.data &&
    !/\/\d{4}$/.test(lalaMemoria.data)
  ) {
    resposta +=
      "\nVocê pode confirmar o ano da festa?";
  } else if (!lalaMemoria.tema) {
    resposta +=
      "\nQual tema você gostaria?";
  } else if (!lalaMemoria.modelo) {
    resposta +=
      "\nQual modelo de kit você prefere?";
  } else if (!lalaMemoria.data) {
    resposta +=
      "\nPara qual data seria a festa?";
  } else {
    resposta +=
      "\nSe estiver tudo certinho, você pode " +
      "enviar sua solicitação à equipe. 🎈";
  }

  return resposta;
}

function iniciarLalaInteligente() {
  const formulario = document.getElementById(
    "form-lala-mensagem"
  );

  if (!formulario) return;

  formulario.addEventListener(
    "submit",
    evento => {
      evento.preventDefault();

      const campo = document.getElementById(
        "lala-mensagem"
      );

      const texto = campo.value.trim();
      if (!texto) return;

      lalaFalar(texto, true);
      campo.value = "";

      const resultado = lalaInterpretar(texto);

      if (typeof resultado === "string") {
        lalaFalar(resultado);
      } else {
        lalaFalar(resultado.texto);

        if (resultado.confirmar) {
          lalaConfirmarTema(
            resultado.confirmar
          );
        }
      }
    }
  );
}

  function init() {
    
iniciarAtendimentoGuiado();
iniciarLalaInteligente();

    document.querySelectorAll('[data-fechar]')
      .forEach(button => button.addEventListener(
        'click',
        () => dialog(button.dataset.fechar, false)
      ));

    document.querySelectorAll('.filtro[data-filtro]')
      .forEach(button => button.addEventListener(
        'click',
        () => {
          filter = button.dataset.filtro;

          document.querySelectorAll('.filtro[data-filtro]')
            .forEach(x => x.classList.toggle(
              'ativo',
              x === button
            ));

          renderProducts();
        }
      ));

    $('busca').addEventListener('input', renderProducts);

    $('btn-carrinho').addEventListener(
      'click',
      () => dialog('dialog-carrinho')
    );

    $('btn-checkout').addEventListener(
      'click',
      () => afterAuth('checkout')
    );

    $('btn-lala').addEventListener(
      'click',
      () => afterAuth('chat')
    );

    $('btn-conta').addEventListener('click', async () => {
      if (auth.currentUser) {
        await auth.signOut();
        toast('Você saiu da sua conta.');
      } else {
        showAccount(null);
      }
    });

    function setMode(nextMode) {
      mode = nextMode;

      $('linha-nome').hidden = nextMode !== 'register';
      $('conta-nome').required = nextMode === 'register';

      $('conta-senha').autocomplete =
        nextMode === 'register'
          ? 'new-password'
          : 'current-password';

      $('btn-enviar-conta').textContent =
        nextMode === 'register'
          ? 'Criar conta'
          : 'Entrar';

      $('mostrar-entrar').classList.toggle(
        'ativo',
        nextMode !== 'register'
      );

      $('mostrar-cadastro').classList.toggle(
        'ativo',
        nextMode === 'register'
      );

      $('status-conta').textContent = '';
    }

    $('mostrar-entrar').addEventListener(
      'click',
      () => setMode('login')
    );

    $('mostrar-cadastro').addEventListener(
      'click',
      () => setMode('register')
    );

    $('form-conta').addEventListener(
      'submit',
      submitAccount
    );

    $('btn-recuperar').addEventListener(
      'click',
      async () => {
        const email = $('conta-email').value.trim();

        if (!email) {
          return toast('Digite o e-mail primeiro.');
        }

        try {
          await auth.sendPasswordResetEmail(email);
          toast(
            'Se existir uma conta, as instruções serão enviadas.'
          );
        } catch {
          toast('Não foi possível enviar agora.');
        }
      }
    );

    $('form-pedido').addEventListener(
      'submit',
      submitOrder
    );

    $('form-ajuda').addEventListener(
      'submit',
      submitHelp
    );

    auth.onAuthStateChanged(user => {
      $('btn-conta').textContent = user ? 'Sair' : 'Entrar';
    });

    $('pedido-data').min = localToday();
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
