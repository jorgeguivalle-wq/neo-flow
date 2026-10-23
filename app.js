// ============================================================
// SISTEMA PRINCIPAL — Tralalá Festas
// Autenticação via Firebase Auth (corrigida)
// ============================================================

const CONFIG = {
  firebase: {
    apiKey: "AIzaSyCS6ofyis160STTrjhFJZDCsqAIyh_Ghmc",
    authDomain: "tralala-d8ce2.firebaseapp.com",
    databaseURL: "https://tralala-d8ce2-default-rtdb.firebaseio.com/",
    projectId: "tralala-d8ce2",
    storageBucket: "tralala-d8ce2.appspot.com",
    messagingSenderId: "704078064009",
    appId: "1:704078064009:web:4d6ffc34c21b14322f9958"
  },
  frete: { consumoKmPorLitro: 9, percentualManutencao: 0.20 }
};

const State = {
  db: null, estoqueArray: [], estoqueMap: {}, reservas: [], orcamentos: [], kits: [], categorias: [], orcamentosAbertos: [],
  temaAtual: "", temaAtualObj: null, kitAtual: "", montarNoLocal: false,
  usuarioLogadoEmail: "", usuarioUID: "", salvandoPeca: false, carregando: true,
  pecasSelecionadasKit: {}, temasSelecionadosKit: {}, pecasSelecionadasContrato: [],
  pecasQtdKit: {}, pecasQtdContrato: {},
  kitCriando: { nome: "", quantidade: 1, pecas: [], temas: [], imagem: "", pecasQtd: {} },
  somaAutomatica: 0,
  descontoAplicado: { tipo: "percent", valor: 0, totalOriginal: 0, totalFinal: 0 },
  frete: { kmIda: 0, kmTotal: 0, precoCombustivel: 0, litros: 0, custoCombustivel: 0, manutencao: 0, freteTotal: 0, segundaViagem: false }
};
window.State = State;

const mesesAno = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const mesesExtenso = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
let db = null;
let auth = null;
let chartInstance = null;
let listenersAtivos = false;

// ============================================================
// MODAL STATUS
// ============================================================
const ModalStatus = {
  exibir: (titulo, subtitulo) => {
    const modal = document.getElementById("modal-status-operacao");
    const spinner = document.getElementById("spinner-status");
    const t = document.getElementById("titulo-status-operacao");
    const sub = document.getElementById("subtitulo-status-operacao");
    if (!modal) return;
    if (spinner) { spinner.style.display = "block"; spinner.style.borderColor = "#f3f3f3"; spinner.style.borderTopColor = "var(--primary)"; }
    if (t) { t.style.color = "var(--primary)"; t.innerText = titulo || "PROCESSANDO..."; }
    if (sub) sub.innerText = subtitulo || "Aguarde a confirmação.";
    modal.classList.add("ativo");
  },
  sucesso: (mensagem, callback) => {
    const spinner = document.getElementById("spinner-status");
    const t = document.getElementById("titulo-status-operacao");
    const sub = document.getElementById("subtitulo-status-operacao");
    if (spinner) spinner.style.display = "none";
    if (t) { t.style.color = "var(--success)"; t.innerText = "✓ SUCESSO"; }
    if (sub) sub.innerText = mensagem || "Operação realizada com êxito.";
    setTimeout(() => { ModalStatus.fechar(); if (callback) callback(); }, 700);
  },
  erro: (mensagem) => {
    const spinner = document.getElementById("spinner-status");
    const t = document.getElementById("titulo-status-operacao");
    const sub = document.getElementById("subtitulo-status-operacao");
    if (spinner) spinner.style.display = "none";
    if (t) { t.style.color = "var(--error)"; t.innerText = "ERRO NA OPERAÇÃO"; }
    if (sub) sub.innerText = mensagem || "Não foi possível concluir.";
    setTimeout(() => { ModalStatus.fechar(); }, 2200);
  },
  fechar: () => { const modal = document.getElementById("modal-status-operacao"); if (modal) modal.classList.remove("ativo"); }
};

// ============================================================
// UTILS
// ============================================================
const Utils = {
  showToast: function(message, type) {
    if (!type) type = 'info';
    var icone = type === 'success' ? '✅' : (type === 'error' ? '🚨' : '⚠️');
    console.log(icone + " " + message);
    var container = document.getElementById('toast-container');
    if (container) {
      var toast = document.createElement('div');
      toast.className = "toast toast-" + type;
      toast.style.cssText = "background:" + (type==='success'?'#27ae60':type==='error'?'#e74c3c':'#f39c12') + ";color:#fff;padding:14px 24px;border-radius:8px;font-size:14px;box-shadow:0 5px 15px rgba(0,0,0,0.2);margin-bottom:10px;";
      toast.innerHTML = "<span>" + icone + "</span> <span>" + message + "</span>";
      container.appendChild(toast);
      setTimeout(function() { toast.remove(); }, 5000);
    } else if (type === 'error') { alert('❌ ' + message); }
  },
  formatCurrency: function(value) {
    var v = parseFloat(value);
    if (isNaN(v) || !isFinite(v)) v = 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  },
  formatDateBR: function(dateString) {
    if (!dateString) return "Não informada";
    var p = String(dateString).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : dateString;
  },
  getHojeDataString: function() {
    var d = new Date();
    var mes = String(d.getMonth() + 1);
    var dia = String(d.getDate());
    if (mes.length < 2) mes = '0' + mes;
    if (dia.length < 2) dia = '0' + dia;
    return d.getFullYear() + "-" + mes + "-" + dia;
  },
  getHoraString: function() { return new Date().toTimeString().split(' ')[0]; },
  normalizar: function(s) { return (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
};

function safe(v) { return (v === undefined || v === null) ? "" : v; }

function descricaoPecasDetalhada(pecas, pecasQtd) {
  if (!pecas || pecas.length === 0) return "__________________________________";
  return pecas.map(function(nomePeca) {
    var item = State.estoqueMap[nomePeca];
    var qtd = (pecasQtd && pecasQtd[nomePeca]) ? parseInt(pecasQtd[nomePeca]) : 1;
    if (item) {
      var partes = [];
      if (item.categoria) partes.push(item.categoria);
      partes.push(qtd + " unidade" + (qtd > 1 ? "s" : ""));
      if (item.modelo) partes.push(item.modelo);
      return nomePeca + " (" + partes.join(", ") + ")";
    }
    return nomePeca;
  }).join("; ");
}

function verificarDisponibilidadeTema(dataReserva, temaNome) {
  if (!dataReserva || !temaNome) return { livre: true };
  var reservasNoDia = State.reservas.filter(function(r) { return r.data === dataReserva; });
  var jaUsado = reservasNoDia.filter(function(r) { return (r.tema || "") === temaNome; }).length;
  var itemTema = State.estoqueMap[temaNome];
  var disponivel = itemTema ? (parseInt(itemTema.quantidade) || 1) : 1;
  return { livre: jaUsado < disponivel, jaUsado: jaUsado, disponivel: disponivel, tema: temaNome, data: dataReserva };
}

function reduzirImagem(file, maxWidth, quality) {
  return new Promise(function(resolve, reject) {
    if (!file) return reject("Sem arquivo");
    maxWidth = maxWidth || 900;
    quality = quality || 0.82;
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = function() { reject("Erro ao carregar imagem"); };
      img.src = e.target.result;
    };
    reader.onerror = function() { reject("Erro ao ler arquivo"); };
    reader.readAsDataURL(file);
  });
}

// ============================================================
// FRETE
// ============================================================
const FreteCalc = {
  ler: function() {
    var kmEl = document.getElementById('calc-km');
    var precoEl = document.getElementById('calc-valor-litro');
    var chkSegunda = document.getElementById('chk-segunda-viagem');
    var kmIda = kmEl ? parseFloat(kmEl.value) : 0;
    var preco = precoEl ? parseFloat(precoEl.value) : 0;
    if (isNaN(kmIda) || kmIda < 0 || !isFinite(kmIda)) kmIda = 0;
    if (isNaN(preco) || preco < 0 || !isFinite(preco)) preco = 0;
    var segundaViagem = !!(chkSegunda && chkSegunda.checked);
    return { kmIda: kmIda, preco: preco, segundaViagem: segundaViagem };
  },
  calcular: function() {
    var e = this.ler();
    var fator = e.segundaViagem ? 4 : 2;
    var kmTotal = e.kmIda * fator;
    var litros = kmTotal / CONFIG.frete.consumoKmPorLitro;
    var custoCombustivel = litros * e.preco;
    var manutencao = custoCombustivel * CONFIG.frete.percentualManutencao;
    var freteTotal = custoCombustivel + manutencao;
    if (!isFinite(litros)) litros = 0;
    if (!isFinite(custoCombustivel)) custoCombustivel = 0;
    if (!isFinite(manutencao)) manutencao = 0;
    if (!isFinite(freteTotal)) freteTotal = 0;
    State.frete = { kmIda: e.kmIda, kmTotal: kmTotal, precoCombustivel: e.preco, segundaViagem: e.segundaViagem, litros: litros, custoCombustivel: custoCombustivel, manutencao: manutencao, freteTotal: freteTotal };
    return State.frete;
  },
  renderizar: function() {
    var f = this.calcular();
    var txtKmTotal = document.getElementById('calc-km-total');
    var txtCombustivel = document.getElementById('calc-total-combustivel');
    var txtManutencao = document.getElementById('calc-manutencao');
    var txtTotal = document.getElementById('calc-cobrar-cliente');
    if (txtKmTotal) txtKmTotal.textContent = f.kmTotal;
    if (txtCombustivel) txtCombustivel.textContent = "R$ " + f.custoCombustivel.toFixed(2);
    if (txtManutencao) txtManutencao.textContent = "R$ " + f.manutencao.toFixed(2);
    if (txtTotal) txtTotal.textContent = "R$ " + f.freteTotal.toFixed(2);
    var inputFrete = document.getElementById('valor-frete');
    if (inputFrete) inputFrete.value = f.freteTotal.toFixed(2);
    recalcularTotais();
    return f;
  },
  limpar: function() {
    State.frete = { kmIda: 0, kmTotal: 0, precoCombustivel: 0, litros: 0, custoCombustivel: 0, manutencao: 0, freteTotal: 0, segundaViagem: false };
    var kmEl = document.getElementById('calc-km');
    var chkSegunda = document.getElementById('chk-segunda-viagem');
    var inputFrete = document.getElementById('valor-frete');
    if (kmEl) kmEl.value = "";
    if (chkSegunda) chkSegunda.checked = false;
    if (inputFrete) inputFrete.value = "0.00";
    this.renderizar();
  }
};

function recalcularTotais() {
  var inputValorFesta = document.getElementById('valor-festa');
  var valorFesta = inputValorFesta ? (parseFloat(inputValorFesta.value) || 0) : 0;
  if (isNaN(valorFesta)) valorFesta = 0;
  var frete = State.frete.freteTotal || 0;
  var total = valorFesta + frete;
  var inputTotal = document.getElementById('valor-total');
  if (inputTotal) inputTotal.value = total.toFixed(2);
  var inputSinal = document.getElementById('valor-sinal');
  var sinal = inputSinal ? (parseFloat(inputSinal.value) || 0) : 0;
  if (isNaN(sinal)) sinal = 0;
  var inputRestante = document.getElementById('valor-restante');
  if (inputRestante) {
    var restante = total - sinal;
    if (restante < 0) restante = 0;
    inputRestante.value = restante.toFixed(2);
  }
}
// ============================================================
// FIREBASE — INICIALIZAÇÃO
// ============================================================
try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) firebase.initializeApp(CONFIG.firebase);
    db = firebase.database();
    window.db = db;
    auth = firebase.auth();
    State.db = db;
    console.log("🔥 Firebase inicializado. Projeto:", CONFIG.firebase.projectId);
  } else {
    console.error("❌ SDK do Firebase não carregado.");
  }
} catch (err) { console.error("❌ Erro ao inicializar Firebase:", err); }

