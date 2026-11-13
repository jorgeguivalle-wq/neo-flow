
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

  function init() {
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