// ============================================================
// AUTENTICAÇÃO — LOGIN / LOGOUT / SESSÃO
// ============================================================
function verificarAutorizacao(uid) {
  return new Promise(function(resolve) {
    if (!db) return resolve({ autorizado: false, erro: "db_indisponivel" });
    if (!uid) return resolve({ autorizado: false, erro: "uid_vazio" });

    db.ref("usuariosAutorizados/" + uid).once("value")
      .then(function(snap) {
        var val = snap.val();
        if (snap.exists() && val === true) return resolve({ autorizado: true, erro: null });
        if (!snap.exists()) return resolve({ autorizado: false, erro: "nao_existe" });
        if (val !== true) return resolve({ autorizado: false, erro: "valor_invalido" });
      })
      .catch(function(err) {
        return resolve({ autorizado: false, erro: "leitura_falhou", detalhe: err });
      });
  });
}

function entrarNoSistema(user) {
  State.usuarioLogadoEmail = user.email || "";
  State.usuarioUID = user.uid || "";

  var sLogin = document.getElementById("secao-login");
  var sVerif = document.getElementById("secao-verificador");
  if (sLogin) sLogin.style.display = "none";
  if (sVerif) sVerif.style.display = "block";
  var nome = document.getElementById("nome-usuario");
  if (nome) nome.innerHTML = "👤 <b>" + State.usuarioLogadoEmail.split('@')[0] + "</b>";

  Utils.showToast("Login realizado!", "success");
  try { Database.listenPontoUsuario(); } catch (e) {}

  if (State.usuarioLogadoEmail === "leonardodovalle@gmail.com" ||
      State.usuarioLogadoEmail === "tralaladecoracoes@gmail.com" ||
      State.usuarioLogadoEmail === "jorgeguivalle@gmail.com") {
    Database.listenPontosGeral();
  }

  if (!listenersAtivos) {
    listenersAtivos = true;
    carregarEstoque();
    listenCategorias();
    listenReservas();
    listenOrcamentos();
    listenKits();
  }
}

function handleLogin() {
  var emailEl = document.getElementById("email");
  var senhaEl = document.getElementById("senha");
  var email = emailEl ? emailEl.value.trim() : "";
  var senha = senhaEl ? senhaEl.value : "";

  if (!email || !senha) return Utils.showToast("Preencha e-mail e senha.", "warning");
  if (!auth) return Utils.showToast("Sistema indisponível.", "error");

  ModalStatus.exibir("AUTENTICANDO...", "Verificando credenciais.");

  auth.signInWithEmailAndPassword(email, senha)
    .then(function(cred) {
      var user = cred.user;
      return verificarAutorizacao(user.uid).then(function(resultado) {
        ModalStatus.fechar();
        if (resultado.autorizado) { entrarNoSistema(user); return; }
        if (resultado.erro === "leitura_falhou") {
          Utils.showToast("⚠️ Não foi possível verificar permissão.", "error");
          return;
        }
        Utils.showToast("🚫 Este usuário não tem permissão de acesso.", "error");
        return auth.signOut();
      });
    })
    .catch(function(err) {
      ModalStatus.fechar();
      var msg = "E-mail ou senha incorretos.";
      Utils.showToast(msg, "error");
    });
}

function handleLogout() {
  if (!auth) { window.location.reload(); return; }
  ModalStatus.exibir("SAINDO...", "Encerrando sessão.");
  auth.signOut().then(function() {
    ModalStatus.sucesso("Sessão encerrada", function() { window.location.reload(); });
  }).catch(function(err) {
    ModalStatus.erro("Erro ao sair.");
    setTimeout(function() { window.location.reload(); }, 1200);
  });
}

if (auth) {
  auth.onAuthStateChanged(function(user) {
    if (user) {
      if (State.usuarioLogadoEmail === user.email) return;
      verificarAutorizacao(user.uid).then(function(resultado) {
        if (resultado.autorizado) {
          entrarNoSistema(user);
        } else if (resultado.erro === "leitura_falhou") {
          console.error("🔴 Sessão ativa, mas leitura do banco falhou.");
        } else {
          State.usuarioLogadoEmail = "";
          State.usuarioUID = "";
          auth.signOut();
          Utils.showToast("🚫 Acesso revogado. Faça login novamente.", "error");
        }
      });
    } else {
      State.usuarioLogadoEmail = "";
      State.usuarioUID = "";
    }
  });
}

// ============================================================
// DATABASE (Realtime)
// ============================================================
const Database = {
  salvarPecaNuvem: async function(peca) {
    if (State.salvandoPeca) return;
    State.salvandoPeca = true;
    const btnSalvar = document.getElementById("btn-adicionar-peca");
    if (btnSalvar) btnSalvar.disabled = true;
    ModalStatus.exibir("LANÇANDO PEÇA...", "Salvando no acervo, aguarde.");
    try {
      if (db) {
        const refEstoque = db.ref("estoque");
        const newRef = peca.idFirebase ? db.ref("estoque/" + peca.idFirebase) : refEstoque.push();
        const pecaId = peca.idFirebase || newRef.key;
        const payload = {
          idFirebase: pecaId, nome: safe(peca.nome),
          quantidade: parseInt(peca.quantidade) || 1,
          categoria: safe(peca.categoria) || "Outros",
          modelo: safe(peca.modelo),
          preco: parseFloat(peca.preco) || 0,
          precoReposicao: parseFloat(peca.precoReposicao) || 0,
          imagem: safe(peca.imagem), atualizadoEm: Date.now()
        };
        await newRef.set(payload);
      }
      ModalStatus.sucesso("✓ PEÇA LANÇADA COM SUCESSO");
    } catch (error) {
      ModalStatus.erro("Não foi possível salvar a peça.");
    } finally {
      State.salvandoPeca = false;
      if (btnSalvar) btnSalvar.disabled = false;
    }
  },
  atualizarPecaNuvem: async function(idFirebase, dados) {
    if (!db) return false;
    try { await db.ref("estoque/" + idFirebase).update(dados); return true; } catch (e) { return false; }
  },
  removerPecaNuvem: async function(idFirebase) {
    if (!db) return false;
    try { await db.ref("estoque/" + idFirebase).remove(); return true; } catch (e) { return false; }
  },
  salvarCategoriaNuvem: function(nome) {
    if (!db) return Promise.reject("Sem conexão");
    nome = (nome || "").trim();
    if (!nome) return Promise.reject("Nome vazio");
    return db.ref('categorias').once('value').then(function(snapshot) {
      var data = snapshot.val(); var existe = false;
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(function(key) {
          var val = data[key];
          var n = (val && val.nome) ? val.nome : (typeof val === 'string' ? val : null);
          if (n && n.toLowerCase() === nome.toLowerCase()) existe = true;
        });
      }
      if (existe) return Promise.reject("Categoria já existe");
      return db.ref('categorias').push().set({ nome: nome, criadoEm: Date.now() });
    });
  },
  removerCategoriaNuvem: function(nome) {
    if (!db) return Promise.reject("Sem conexão");
    if (!nome) return Promise.reject("Nome vazio");
    return db.ref('categorias').once('value').then(function(snapshot) {
      var data = snapshot.val(); var chaveRemover = null;
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(function(key) {
          var val = data[key];
          var n = (val && val.nome) ? val.nome : (typeof val === 'string' ? val : null);
          if (n === nome) chaveRemover = key;
        });
      }
      if (!chaveRemover) return Promise.reject("Categoria não encontrada");
      if (!confirm('Remover a categoria "' + nome + '"?')) return Promise.reject("Cancelado");
      return db.ref('categorias/' + chaveRemover).remove();
    });
  },
  salvarReservaNuvem: function(dados) { if (!db) return Promise.reject("Sem conexão"); return db.ref('reservas').push().set(dados); },
  atualizarReservaNuvem: function(id, dados) { if (!db) return Promise.reject("Sem conexão"); return db.ref('reservas/' + id).update(dados); },
  excluirReservaNuvem: function(id) { if (!db) return Promise.reject("Sem conexão"); return db.ref("reservas/" + id).remove(); },
  salvarOrcamentoNuvem: function(dados) { if (!db) return Promise.reject("Sem conexão"); return db.ref('orcamentos').push().set(dados); },
  excluirOrcamentoNuvem: function(id) { if (!db) return Promise.reject("Sem conexão"); return db.ref("orcamentos/" + id).remove(); },
  salvarReuniaoNuvem: function(dados) { if (!db) return Promise.reject("Sem conexão"); return db.ref('reunioes').push().set(dados); },
  excluirReuniaoNuvem: function(id) { if (!db) return Promise.reject("Sem conexão"); return db.ref("reunioes/" + id).remove(); },
  salvarContratoNuvem: function(dados) {
    if (!db) return Promise.reject("Sem conexão");
    var limpo = {};
    Object.keys(dados).forEach(function(k) {
      var v = dados[k];
      if (v !== undefined && v !== null) limpo[k] = v;
    });
    return db.ref('contratos').push().set(limpo);
  },
  salvarKitNuvem: function(dados) { if (!db) return Promise.reject("Sem conexão"); return db.ref('kits').push().set(dados); },
  excluirKitNuvem: function(id) { if (!db) return Promise.reject("Sem conexão"); return db.ref("kits/" + id).remove(); },
  registrarPonto: function(tipo) {
    if (!db || !State.usuarioLogadoEmail) return Utils.showToast("Erro de identificação.", "error");
    var chaveUsuario = State.usuarioLogadoEmail.replace(/[.#$[\]]/g, "_");
    var hoje = Utils.getHojeDataString();
    var hora = Utils.getHoraString();
    var updateData = { usuario: State.usuarioLogadoEmail, data: hoje };
    updateData[tipo] = hora;
    db.ref("pontos/" + chaveUsuario + "/" + hoje).update(updateData)
      .then(function() { Utils.showToast("Ponto de " + (tipo === 'entrada' ? 'Entrada' : 'Saída') + " marcado!", "success"); })
      .catch(function() { Utils.showToast("Erro ao salvar ponto.", "error"); });
  },
  listenPontoUsuario: function() {
    if (!db || !State.usuarioLogadoEmail) return;
    var chaveUsuario = State.usuarioLogadoEmail.replace(/[.#$[\]]/g, "_");
    var hoje = Utils.getHojeDataString();
    db.ref("pontos/" + chaveUsuario + "/" + hoje).on('value', function(snap) {
      var dadosPonto = snap.val() || {};
      var entrada = dadosPonto.entrada || "--:--:--";
      var saida = dadosPonto.saida || "--:--:--";
      var statusEl = document.getElementById("ponto-status-hoje");
      if (statusEl) {
        statusEl.innerHTML = "📅 <b>Hoje (" + Utils.formatDateBR(hoje) + "):</b>" +
          "<span style='color:var(--success); margin-left:10px;'>🟢 Entrada: <b>" + entrada + "</b></span>" +
          "<span style='color:var(--error); margin-left:15px;'>🔴 Saída: <b>" + saida + "</b></span>";
      }
    });
  },
  listenPontosGeral: function() {
    if (!db) return;
    db.ref('pontos').on('value', function(snap) { renderRelatorioGeralPontos(snap.val() || {}); });
  }
};

window.adicionarCategoria = function(nome) { return Database.salvarCategoriaNuvem(nome); };
window.removerCategoria = function(nome) { return Database.removerCategoriaNuvem(nome); };

// ============================================================
// LISTENERS
// ============================================================
function carregarEstoque() {
  if (!db) return;
  const refEstoque = db.ref("estoque");
  refEstoque.on("value", (snapshot) => {
    const val = snapshot.val();
    State.estoqueArray = [];
    State.estoqueMap = {};
    if (val && typeof val === 'object') {
      if (Array.isArray(val)) {
        val.forEach((item, idx) => { if (item) State.estoqueArray.push({ idFirebase: String(idx), ...item }); });
      } else {
        Object.keys(val).forEach(k => {
          if (val[k]) {
            const it = { idFirebase: k, ...val[k] };
            State.estoqueArray.push(it);
            State.estoqueMap[it.nome || k] = it;
          }
        });
      }
    }
    renderizarTemas();
    carregarSugestoesTemaFicha();
    carregarTemasNoContrato();
    atualizarSeletoresCategoria();
  });
}

function listenReservas() {
  if (!db) return;
  db.ref('reservas').on('value', function(snap) {
    State.carregando = false;
    var val = snap.val(); var arr = [];
    if (val && typeof val === 'object') {
      Object.keys(val).forEach(function(id) {
        if (val[id]) {
          var copy = { id: id };
          for (var k in val[id]) { if (val[id].hasOwnProperty(k)) copy[k] = val[id][k]; }
          arr.push(copy);
        }
      });
    }
    State.reservas = arr;
    renderReservas();
  });
}

function listenOrcamentos() {
  if (!db) return;
  db.ref('orcamentos').on('value', function(snap) {
    var val = snap.val(); var arr = [];
    if (val && typeof val === 'object') {
      Object.keys(val).forEach(function(id) {
        if (val[id]) {
          var copy = { id: id };
          for (var k in val[id]) { if (val[id].hasOwnProperty(k)) copy[k] = val[id][k]; }
          arr.push(copy);
        }
      });
    }
    State.orcamentos = arr;
    renderOrcamentos();
  });
}

function listenKits() {
  if (!db) return;
  db.ref('kits').on('value', function(snap) {
    var val = snap.val(); var arr = [];
    if (val && typeof val === 'object') {
      Object.keys(val).forEach(function(id) {
        if (val[id]) {
          var copy = { id: id };
          for (var k in val[id]) { if (val[id].hasOwnProperty(k)) copy[k] = val[id][k]; }
          arr.push(copy);
        }
      });
    }
    State.kits = arr;
    renderKits();
  });
}

function listenCategorias() {
  if (!db) return;
  db.ref('categorias').on('value', function(snapshot) {
    var data = snapshot.val(); var nomes = [];
    if (data && typeof data === 'object') {
      Object.keys(data).forEach(function(key) {
        var val = data[key];
        var n = (val && val.nome) ? val.nome : (typeof val === 'string' ? val : null);
        if (n) nomes.push(n);
      });
    }
    State.categorias = nomes;
    atualizarSeletoresCategoria();
  });
}

// ============================================================
// LÓGICA DE ORÇAMENTOS EM ABERTO (NOVO)
// ============================================================
function listenOrcamentosAbertos() {
  if (!db) return;
  db.ref('orcamentos_abertos').on('value', function(snap) {
    var val = snap.val();
    var arr = [];
    if (val && typeof val === 'object') {
      Object.keys(val).forEach(function(id) {
        if (val[id]) {
          var copy = { id: id };
          for (var k in val[id]) { if (val[id].hasOwnProperty(k)) copy[k] = val[id][k]; }
          arr.push(copy);
        }
      });
    }
    if (window.State) window.State.orcamentosAbertos = arr;
    renderizarOrcamentosAbertos(arr);
  });
}

function renderizarOrcamentosAbertos(arr) {
  var container = document.getElementById("lista-orcamentos-aberto-container");
  if (!container) return;
  
  var filtroStatus = (document.getElementById("filtro-status-orcamento") || {}).value || "";
  var filtroData = (document.getElementById("filtro-data-retorno") || {}).value || "";
  
  var html = "";
  var count = 0;
  
  arr.forEach(function(orc) {
    if (filtroStatus && orc.status !== filtroStatus) return;
    if (filtroData && orc.dataRetorno !== filtroData) return;
    
    count++;
    var badgeColor = orc.status === 'fechado' ? 'badge-fechado' : (orc.status === 'perdido' ? 'badge-perdido' : (orc.status === 'negociacao' ? 'badge-negociacao' : 'badge-aguardando'));
    var wppNumero = orc.whatsapp ? orc.whatsapp.replace(/\D/g,'') : '';
    var msgWpp = encodeURIComponent("Olá " + orc.cliente + ", tudo bem? Estou passando para saber sobre o orçamento do tema " + orc.tema + ".");
    var wppLink = wppNumero ? "https://wa.me/55" + wppNumero + "?text=" + msgWpp : "#";
    var valorFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orc.valorTotal || 0);

    html += '<div class="card-orcamento-aberto">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
        '<strong>👤 ' + orc.cliente + '</strong>' +
        '<span class="badge-status ' + badgeColor + '">' + orc.status.toUpperCase() + '</span>' +
      '</div>' +
      '<p style="margin:2px 0; font-size:13px;">📅 Festa: ' + (orc.dataFesta || 'Não informada') + '</p>' +
      '<p style="margin:2px 0; font-size:13px;">🎨 Tema: ' + (orc.tema || 'Não informado') + '</p>' +
      '<p style="margin:2px 0; font-size:13px;">💰 Total: ' + valorFmt + '</p>' +
      '<p style="margin:2px 0; font-size:12px; color:#666;">🔔 Retornar em: ' + (orc.dataRetorno || 'Sem data') + '</p>' +
      '<div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">' +
        '<a href="' + wppLink + '" target="_blank" style="padding:8px 12px; background:#25D366; color:#fff; text-decoration:none; border-radius:6px; font-size:12px; font-weight:bold;">📱 WhatsApp</a>' +
        '<button type="button" onclick="window.mudarStatusOrcamento(\'' + orc.id + '\', \'' + orc.status + '\')" style="padding:8px 12px; background:#3498db; color:#fff; border:none; border-radius:6px; font-size:12px; cursor:pointer; font-weight:bold;">🔄 Status</button>' +
        '<button type="button" onclick="window.excluirOrcamentoAberto(\'' + orc.id + '\')" style="padding:8px 12px; background:#e74c3c; color:#fff; border:none; border-radius:6px; font-size:12px; cursor:pointer; font-weight:bold;">🗑️ Excluir</button>' +
      '</div>' +
    '</div>';
  });
  container.innerHTML = count > 0 ? html : "<p style='text-align:center; color:#999;'>Nenhum orçamento encontrado.</p>";
}

window.mudarStatusOrcamento = function(id, statusAtual) {
  var novo = prompt("Digite o novo status:\n(aguardando, negociacao, fechado, perdido)", statusAtual);
  if (novo && ["aguardando", "negociacao", "fechado", "perdido"].indexOf(novo) !== -1) {
    db.ref('orcamentos_abertos/' + id).update({ status: novo });
  } else if (novo) {
    alert("Status inválido! Use: aguardando, negociacao, fechado ou perdido.");
  }
};

window.excluirOrcamentoAberto = function(id) {
  if (confirm("Tem certeza que deseja excluir este orçamento?")) {
    db.ref('orcamentos_abertos/' + id).remove();
  }
};
// ============================================================
// TEMAS
// ============================================================
function renderizarTemas() {
  const corpo = document.getElementById("lista-temas-gerenciados-corpo");
  const contador = document.getElementById("contador-catalogo-total");
  if (contador) contador.textContent = State.estoqueArray.length + " itens";
  if (!corpo) return;
  if (State.estoqueArray.length === 0) {
    corpo.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999; padding:15px;">Nenhum tema ou peça cadastrada.</td></tr>';
    return;
  }
  const grupos = {};
  State.estoqueArray.forEach(function(item) {
    var cat = (item.categoria && String(item.categoria).trim()) || "Sem Categoria";
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(item);
  });
  var ordemPreferida = ["Maquete", "Louças de porcelana", "Painéis"];
  var categoriasOrdenadas = Object.keys(grupos).sort(function(a, b) {
    var ia = ordemPreferida.indexOf(a); var ib = ordemPreferida.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1; if (ib !== -1) return 1;
    return a.localeCompare(b, 'pt-BR');
  });
  var html = "";
  categoriasOrdenadas.forEach(function(cat) {
    var itens = grupos[cat];
    html += '<tr class="categoria-header-linha" style="background:linear-gradient(90deg,var(--primary),var(--primary-dark));color:#fff;font-weight:700;">' +
      '<td colspan="3" style="padding:10px;">📁 ' + cat + ' <span style="float:right;background:rgba(255,255,255,0.25);padding:2px 10px;border-radius:12px;font-size:12px;">' + itens.length + '</span></td></tr>';
    itens.forEach(function(tema) {
      var idxOriginal = State.estoqueArray.indexOf(tema);
      var img = tema.imagem ? '<img src="' + tema.imagem + '" class="catalogo-foto">' : '<div style="width:50px;height:50px;background:#eee;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#888;">Sem Foto</div>';
      var precoFmt = Utils.formatCurrency(tema.preco || 0);
      var precoRepFmt = Utils.formatCurrency(tema.precoReposicao || 0);
      html += '<tr><td style="text-align:center;">' + img + '</td>' +
        '<td><strong>' + (tema.nome || "Sem Nome") + '</strong><br><span style="font-size:11px; color:var(--text-muted);">' +
        'Categoria: ' + (tema.categoria || "Geral") + ' | Modelo: ' + (tema.modelo || "Padrão") + '<br>' +
        'Qtd: <strong>' + (tema.quantidade || 1) + '</strong> | ' +
        '💰 Locação: <strong style="color:#27ae60;">' + precoFmt + '</strong> | ' +
        '🔧 Reposição: <strong style="color:#e74c3c;">' + precoRepFmt + '</strong></span></td>' +
        '<td style="text-align:center; white-space:nowrap;">' +
        '<button type="button" onclick="window.editarTema(' + idxOriginal + ')" class="btn-acao-tabela btn-editar-tema" title="Editar">✏️</button>' +
        '<button type="button" onclick="window.editarPrecoTema(' + idxOriginal + ')" class="btn-acao-tabela btn-preco-tema" title="Adicionar Preço">💰</button>' +
        '<button type="button" onclick="window.removerTema(' + idxOriginal + ')" class="btn-acao-tabela btn-remover-orc" title="Remover">🗑️</button>' +
        '</td></tr>';
    });
  });
  corpo.innerHTML = html;
  const selectRemover = document.getElementById("select-remover-tema");
  if (selectRemover) {
    const va = selectRemover.value;
    selectRemover.innerHTML = '<option value="">Selecione um tema para remover...</option>';
    State.estoqueArray.forEach((item, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = (item.nome || 'Sem nome') + ' (' + (item.categoria || 'Geral') + ') - ' + (item.quantidade || 0) + ' disp.';
      selectRemover.appendChild(opt);
    });
    if (va !== "") selectRemover.value = va;
  }
}

window.editarTema = function(index) {
  const tema = State.estoqueArray[index];
  if (!tema) return Utils.showToast("Tema não encontrado.", "error");
  const modal = document.getElementById("modal-editar-tema");
  if (!modal) return;
  document.getElementById("editar-tema-id").value = tema.idFirebase || "";
  document.getElementById("editar-tema-nome").value = tema.nome || "";
  document.getElementById("editar-tema-qtd").value = tema.quantidade || 1;
  document.getElementById("editar-tema-categoria").value = tema.categoria || "Outros";
  document.getElementById("editar-tema-modelo").value = tema.modelo || "";
  document.getElementById("editar-tema-preco").value = tema.preco || 0;
  document.getElementById("editar-tema-preco-reposicao").value = tema.precoReposicao || 0;
  document.getElementById("editar-tema-imagem").value = "";
  document.getElementById("editar-tema-preview").src = tema.imagem || "https://placehold.co/200x200?text=Sem+Foto";
  modal.classList.add("ativo");
};

window.editarPrecoTema = function(index) {
  const tema = State.estoqueArray[index];
  if (!tema) return;
  var novo = prompt("💰 Preço da Locação (R$) para \"" + tema.nome + "\":", tema.preco || 0);
  if (novo === null) return;
  var novoRep = prompt("🔧 Preço de Reposição (R$) para \"" + tema.nome + "\":", tema.precoReposicao || 0);
  if (novoRep === null) return;
  ModalStatus.exibir("SALVANDO PREÇOS...", tema.nome);
  Database.atualizarPecaNuvem(tema.idFirebase, { preco: parseFloat(novo) || 0, precoReposicao: parseFloat(novoRep) || 0, atualizadoEm: Date.now() }).then(ok => {
    if (ok) ModalStatus.sucesso("✓ PREÇOS ATUALIZADOS");
    else ModalStatus.erro("Falha ao salvar.");
  });
};

window.removerTema = function(index) {
  const tema = State.estoqueArray[index];
  if (!tema) return;
  if (confirm('Remover "' + tema.nome + '"?')) {
    ModalStatus.exibir("REMOVENDO...", tema.nome);
    Database.removerPecaNuvem(tema.idFirebase).then(ok => {
      if (ok) ModalStatus.sucesso("✓ TEMA REMOVIDO");
      else ModalStatus.erro("Falha ao remover.");
    });
  }
};

function fecharModalEditar() {
  const modal = document.getElementById("modal-editar-tema");
  if (modal) modal.classList.remove("ativo");
}

function initModalEditar() {
  const modal = document.getElementById("modal-editar-tema");
  if (!modal) return;
  const btnFechar = document.getElementById("btn-fechar-editar-tema");
  if (btnFechar) btnFechar.onclick = fecharModalEditar;
  const btnCancelar = document.getElementById("btn-cancelar-editar-tema");
  if (btnCancelar) btnCancelar.onclick = fecharModalEditar;
  modal.addEventListener('click', function(e) { if (e.target === modal) fecharModalEditar(); });
  const inputImagem = document.getElementById("editar-tema-imagem");
  if (inputImagem) {
    inputImagem.onchange = function(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const preview = document.getElementById("editar-tema-preview");
      const reader = new FileReader();
      reader.onload = ev => { preview.src = ev.target.result; };
      reader.readAsDataURL(file);
    };
  }
  const btnSalvar = document.getElementById("btn-salvar-editar-tema");
  if (btnSalvar) {
    btnSalvar.onclick = async function() {
      const idFirebase = document.getElementById("editar-tema-id").value;
      const nome = document.getElementById("editar-tema-nome").value.trim();
      const qtd = parseInt(document.getElementById("editar-tema-qtd").value) || 0;
      const categoria = document.getElementById("editar-tema-categoria").value.trim() || "Outros";
      const modelo = document.getElementById("editar-tema-modelo").value.trim();
      const preco = parseFloat(document.getElementById("editar-tema-preco").value) || 0;
      const precoRep = parseFloat(document.getElementById("editar-tema-preco-reposicao").value) || 0;
      const fileInput = document.getElementById("editar-tema-imagem");
      if (!idFirebase) return Utils.showToast("Erro: ID não encontrado.", "error");
      if (!nome) return Utils.showToast("Preencha o nome.", "warning");
      btnSalvar.disabled = true; btnSalvar.innerText = "⏳ Salvando...";
      try {
        let imagemBase64 = null;
        if (fileInput && fileInput.files && fileInput.files[0]) {
          imagemBase64 = await reduzirImagem(fileInput.files[0], 900, 0.82);
        }
        const dados = { nome, quantidade: qtd, categoria, modelo, preco, precoReposicao: precoRep, atualizadoEm: Date.now() };
        if (imagemBase64) dados.imagem = imagemBase64;
        const ok = await Database.atualizarPecaNuvem(idFirebase, dados);
        if (ok) { Utils.showToast("✅ Atualizado com sucesso!", "success"); fecharModalEditar(); }
        else { Utils.showToast("❌ Erro ao atualizar.", "error"); }
      } catch (err) { Utils.showToast("❌ Erro: " + (err.message || err), "error"); }
      finally { btnSalvar.disabled = false; btnSalvar.innerText = "💾 Salvar Alterações"; }
    };
  }
}

// ============================================================
// CATEGORIAS
// ============================================================
function atualizarSeletoresCategoria() {
  var cats = State.categorias || [];
  const contador = document.getElementById("contador-categorias");
  if (contador) contador.textContent = cats.length;
  const container = document.getElementById("lista-categorias-admin");
  if (container) {
    container.innerHTML = '';
    cats.forEach(cat => {
      const div = document.createElement("div");
      div.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:4px 10px; background:#f8f0f2; border-radius:6px; border:1px solid #e1cbd4;";
      div.innerHTML = '<span style="font-size:13px;">📁 ' + cat + '</span>' +
        '<button type="button" onclick="window.removerCategoria(\'' + String(cat).replace(/'/g, "\\'") + '\')" class="btn btn-danger" style="padding:2px 8px; font-size:10px; width:auto; margin-left:6px;">✕</button>';
      container.appendChild(div);
    });
  }
  const selectCat = document.getElementById("catalogo-peca-categoria");
  if (selectCat) {
    const va = selectCat.value; selectCat.innerHTML = '';
    cats.forEach(cat => { const opt = document.createElement("option"); opt.value = cat; opt.textContent = cat; selectCat.appendChild(opt); });
    if (cats.indexOf(va) !== -1) selectCat.value = va;
  }
  const selectRemover = document.getElementById("select-remover-categoria");
  if (selectRemover) {
    const va2 = selectRemover.value;
    selectRemover.innerHTML = '<option value="">Selecione...</option>';
    cats.forEach(cat => { const opt = document.createElement("option"); opt.value = cat; opt.textContent = cat; selectRemover.appendChild(opt); });
    if (cats.indexOf(va2) !== -1) selectRemover.value = va2;
  }
}

// ============================================================
// BUSCA SUGESTÕES
// ============================================================
function carregarSugestoesTemaFicha() {
  var input = document.getElementById("filtro-tema-input");
  if (!input) return;
  if (input.__tralalaBound) return;
  input.__tralalaBound = true;
  input.oninput = function(e) { renderSugestoesTemaFicha(e.target.value); };
  input.onfocus = function(e) { if (e.target.value.trim()) renderSugestoesTemaFicha(e.target.value); };
}

function renderSugestoesTemaFicha(termo) {
  var caixa = document.getElementById("wrapper-lista-sugestoes");
  if (!caixa) return;
  termo = (termo || "").toString().trim();
  if (!termo) { caixa.style.display = "none"; caixa.innerHTML = ""; return; }
  var tNorm = Utils.normalizar(termo);
  var filtrados = State.estoqueArray.filter(function(item) { return Utils.normalizar(item.nome || "").indexOf(tNorm) !== -1; });
  caixa.innerHTML = "";
  if (filtrados.length === 0) { caixa.style.display = "none"; return; }
  filtrados.forEach(function(item) {
    var div = document.createElement("div");
    div.className = "sugestao-item";
    div.innerHTML = "⚙️ " + item.nome + " <span style='font-size:11px;color:#888;'>(" + (item.categoria||'') + ") — " + Utils.formatCurrency(item.preco||0) + "</span>";
    div.onclick = function() {
      var input = document.getElementById("filtro-tema-input");
      var hidden = document.getElementById("busca-tema-input");
      if (input) input.value = item.nome;
      if (hidden) hidden.value = item.nome;
      State.temaAtual = item.nome;
      State.temaAtualObj = item;
      caixa.style.display = "none";
      Utils.showToast("Tema " + item.nome + " selecionado.", "info");
      atualizarResumoSelecao();
    };
    caixa.appendChild(div);
  });
  caixa.style.display = "block";
}

// ============================================================
// MODAL DE PEÇAS — AGRUPADO POR CATEGORIA
// ============================================================
let modalPecasContexto = "kit";

function abrirModalPecas(contexto) {
  modalPecasContexto = contexto || "kit";
  var modal = document.getElementById("modal-pecas");
  if (!modal) return;
  modal.classList.add("ativo");
  renderizarListaPecasModal(contexto, "");
  setTimeout(function() { var f = document.getElementById("filtro-pecas"); if (f) f.value = ""; }, 50);
}

window.__selecaoTempModalPecas = {
  selecionadas: [],
  quantidades: {}
};

function renderizarListaPecasModal(contexto, filtro) {
  var container = document.getElementById("lista-pecas-checkbox");
  if (!container) return;

  var selecionadasAtuais = [];
  var qtdAtuais = {};

  if (contexto === "kit") {
    selecionadasAtuais = State.kitCriando.pecas || [];
    qtdAtuais = State.kitCriando.pecasQtd || {};
  } else if (contexto === "contrato") {
    selecionadasAtuais = State.pecasSelecionadasContrato || [];
    qtdAtuais = State.pecasQtdContrato || {};
  } else if (contexto === "reserva") {
    selecionadasAtuais = State.pecasSelecionadasContrato || [];
    qtdAtuais = State.pecasQtdContrato || {};
  } else if (contexto === "kit-festa" && State.kitAtual) {
    selecionadasAtuais = State.pecasSelecionadasKit[State.kitAtual] || [];
    qtdAtuais = State.pecasQtdKit[State.kitAtual] || {};
  }

  var temp = window.__selecaoTempModalPecas;
  if (temp.selecionadas && temp.selecionadas.length > 0) {
    selecionadasAtuais.forEach(function(nome) {
      if (temp.selecionadas.indexOf(nome) === -1) temp.selecionadas.push(nome);
    });
    Object.keys(qtdAtuais).forEach(function(k) {
      if (!temp.quantidades[k]) temp.quantidades[k] = qtdAtuais[k];
    });
    selecionadasAtuais = temp.selecionadas;
    qtdAtuais = temp.quantidades;
  } else {
    temp.selecionadas = selecionadasAtuais.slice();
    temp.quantidades = Object.assign({}, qtdAtuais);
  }

  var fNorm = Utils.normalizar(filtro);
  var pecas = State.estoqueArray.filter(function(item) {
    if (!filtro.trim()) return true;
    return Utils.normalizar(item.nome || "").indexOf(fNorm) !== -1;
  });

  if (pecas.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#999; font-size:13px;">Nenhuma peça encontrada.</div>';
    return;
  }

  var grupos = {};
  pecas.forEach(function(item) {
    var cat = (item.categoria && String(item.categoria).trim()) || "Sem Categoria";
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(item);
  });

  var ordemPreferida = ["Maquete", "Louças de porcelana", "Painéis"];
  var catsOrdenadas = Object.keys(grupos).sort(function(a, b) {
    var ia = ordemPreferida.indexOf(a); var ib = ordemPreferida.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1; if (ib !== -1) return 1;
    return a.localeCompare(b, 'pt-BR');
  });

  var html = "";
  catsOrdenadas.forEach(function(cat) {
    var itens = grupos[cat];
    html += '<div class="categoria-header-modal"><span>📁 ' + cat + '</span><span class="badge-cat-modal">' + itens.length + ' peça' + (itens.length > 1 ? 's' : '') + '</span></div>';
    itens.forEach(function(item) {
      var nome = item.nome || "Sem nome";
      var checked = temp.selecionadas.indexOf(nome) !== -1 ? "checked" : "";
      var preco = Utils.formatCurrency(item.preco || 0);
      var categoria = item.categoria || "Geral";
      var disponivel = parseInt(item.quantidade) || 0;
      var qtdAtual = temp.quantidades[nome] || 1;
      var img = item.imagem ? '<img src="' + item.imagem + '" style="width:48px;height:48px;border-radius:6px;object-fit:cover;flex-shrink:0;">' : '<div style="width:48px;height:48px;background:#eee;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#888;flex-shrink:0;">Sem Foto</div>';
      html += '<label class="peca-check-item" style="align-items:flex-start; gap:10px; margin-bottom:4px;">' +
        '<input type="checkbox" value="' + nome.replace(/"/g, '&quot;') + '" ' + checked + ' style="margin-top:14px;" class="chk-peca-modal">' +
        img +
        '<div style="flex:1; margin-left:6px;">' +
          '<div class="nome-peca" style="font-weight:600;">' + nome + '</div>' +
          '<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">🏷️ ' + categoria + ' &nbsp;|&nbsp; 💰 ' + preco + ' &nbsp;|&nbsp; 📦 Disponível: <b>' + disponivel + '</b></div>' +
        '</div>' +
        '<div style="display:flex; flex-direction:column; align-items:center; gap:2px; margin-top:6px;">' +
          '<label style="font-size:10px; color:var(--text-muted); font-weight:600;">QTD</label>' +
          '<input type="number" class="qtd-peca-modal" data-peca="' + nome.replace(/"/g, '&quot;') + '" value="' + qtdAtual + '" min="1" max="' + disponivel + '" ' + (checked ? '' : 'disabled') + ' style="width:55px; padding:6px; border:1.5px solid #ddd; border-radius:6px; text-align:center; font-size:12px; font-weight:600; background:' + (checked ? '#fff' : '#f0f0f0') + ';">' +
        '</div>' +
      '</label>';
    });
  });

  container.innerHTML = html;

  var checkboxes = container.querySelectorAll('.chk-peca-modal');
  var contador = document.getElementById("contador-pecas-selecionadas");
  if (contador) contador.textContent = temp.selecionadas.length + " selecionadas";

  checkboxes.forEach(function(cb) {
    var nomePeca = cb.value;
    var inputQtd = container.querySelector('.qtd-peca-modal[data-peca="' + nomePeca.replace(/"/g, '\\"') + '"]');
    cb.onchange = function() {
      if (cb.checked) {
        if (temp.selecionadas.indexOf(nomePeca) === -1) temp.selecionadas.push(nomePeca);
        temp.quantidades[nomePeca] = inputQtd ? (parseInt(inputQtd.value) || 1) : 1;
      } else {
        var idx = temp.selecionadas.indexOf(nomePeca);
        if (idx !== -1) temp.selecionadas.splice(idx, 1);
        delete temp.quantidades[nomePeca];
      }
      if (inputQtd) {
        inputQtd.disabled = !cb.checked;
        inputQtd.style.background = cb.checked ? "#fff" : "#f0f0f0";
      }
      if (contador) contador.textContent = temp.selecionadas.length + " selecionadas";
    };
  });

  container.querySelectorAll('.qtd-peca-modal').forEach(function(inp) {
    inp.oninput = function() {
      var max = parseInt(inp.max) || 0;
      var val = parseInt(inp.value) || 0;
      if (val > max) { inp.value = max; Utils.showToast("⚠️ Máximo disponível: " + max, "warning"); }
      if (val < 1) inp.value = 1;
      var nomePeca = inp.getAttribute("data-peca");
      if (temp.selecionadas.indexOf(nomePeca) !== -1) temp.quantidades[nomePeca] = parseInt(inp.value) || 1;
    };
  });
}

function confirmarModalPecas() {
  var container = document.getElementById("lista-pecas-checkbox");
  var selecionadas = [];
  var qtdSelecionadas = {};
  var temp = window.__selecaoTempModalPecas;

  if (container) {
    container.querySelectorAll('.chk-peca-modal').forEach(function(cb) {
      var nome = cb.value;
      var inp = container.querySelector('.qtd-peca-modal[data-peca="' + nome.replace(/"/g, '\\"') + '"]');
      var qtd = inp ? (parseInt(inp.value) || 1) : 1;
      if (cb.checked) {
        if (temp.selecionadas.indexOf(nome) === -1) temp.selecionadas.push(nome);
        temp.quantidades[nome] = qtd;
      } else {
        var idx = temp.selecionadas.indexOf(nome);
        if (idx !== -1) temp.selecionadas.splice(idx, 1);
        delete temp.quantidades[nome];
      }
    });
  }

  selecionadas = temp.selecionadas.slice();
  qtdSelecionadas = Object.assign({}, temp.quantidades);

  if (modalPecasContexto === "kit") {
    State.kitCriando.pecas = selecionadas;
    State.kitCriando.pecasQtd = qtdSelecionadas;
    atualizarInfoKitCriando();
    Utils.showToast("✅ " + selecionadas.length + " peça(s) selecionada(s)", "success");
  } else if (modalPecasContexto === "contrato") {
    State.pecasSelecionadasContrato = selecionadas;
    State.pecasQtdContrato = qtdSelecionadas;
    var selectPecas = document.getElementById("c-pecas");
    if (selectPecas) {
      for (var i = 0; i < selectPecas.options.length; i++) {
        selectPecas.options[i].selected = selecionadas.indexOf(selectPecas.options[i].value) !== -1;
      }
    }
    var info = document.getElementById("c-pecas-info");
    if (info) info.textContent = selecionadas.length + " peça(s) selecionada(s).";
    Utils.showToast("✅ " + selecionadas.length + " peça(s) no contrato", "success");
  } else if (modalPecasContexto === "reserva") {
    var idReserva = window.__reservaEditandoPecas;
    if (!idReserva) {
      Utils.showToast("Reserva não identificada.", "error");
    } else {
      ModalStatus.exibir("ATUALIZANDO PEÇAS...", "Salvando no agendamento.");
      Database.atualizarReservaNuvem(idReserva, { pecas: selecionadas, pecasQtd: qtdSelecionadas, atualizadoEm: Date.now() })
      .then(function() { ModalStatus.sucesso("✓ PEÇAS ATUALIZADAS"); window.__reservaEditandoPecas = null; })
      .catch(function(err) { ModalStatus.erro("Erro ao atualizar peças."); });
    }
  } else if (modalPecasContexto === "kit-festa" && State.kitAtual) {
    State.pecasSelecionadasKit[State.kitAtual] = selecionadas;
    State.pecasQtdKit[State.kitAtual] = qtdSelecionadas;
    atualizarInfoKitFesta();
    atualizarResumoSelecao();
    Utils.showToast("✅ " + selecionadas.length + " peça(s) salva(s) no " + State.kitAtual, "success");
  }

  window.__selecaoTempModalPecas = { selecionadas: [], quantidades: {} };
  document.getElementById("modal-pecas").classList.remove("ativo");
}

// ============================================================
// MODAL DE TEMA
// ============================================================
let modalTemaContexto = "kit-festa";

function abrirModalTema(contexto) {
  modalTemaContexto = contexto || "kit-festa";
  var modal = document.getElementById("modal-tema-reserva");
  if (!modal) return;
  modal.classList.add("ativo");
  renderizarListaTemasModal("");
}

function renderizarListaTemasModal(filtro) {
  var container = document.getElementById("lista-temas-modal");
  if (!container) return;
  if (!filtro) filtro = "";
  var selecionadoAtual = "";
  if (modalTemaContexto === "kit-festa" && State.kitAtual) selecionadoAtual = State.temasSelecionadosKit[State.kitAtual] || "";
  else if (modalTemaContexto === "kit") selecionadoAtual = (State.kitCriando.temas && State.kitCriando.temas[0]) || "";
  var fNorm = Utils.normalizar(filtro);
  var filtrados = State.estoqueArray.filter(function(item) {
    if (!filtro.trim()) return true;
    return Utils.normalizar(item.nome || "").indexOf(fNorm) !== -1;
  });
  if (filtrados.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#999; font-size:13px;">Nenhum tema encontrado.</div>';
    return;
  }
  var html = "";
  filtrados.forEach(function(item) {
    var nome = item.nome || "Sem nome";
    var selClass = (selecionadoAtual === nome) ? " selecionado" : "";
    html += '<div class="item-tema-selecionavel' + selClass + '" data-tema="' + nome.replace(/"/g, '&quot;') + '">⚙️ ' + nome + ' <span style="font-size:11px;color:var(--text-muted);">(' + (item.categoria || 'Geral') + ') ' + Utils.formatCurrency(item.preco||0) + '</span></div>';
  });
  container.innerHTML = html;
  container.querySelectorAll('.item-tema-selecionavel').forEach(function(el) {
    el.onclick = function() {
      container.querySelectorAll('.item-tema-selecionavel').forEach(function(x) { x.classList.remove('selecionado'); });
      el.classList.add('selecionado');
    };
  });
}

function confirmarModalTema() {
  var container = document.getElementById("lista-temas-modal");
  if (!container) return;
  var selecionado = container.querySelector('.item-tema-selecionavel.selecionado');
  if (!selecionado) return Utils.showToast("Clique em um tema antes de confirmar.", "warning");
  var tema = selecionado.getAttribute("data-tema");
  if (modalTemaContexto === "kit-festa" && State.kitAtual) {
    State.temasSelecionadosKit[State.kitAtual] = tema;
    var filtro = document.getElementById("filtro-tema-input");
    var hidden = document.getElementById("busca-tema-input");
    if (filtro) filtro.value = tema;
    if (hidden) hidden.value = tema;
    State.temaAtual = tema;
    State.temaAtualObj = State.estoqueMap[tema] || null;
    atualizarInfoKitFesta();
    atualizarResumoSelecao();
    Utils.showToast("✅ Tema \"" + tema + "\" selecionado", "success");
  } else if (modalTemaContexto === "kit") {
    State.kitCriando.temas = [tema];
    atualizarInfoKitCriando();
    Utils.showToast("✅ Tema \"" + tema + "\"", "success");
  }
  document.getElementById("modal-tema-reserva").classList.remove("ativo");
}

function atualizarInfoKitFesta() {
  var info = document.getElementById("kit-acoes-info");
  if (!info) return;
  if (!State.kitAtual) { info.textContent = "Nenhuma peça selecionada ainda"; return; }
  var pecas = State.pecasSelecionadasKit[State.kitAtual] || [];
  var tema = State.temasSelecionadosKit[State.kitAtual] || "";
  var partes = [];
  if (pecas.length > 0) partes.push(pecas.length + " peça(s)");
  if (tema) partes.push("Tema: " + tema);
  info.textContent = partes.length > 0 ? partes.join(" | ") : "Nenhuma peça selecionada ainda";
}

function atualizarInfoKitCriando() {
  var info = document.getElementById("kit-info-selecao");
  if (!info) return;
  var pecas = State.kitCriando.pecas || [];
  var temas = State.kitCriando.temas || [];
  var partes = [];
  if (pecas.length > 0) partes.push("📦 Peças: " + pecas.length);
  if (temas.length > 0) partes.push("🎨 Tema: " + temas.join(", "));
  info.innerHTML = partes.length > 0 ? partes.join(" | ") : "Nenhuma peça ou tema selecionado ainda.";
}

// ============================================================
// RESUMO E SOMA
// ============================================================
function atualizarResumoSelecao() {
  var box = document.getElementById("resumo-selecao");
  var content = document.getElementById("resumo-temas-pecas");
  if (!box || !content) return;
  var html = ""; var temAlgo = false;
  if (State.temaAtual) {
    temAlgo = true;
    var itemT = State.estoqueMap[State.temaAtual];
    var precoT = itemT ? (itemT.preco || 0) : 0;
    html += '<div style="margin-bottom:6px;">🎨 <b>Tema:</b> ' + State.temaAtual + ' — ' + Utils.formatCurrency(precoT) + '</div>';
  }
  if (State.kitAtual && State.pecasSelecionadasKit[State.kitAtual]) {
    var pecas = State.pecasSelecionadasKit[State.kitAtual];
    if (pecas.length > 0) {
      temAlgo = true;
      html += '<div style="margin-bottom:6px;">📦 <b>Peças (' + State.kitAtual + '):</b><br>';
      pecas.forEach(function(nome) {
        var item = State.estoqueMap[nome];
        var preco = item ? (item.preco || 0) : 0;
        html += '&nbsp;&nbsp;• ' + nome + ' — ' + Utils.formatCurrency(preco) + '<br>';
      });
      html += '</div>';
    }
  }
  if (!temAlgo) { box.style.display = "none"; return; }
  content.innerHTML = html;
  box.style.display = "block";
}

function calcularSomaAutomatica() {
  var total = 0; var detalhes = "";
  if (State.temaAtual) {
    var itemT = State.estoqueMap[State.temaAtual];
    if (itemT) { var precoT = parseFloat(itemT.preco) || 0; total += precoT; detalhes += "🎨 Tema " + itemT.nome + ": " + Utils.formatCurrency(precoT) + "<br>"; }
  }
  if (State.kitAtual && State.pecasSelecionadasKit[State.kitAtual]) {
    var pecas = State.pecasSelecionadasKit[State.kitAtual];
    pecas.forEach(function(nome) {
      var item = State.estoqueMap[nome];
      if (item) { var p = parseFloat(item.preco) || 0; total += p; detalhes += "📦 " + nome + ": " + Utils.formatCurrency(p) + "<br>"; }
    });
  }
  State.somaAutomatica = total;
  var div = document.getElementById("detalhes-soma");
  if (div) div.innerHTML = detalhes + '<div style="margin-top:8px; padding-top:8px; border-top:1px solid #ccc;"><b>Subtotal: ' + Utils.formatCurrency(total) + '</b></div>';
  var inputValorFesta = document.getElementById("valor-festa");
  if (inputValorFesta) { inputValorFesta.value = total.toFixed(2); recalcularTotais(); }
  Utils.showToast("Soma calculada: " + Utils.formatCurrency(total), "success");
}

function aplicarDesconto() {
  var tipoEl = document.getElementById("desconto-tipo");
  var valorEl = document.getElementById("desconto-valor");
  if (!tipoEl || !valorEl) return;
  var tipo = tipoEl.value;
  var valor = parseFloat(valorEl.value) || 0;
  var inputValorFesta = document.getElementById("valor-festa");
  var original = inputValorFesta ? (parseFloat(inputValorFesta.value) || 0) : 0;
  var desconto = 0;
  if (tipo === "percent") desconto = original * (valor / 100); else desconto = valor;
  if (desconto > original) desconto = original;
  if (desconto < 0) desconto = 0;
  var final = original - desconto;
  State.descontoAplicado = { tipo: tipo, valor: valor, totalOriginal: original, totalFinal: final };
  var resultado = document.getElementById("resultado-desconto");
  if (resultado) {
    resultado.innerHTML = '<div>💵 Valor original: <b>' + Utils.formatCurrency(original) + '</b></div>' +
      '<div>🏷️ Desconto: <b style="color:#e74c3c;">- ' + Utils.formatCurrency(desconto) + '</b></div>' +
      '<div style="margin-top:5px;">✅ Valor com desconto: <b style="color:#27ae60; font-size:15px;">' + Utils.formatCurrency(final) + '</b></div>';
  }
  if (inputValorFesta) { inputValorFesta.value = final.toFixed(2); recalcularTotais(); }
  Utils.showToast("Desconto aplicado!", "success");
}

// ============================================================
// RESERVAS — COM BOTÕES EDITAR/PEÇAS
// ============================================================
function renderReservas(filtro) {
  if (!filtro) filtro = "";
  var container = document.getElementById("lista-reservas-render");
  if (!container) return;
  container.innerHTML = "";
  if (State.carregando) { container.innerHTML = "<div style='text-align:center; padding:20px;'>⌛ Carregando...</div>"; return; }
  if (State.reservas.length === 0) { container.innerHTML = "<div style='text-align:center; padding:20px; color:#777;'>Nenhum agendamento.</div>"; return; }

  var arr = State.reservas.slice().sort(function(a, b) { return new Date(a.data || 0) - new Date(b.data || 0); });
  if (filtro.trim() !== "") {
    var f = Utils.normalizar(filtro);
    arr = arr.filter(function(r) { return Utils.normalizar(r.cliente).indexOf(f) !== -1 || Utils.normalizar(r.tema).indexOf(f) !== -1; });
  }

  var hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  arr.forEach(function(res) {
    var card = document.createElement("div");
    card.className = "card-reserva";
    var total = parseFloat(res.total) || 0;
    var sinal = parseFloat(res.sinal) || 0;
    var frete = parseFloat(res.frete) || 0;
    var totGeral = total + frete;
    var devedor = totGeral - sinal;
    var quitado = devedor <= 0;
    var pecas = Array.isArray(res.pecas) ? res.pecas : [];

    var dataReserva = res.data ? new Date(res.data + "T00:00:00") : null;
    var dataPassou = dataReserva && dataReserva < hoje;
    var jaDevolvido = !!res.itensDevolvidos;

    var pecasHtml = "";
    if (pecas.length > 0) {
      var seloOuBotao = "";
      if (dataPassou && jaDevolvido) {
        seloOuBotao = '<span style="float:right; background:#27ae60; color:#fff; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600;">✅ Itens devolvidos</span>';
      }

      pecasHtml = '<div style="margin-top:10px; padding-top:10px; border-top:1px dashed #e1cbd4;">' +
        '<p style="margin:0 0 6px 0; font-size:12px; color:var(--text-muted);"><b>🧩 Peças do tema:</b>' + seloOuBotao + '</p>' +
        '<div style="display:flex; flex-wrap:wrap; gap:5px;">';

      pecas.forEach(function(nome) {
        var item = State.estoqueMap[nome];
        var qtdReservada = res.pecasQtd && res.pecasQtd[nome] ? res.pecasQtd[nome] : 1;
        var img = item && item.imagem ? '<img src="' + item.imagem + '" style="width:30px;height:30px;border-radius:4px;object-fit:cover;flex-shrink:0;">' : '<div style="width:30px;height:30px;background:#eee;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#888;flex-shrink:0;">?</div>';
        pecasHtml += '<div style="display:inline-flex; align-items:center; gap:5px; background:#f8f0f2; padding:4px 8px; border-radius:14px; font-size:11px; border:1px solid #e1cbd4;">' + img + '<span>' + nome + ' <b>(' + qtdReservada + 'x)</b></span></div>';
      });
      pecasHtml += '</div>';

      if (dataPassou && !jaDevolvido) {
        pecasHtml += '<button type="button" onclick="window.RegistrarDevolucao(\'' + res.id + '\')" ' +
          'style="width:100%; margin-top:10px; padding:11px; background:#27ae60; color:#fff; border:none; ' +
          'border-radius:6px; cursor:pointer; font-weight:600; font-size:13px;">' +
          '📦 Registrar Devolução</button>';
      }
      pecasHtml += '</div>';
    }

    card.innerHTML = '<div class="reserva-header"><strong>👶 ' + (res.cliente || '') + '</strong>' +
      '<span class="reserva-badge" style="background:' + (quitado ? '#27ae60' : '#e67e22') + ';">' + (quitado ? 'PAGO 100%' : 'PENDENTE') + '</span></div>' +
      '<div class="reserva-body">' +
      '<p>📅 Data: <b>' + Utils.formatDateBR(res.data) + '</b></p>' +
      '<p>🆔 CPF: <b>' + (res.cpf || '—') + '</b></p>' +
      '<p>🎨 Tema: <b style="color:var(--primary);">' + (res.tema || '') + '</b></p>' +
      '<p>🛍️ Kit: <b>' + (res.kit || 'Não informado') + '</b></p>' +
      (res.montarNoLocal ? '<p>🛠️ Montagem: <b style="color:#27ae60;">SIM</b></p>' : '') +
   
