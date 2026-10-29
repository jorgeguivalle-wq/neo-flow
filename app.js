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
function renderReservas(filtro, opcoes) {
  opcoes = opcoes || {};
  if (!filtro) filtro = "";
  var container = opcoes.container || document.getElementById("lista-reservas-render");
  if (!container) return;
  container.innerHTML = "";
  if (State.carregando) { container.innerHTML = "<div style='text-align:center; padding:20px;'>⌛ Carregando...</div>"; return; }
  if (State.reservas.length === 0) { container.innerHTML = "<div style='text-align:center; padding:20px; color:#777;'>Nenhum agendamento.</div>"; return; }

  var arr = State.reservas.slice().sort(function(a, b) { return new Date(a.data || 0) - new Date(b.data || 0); });
  if (filtro.trim() !== "") {
    var f = Utils.normalizar(filtro);
    arr = arr.filter(function(r) { return Utils.normalizar(r.cliente).indexOf(f) !== -1 || Utils.normalizar(r.tema).indexOf(f) !== -1; });
  }


if (opcoes.ids) {
  var idsPermitidos = opcoes.ids.map(String);

  arr = arr.filter(function(r) {
    return idsPermitidos.includes(String(r.id));
  });
} else {
  var idsNasPastas = new Set(
    pastasAgendamento.flatMap(function(p) {
      return normalizarIdsPasta(p.cards);
    })
  );

  arr = arr.filter(function(r) {
    return !idsNasPastas.has(String(r.id));
  });
}

  if (!arr.length) container.innerHTML = "<p style='text-align:center;color:#777'>Nenhum agendamento nesta lista.</p>";

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
      '<p>🚚 Frete: <b>' + Utils.formatCurrency(frete) + '</b></p>' +
      '<p>💰 Total: <b>' + Utils.formatCurrency(totGeral) + '</b></p>' +
      '<p>💵 Sinal: <b>' + Utils.formatCurrency(sinal) + '</b></p>' +
      '<p style="color:' + (quitado ? 'green' : 'red') + '">⚠️ Falta: <b>' + Utils.formatCurrency(devedor) + '</b></p>' +
      pecasHtml + '</div>' +
      '<div style="display:flex; gap:6px; margin-top:12px; flex-wrap:wrap;">' +
      '<button type="button" style="flex:2; min-width:120px; padding:11px; background:#e67e22; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px;" onclick="window.GerarContratoReserva(\'' + res.id + '\')">✍️ Gerar Contrato</button>' +
      '<button type="button" style="flex:1; min-width:90px; padding:11px; background:#9b59b6; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px;" onclick="window.EditarPecasReserva(\'' + res.id + '\')" title="Editar Peças">🍽️ Peças</button>' +
      '<button type="button" style="flex:1; min-width:70px; padding:11px; background:#3498db; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px;" onclick="window.AbrirEditarReserva(\'' + res.id + '\')" title="Editar">✏️ Editar</button>' +
      '<button type="button" style="flex:1; min-width:70px; padding:11px; background:var(--error); color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px;" onclick="window.DeletarReserva(\'' + res.id + '\')" title="Excluir">🗑️</button>' +
      '</div>';
    container.appendChild(card);
  });
}

window.DeletarReserva = function(idReserva) {
  if (confirm("Excluir este agendamento?")) {
    Database.excluirReservaNuvem(idReserva).then(function() { Utils.showToast("Agendamento removido!", "success"); }).catch(function() { Utils.showToast("Falha ao remover.", "error"); });
  }
};

// ============================================================
// REGISTRAR DEVOLUÇÃO DE PEÇAS
// ============================================================
window.RegistrarDevolucao = function(idReserva) {
  var res = State.reservas.filter(function(r) { return r.id === idReserva; })[0];
  if (!res) return Utils.showToast("Reserva não encontrada.", "error");
  if (res.itensDevolvidos) return Utils.showToast("Essa reserva já foi devolvida.", "info");

  var pecas = Array.isArray(res.pecas) ? res.pecas : [];
  if (pecas.length === 0) {
    ModalStatus.exibir("MARCANDO COMO DEVOLVIDO...", res.cliente);
    Database.atualizarReservaNuvem(idReserva, { itensDevolvidos: true, dataDevolucao: Utils.getHojeDataString(), atualizadoEm: Date.now() })
    .then(function() { ModalStatus.sucesso("✓ ITENS DEVOLVIDOS"); })
    .catch(function(err) { ModalStatus.erro("Erro ao registrar devolução."); });
    return;
  }

  if (!confirm('📦 Confirmar devolução das peças?\n\n' + pecas.map(function(nome) {
    var qtd = res.pecasQtd && res.pecasQtd[nome] ? res.pecasQtd[nome] : 1;
    return '• ' + nome + ' (' + qtd + 'x)';
  }).join('\n') + '\n\nTodas as peças voltarão ao estoque.')) return;

  ModalStatus.exibir("DEVOLVENDO PEÇAS...", res.cliente);
  var promises = [];
  pecas.forEach(function(nomePeca) {
    var item = State.estoqueMap[nomePeca];
    if (item && item.idFirebase) {
      var qtdDevolvida = res.pecasQtd && res.pecasQtd[nomePeca] ? parseInt(res.pecasQtd[nomePeca]) : 1;
      var qtdAtual = parseInt(item.quantidade) || 0;
      var novaQtd = qtdAtual + qtdDevolvida;
      promises.push(Database.atualizarPecaNuvem(item.idFirebase, { quantidade: novaQtd }));
    }
  });

  Promise.all(promises).then(function() {
    return Database.atualizarReservaNuvem(idReserva, { itensDevolvidos: true, dataDevolucao: Utils.getHojeDataString(), atualizadoEm: Date.now() });
  }).then(function() {
    ModalStatus.sucesso("✓ ITENS DEVOLVIDOS AO ESTOQUE");
    Utils.showToast("✅ " + pecas.length + " peça(s) devolvida(s) ao estoque!", "success", 4000);
  }).catch(function(err) { ModalStatus.erro("Erro ao devolver peças."); });
};

// ============================================================
// EDITAR RESERVA
// ============================================================
window.AbrirEditarReserva = function(idReserva) {
  var res = State.reservas.filter(function(r) { return r.id === idReserva; })[0];
  if (!res) return Utils.showToast("Reserva não encontrada.", "error");
  document.getElementById("edit-reserva-id").value = res.id;
  document.getElementById("edit-cliente").value = res.cliente || "";
  document.getElementById("edit-cpf").value = res.cpf || "";
  document.getElementById("edit-telefone").value = res.telefone || "";
  document.getElementById("edit-data").value = res.data || "";
  document.getElementById("edit-endereco").value = res.endereco || "";
  document.getElementById("edit-local").value = res.local || "";
  document.getElementById("edit-tema").value = res.tema || "";
  document.getElementById("edit-kit").value = res.kit || "";
  document.getElementById("edit-total").value = res.total || 0;
  document.getElementById("edit-sinal").value = res.sinal || 0;
  document.getElementById("edit-frete").value = res.frete || 0;
  document.getElementById("edit-obs").value = res.obs || "";
  document.getElementById("modal-editar-reserva").classList.add("ativo");
};

window.SalvarEditarReserva = function() {
  var id = document.getElementById("edit-reserva-id").value;
  if (!id) return Utils.showToast("ID não encontrado.", "error");
  var dados = {
    cliente: safe(document.getElementById("edit-cliente").value.trim()),
    cpf: safe(document.getElementById("edit-cpf").value.trim()),
    telefone: safe(document.getElementById("edit-telefone").value.trim()),
    data: safe(document.getElementById("edit-data").value),
    endereco: safe(document.getElementById("edit-endereco").value.trim()),
    local: safe(document.getElementById("edit-local").value.trim()),
    tema: safe(document.getElementById("edit-tema").value.trim()),
    kit: safe(document.getElementById("edit-kit").value.trim()),
    total: safe(document.getElementById("edit-total").value || "0"),
    sinal: safe(document.getElementById("edit-sinal").value || "0"),
    frete: safe(document.getElementById("edit-frete").value || "0"),
    obs: safe(document.getElementById("edit-obs").value.trim()),
    atualizadoEm: Date.now()
  };
  ModalStatus.exibir("SALVANDO ALTERAÇÕES...", dados.cliente);
  Database.atualizarReservaNuvem(id, dados)
    .then(function() {
      ModalStatus.sucesso("✓ RESERVA ATUALIZADA");
      document.getElementById("modal-editar-reserva").classList.remove("ativo");
    })
    .catch(function(err) { ModalStatus.erro("Erro ao salvar."); });
};

// ============================================================
// GERAR CONTRATO DA RESERVA
// ============================================================
window.GerarContratoReserva = function(idReserva) {
  var res = State.reservas.filter(function(r) { return r.id === idReserva; })[0];
  if (!res) return Utils.showToast("Reserva não encontrada.", "error");
  var resposta = prompt("Qual o modelo do contrato?\n\nDigite 1 para: 🏠 PEGUE E MONTE\nDigite 2 para: 📦 COM FRETE\nDigite 3 para: 🏬 PEGUE E MONTE (LOJA)\n\n(Padrão: 1)", "1");
  if (resposta === null) return;
  var r = resposta.trim();
  var tipoModelo = "pegue-monte";
  if (r === "2") tipoModelo = "com-frete";
  else if (r === "3") tipoModelo = "pegue-monte-loja";
  var dadosContrato = {
    nome: safe(res.cliente), cpf: safe(res.cpf), telefone: safe(res.telefone),
    endereco: safe(res.endereco), local: safe(res.local), data: safe(res.data),
    horario: "", valor: parseFloat(res.total) || 0,
    sinal: parseFloat(res.sinal) || 0, frete: parseFloat(res.frete) || 0,
    pecas: Array.isArray(res.pecas) ? res.pecas : [],
    pecasQtd: res.pecasQtd || null, tema: safe(res.tema), obs: safe(res.obs)
  };
  var htmlContrato;
  if (tipoModelo === "com-frete") htmlContrato = gerarContratoComFrete(dadosContrato);
  else if (tipoModelo === "pegue-monte-loja") htmlContrato = gerarContratoPegueMonteLoja(dadosContrato);
  else htmlContrato = gerarContratoPegueMonte(dadosContrato);
  Database.salvarContratoNuvem({
    nome: safe(res.cliente), cpf: safe(res.cpf), telefone: safe(res.telefone),
    endereco: safe(res.endereco), local: safe(res.local), data: safe(res.data),
    valor: parseFloat(res.total) || 0, modelo: tipoModelo,
    tema: safe(res.tema), pecas: Array.isArray(res.pecas) ? res.pecas : [],
    obs: safe(res.obs), criadoEm: Date.now()
  }).catch(function(err) { console.warn("Contrato não salvo na nuvem:", err); });
  var preview = document.getElementById("contrato-preview-content");
  if (preview) {
    preview.innerHTML = htmlContrato;
    preview.contentEditable = "false";
    preview.style.outline = "";
    preview.style.padding = "";
    preview.style.borderRadius = "";
  }
  document.getElementById("btn-editar-contrato").style.display = "inline-flex";
  document.getElementById("btn-salvar-edicao-contrato").style.display = "none";
  document.getElementById("btn-add-nota-promissoria").style.display = "inline-flex";
  window.__contratoTipo = tipoModelo;
  var modalVis = document.getElementById("modal-visualizar-contrato");
  if (modalVis) modalVis.classList.add("ativo");
  Utils.showToast("Contrato gerado!", "success");
};

// ============================================================
// ORÇAMENTOS
// ============================================================
function renderOrcamentos() {
  var containers = [document.getElementById("lista-orcamentos-render"), document.getElementById("lista-orcamentos-interno-corpo")].filter(Boolean);
  if (containers.length === 0) return;
  containers.forEach(function(container) {
    container.innerHTML = "";
    if (State.orcamentos.length === 0) {
      if (container.tagName === "TBODY") { container.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#777;">Nenhum orçamento.</td></tr>'; }
      else { container.innerHTML = "<div style='text-align:center; padding:20px; color:#777;'>Nenhum orçamento.</div>"; }
      return;
    }
    var isTbody = container.tagName === "TBODY";
    var html = "";
    State.orcamentos.forEach(function(orc) {
      var totalFmt = Utils.formatCurrency(orc.total);
      if (isTbody) {
        html += '<tr><td>' + (orc.cliente || '') + '</td><td>' + (orc.tema || '') + (orc.kit ? ' / ' + orc.kit : '') + '</td><td>' + totalFmt + '</td>' +
          '<td style="text-align:center;"><button type="button" onclick="window.PromoverOrcamento(\'' + orc.id + '\')" class="btn-acao-tabela btn-promover" title="Promover">✅</button>' +
          '<button type="button" onclick="window.ExcluirOrcamento(\'' + orc.id + '\')" class="btn-acao-tabela btn-remover-orc" title="Excluir">🗑️</button></td></tr>';
      } else {
        html += '<div class="card-reserva"><div class="reserva-header"><strong>👤 ' + (orc.cliente || '') + '</strong></div><div class="reserva-body">' +
          '<p>📅 Data: <b>' + Utils.formatDateBR(orc.dataFesta) + '</b></p><p>🎨 Tema: <b>' + (orc.tema || '') + '</b></p>' +
          (orc.kit ? '<p>🛍️ Kit: <b>' + orc.kit + '</b></p>' : '') + '<p>💰 Total: <b>' + totalFmt + '</b></p></div></div>';
      }
    });
    container.innerHTML = html;
  });
}

window.ExcluirOrcamento = function(idOrcamento) {
  if (confirm("Excluir este orçamento?")) {
    Database.excluirOrcamentoNuvem(idOrcamento).then(function() { Utils.showToast("Orçamento removido!", "success"); }).catch(function() { Utils.showToast("Falha ao remover.", "error"); });
  }
};

window.PromoverOrcamento = function(idOrcamento) {
  var orc = State.orcamentos.filter(function(o) { return o.id === idOrcamento; })[0];
  if (!orc) return;
  var elCliente = document.getElementById("nome-cliente");
  var elCpf = document.getElementById("cliente-cpf");
  var elData = document.getElementById("data");
  var elTotal = document.getElementById("valor-total");
  var elValorFesta = document.getElementById("valor-festa");
  var elObs = document.getElementById("adicionais-festa");
  var hidden = document.getElementById("busca-tema-input");
  var filtro = document.getElementById("filtro-tema-input");
  if (elCliente) elCliente.value = orc.cliente || "";
  if (elCpf) elCpf.value = orc.cpf || "";
  if (elData && orc.dataFesta) elData.value = orc.dataFesta;
  if (elTotal) elTotal.value = orc.total || "";
  if (elValorFesta) elValorFesta.value = orc.valorFesta || "";
  if (elObs) elObs.value = orc.obs || "";
  if (orc.tema) {
    if (hidden) hidden.value = orc.tema;
    if (filtro) filtro.value = orc.tema;
    State.temaAtual = orc.tema;
    State.temaAtualObj = State.estoqueMap[orc.tema] || null;
  }
  if (orc.kit) {
    State.kitAtual = orc.kit;
    document.querySelectorAll('.btn-kit-opcao').forEach(function(b) { b.classList.toggle('ativo', b.getAttribute('data-kit') === orc.kit); });
    var box = document.getElementById("kit-acoes-box");
    var nome = document.getElementById("kit-acoes-nome");
    if (box) box.classList.add("ativo");
    if (nome) nome.textContent = orc.kit;
  }
  if (orc.freteKmIda) {
    var kmEl = document.getElementById("calc-km");
    var precoEl = document.getElementById("calc-valor-litro");
    var chkSegunda = document.getElementById("chk-segunda-viagem");
    if (kmEl) kmEl.value = orc.freteKmIda;
    if (precoEl && orc.fretePrecoCombustivel) precoEl.value = orc.fretePrecoCombustivel;
    if (chkSegunda) chkSegunda.checked = !!orc.freteSegundaViagem;
    FreteCalc.renderizar();
  }
  Utils.showToast("Orçamento carregado. Revise e confirme.", "success");
  var painelOrc = document.getElementById("painel-orcamentos-salvos");
  if (painelOrc) painelOrc.style.display = "none";
  window.scrollTo({ top: 0, behavior: 'smooth' });
  atualizarResumoSelecao();
};

// ============================================================
// REUNIÕES
// ============================================================
function iniciarPainelReunioes() {
  if (!db) return;
  db.ref('reunioes').on('value', function(snap) {
    var val = snap.val(); var arr = [];
    if (val && typeof val === 'object') {
      Object.keys(val).forEach(function(id) {
        if (val[id]) { var copy = { id: id }; for (var k in val[id]) { if (val[id].hasOwnProperty(k)) copy[k] = val[id][k]; } arr.push(copy); }
      });
    }
    arr.sort(function(a, b) { return new Date(a.dataHora || 0) - new Date(b.dataHora || 0); });
    var container = document.getElementById("lista-reunioes-container");
    if (!container) return;
    if (arr.length === 0) { container.innerHTML = '<p style="color:#999; text-align:center;">Nenhuma reunião agendada.</p>'; return; }
    var html = "";
    arr.forEach(function(r) {
      var dataFmt = r.dataHora ? r.dataHora.replace('T', ' às ') : 'Não informada';
      html += '<div class="card-reuniao" style="border-left-color:#27ae60;">' +
        '<div class="reserva-header"><strong>👤 ' + (r.cliente || 'Sem nome') + '</strong><span class="reserva-badge" style="background:#27ae60;">AGENDADA</span></div>' +
        '<div class="reserva-body"><p>📅 ' + dataFmt + '</p>' + (r.pauta ? '<p>📝 ' + r.pauta + '</p>' : '') + '</div>' +
        '<button type="button" style="width:100%; padding:6px; margin-top:8px; background:#e74c3c; color:#fff; border:none; border-radius:4px; cursor:pointer;" onclick="window.ExcluirReuniao(\'' + r.id + '\')">🗑️ Excluir</button></div>';
    });
    container.innerHTML = html;
  });
}

window.ExcluirReuniao = function(idReuniao) {
  if (confirm("Excluir esta reunião?")) {
    Database.excluirReuniaoNuvem(idReuniao).then(function() { Utils.showToast("Reunião removida!", "success"); }).catch(function() { Utils.showToast("Falha ao remover.", "error"); });
  }
};

// ============================================================
// PLANILHA E GRÁFICO
// ============================================================
function renderPlanilhaVendas() {
  var tbody = document.querySelector("#tabela-planilha-corpo tbody");
  if (!tbody) return;
  var mesSelecionado = (document.getElementById("seletor-mes-planilha") || {}).value || "";
  var reservasDoMes = State.reservas.filter(function(r) {
    if (!r.data) return false;
    var p = r.data.split("-");
    if (p.length !== 3) return false;
    var idx = parseInt(p[1]) - 1;
    return mesesAno[idx] === mesSelecionado;
  });
  if (reservasDoMes.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999; padding:15px;">Nenhuma venda neste mês.</td></tr>'; return; }
  var html = "";
  reservasDoMes.forEach(function(r) {
    var total = parseFloat(r.total) || 0;
    var frete = parseFloat(r.frete) || 0;
    html += '<tr><td>' + (r.cliente || '') + '</td><td>' + (r.kit || 'Não informado') + '</td><td>R$ ' + (total + frete).toFixed(2) + '</td><td style="text-align:center;">—</td></tr>';
  });
  tbody.innerHTML = html;
}

function renderGraficoAnual() {
  if (typeof Chart === 'undefined') return;
  var painel = document.getElementById('painel-grafico-faturamento');
  if (painel) painel.style.display = 'block';
  var ctx = document.getElementById('graficoAnual');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();
  var valores = new Array(12).fill(0);
  State.reservas.forEach(function(r) {
    if (!r.data) return;
    var p = r.data.split("-");
    if (p.length !== 3) return;
    var idx = parseInt(p[1]) - 1;
    if (idx >= 0 && idx < 12) valores[idx] += (parseFloat(r.total) || 0) + (parseFloat(r.frete) || 0);
  });
  chartInstance = new Chart(ctx, { type: 'bar', data: { labels: mesesAno, datasets: [{ label: 'Faturamento (R$)', data: valores, backgroundColor: '#a3536a' }] }, options: { responsive: true, maintainAspectRatio: false } });
}

function renderRelatorioGeralPontos(dadosPontos) {
  var container = document.querySelector("#lista-pontos-geral-corpo");
  if (!container) return;
  var html = ""; var tem = false;
  for (var usuario in dadosPontos) {
    if (dadosPontos.hasOwnProperty(usuario)) {
      var dias = dadosPontos[usuario];
      for (var dia in dias) {
        if (dias.hasOwnProperty(dia)) {
          tem = true;
          var p = dias[dia];
          html += '<tr><td>' + usuario.replace(/_/g, ".") + '</td><td>' + Utils.formatDateBR(dia) + '</td>' +
            '<td style="color:var(--success);">' + (p.entrada || "--:--") + '</td><td style="color:var(--error);">' + (p.saida || "--:--") + '</td></tr>';
        }
      }
    }
  }
  container.innerHTML = tem ? html : '<tr><td colspan="4" style="text-align:center; color:#999;">Nenhum ponto registrado.</td></tr>';
}

// ============================================================
// CONTRATOS (Funções de geração)
// ============================================================
// ============================================================
// CONTRATO 1 — PEGUE E MONTE
// ============================================================
function gerarContratoPegueMonte(dados) {
  var dataFmt = dados.data ? String(dados.data).split("-").reverse().join("/") : "____/____/______";
  var valorNum = parseFloat(dados.valor) || 0;
  var valorFmt = valorNum ? valorNum.toFixed(2).replace('.', ',') : "______,____";
  var dataAtual = new Date().toLocaleDateString('pt-BR');
  var nome = dados.nome || "_________________________";
  var cpf = dados.cpf || "_________________________";
  var endereco = dados.endereco || "_________________________";
  var pecasDetalhadas = descricaoPecasDetalhada(dados.pecas, dados.pecasQtd);

  return '<div class="pagina-contrato">' +
    '<div class="logo-container"><img src="tralala-logo.png" class="logo-contrato"></div>' +
    '<div class="titulo-contrato">CONTRATO DE PRESTAÇÃO DE SERVIÇOS PARA LOCAÇÃO</div>' +
    '<div class="dados-contratada"><span class="negrito">CONTRATADA:</span> TRALALÁ DECORAÇÕES DE FESTAS CNPJ: 21.918.863/0001-12</div>' +
    '<div class="dados-contratante"><span class="negrito">CONTRATANTE:</span> ' + nome + '</div>' +
    '<div class="dados-contratante"><span class="negrito">CPF:</span> ' + cpf + '</div>' +
    '<div class="dados-contratante"><span class="negrito">ENDEREÇO CLIENTE:</span> ' + endereco + '</div>' +
    '<div class="dados-contratante"><span class="negrito">DATA DA FESTA:</span> ' + dataFmt + '</div>' +
    '<p style="margin-top:4px;">As partes acima identificadas têm, entre si, justo e acertado o presente contrato de prestação de serviços, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descritas no presente contrato.</p>' +
    '<div class="clausula-titulo">DO OBJETO DO CONTRATO</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 1ª.</span> É objeto do presente contrato a prestação de serviço de Aluguel de ' + pecasDetalhadas + ' à CONTRATANTE (especificado na Clausula 5ª), que a CONTRATADA declara ser de sua propriedade, para o evento que se realizará no dia ' + dataFmt + ', conforme endereço especificado abaixo:</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 2ª.</span> A CONTRATANTE não poderá, sem prévia autorização da CONTRATADA, sublocar, emprestar, ou ceder os móveis locados.</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 3ª.</span> A CONTRATANTE deverá retirar os itens no seguinte endereço QR 308 CONJUNTO 11 lote 20 - Samambaia sul, no dia anterior ao evento, munido de cópia do comprovante de residência em seu nome, cópia do CPF e RG, documentos necessários para locação.</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 4ª.</span> É dever da CONTRATADA oferecer o serviço de acordo com as especificações do contrato. É dever da CONTRATANTE entregar os itens conforme descrito na clausula 1ª no dia seguinte ao evento, até as 12h00 no mesmo local de retirada.</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 5ª.</span> O serviço contratado no presente instrumento será remunerado pela quantia de R$ ' + valorFmt + ', devendo ser pago no ato da reserva.</div>' +
    '<div class="clausula-texto">Em dinheiro ou depósito bancário (Caixa Econômica Federal, Agencia: 2403, Op.001 Conta corrente: 21702-0 em nome de Aline Alves de Araújo do Valle, CPF: 864.331.211-87 pix) ou ( Banco Itaú, agencia 8624, conta corrente 06209-0, Aline Alves de Araújo, CPF: 864.331.211.87) ou ( Banco do Brasil, Agencia:1230-0, conta corrente 39.464-5, em nome Jorge Leonardo Sampaio do Valle, CPF: 794.883.315-34)</div>' +
    '<div class="clausula-titulo">DA DEVOLUÇÃO</div>' +
    '<div class="clausula-texto"><span class="negrito">Cláusula 6ª.</span> Caso Haja perda, Danos, Quebra Ou não devolução dos itens, a CONTRATANTE arcará com 50% do valor de uma peça nova (caso haja recuperação), não havendo recuperação será cobrado o valor de mercado por cada peça, em dinheiro ou outra forma que convier às PARTES. A CONTRATANTE assinará nota promissória referente ao valor real do kit alugado que será devolvido na entrega do mesmo.</div>' +
    '<div class="paragrafo">Parágrafo primeiro: É dever da CONTRATANTE devolver as peças limpas e embaladas na caixa como foi entregue. É proibido, furar maquete, usar cola quente no painel, peças e mesas, usar confeitos coloridos, vela faísca estes itens danificam e mancham peças e mobília.</div>' +
    '<div class="paragrafo">O tapete deverá ser devolvido limpo, caso contrário pagará multa de limpeza de R$ 40,00 (quarenta reais).</div>' +
    '<div class="clausula-titulo">DO CANCELAMENTO</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 7ª.</span> Em caso de desistência a CONTRATANTE pagará multa de quebra de contrato de 50% do valor total do contrato.</div>' +
    '<div class="paragrafo">Parágrafo primeiro: Em caso de força maior, a CONTRATANTE, poderá solicitar uma carta credito na quantia paga, para utilização de até um ano a partir da data da notificação. Sendo que carta crédito não poderá ser transferida para outro titular, nem prorrogada. Cabendo a CONTRATADA confirmar disponibilidade de peças e data. A CONTRATANTE deverá comprovar o fato ocorrido com documentos oficiais.</div>' +
    '<div class="paragrafo">Parágrafo Segundo. A Parte impossibilitada de cumprir sua obrigação deverá notificar a outra, de imediato, acerca da extensão do problema e o prazo estimado para remarcação da nova data.</div>' +
    '<div class="clausula-titulo">DO FORO</div>' +
    '<div class="clausula-texto">As Partes elegem o foro da Circunscrição Judiciária de Brasília – DF para dirimir os conflitos que porventura venham a surgir em decorrência da execução do presente contrato, com renúncia de qualquer outro, por mais privilegiado que seja.</div>' +
    '<div class="clausula-texto">E por assim estarem de acordo, as partes celebram o presente instrumento em 02 (duas) vias de igual teor e validade, todos assinados em presença das testemunhas abaixo nominadas e identificadas para que produza todos os efeitos legais.</div>' +
    '<div class="assinatura"><div class="assinatura-nome">CONTRATADA:</div><div class="linha-assinatura"></div><div class="assinatura-nome">TRALALÁ DECORAÇOES DE FESTA CNPJ:21.918.863/0001-12</div></div>' +
    '<div class="assinatura"><div class="assinatura-nome">CONTRATANTE:</div><div class="linha-assinatura"></div><div class="assinatura-nome">' + nome + ' — CPF: ' + cpf + '</div></div>' +
    '<div style="text-align:center; margin-top:8px; font-size:10pt;">Brasília-DF, ' + dataAtual + '.</div>' +
    '<div class="rodape-loja">TRALALÁ DECORAÇÕES DE FESTAS QR 308 CONJUNTO 14 LOTE 11, SAMAMBAIA SUL. (61) 9. 8191-9559</div>' +
  '</div>';
}

// ============================================================
// CONTRATO 3 — PEGUE E MONTE (LOJA)
// ============================================================
function gerarContratoPegueMonteLoja(dados) {
  var dataFmt = dados.data ? String(dados.data).split("-").reverse().join("/") : "____/____/______";
  var valorNum = parseFloat(dados.valor) || 0;
  var valorFmt = valorNum ? valorNum.toFixed(2).replace('.', ',') : "______,____";
  var dataAtual = new Date().toLocaleDateString('pt-BR');
  var nome = dados.nome || "_________________________";
  var cpf = dados.cpf || "_________________________";
  var endereco = dados.endereco || "_________________________";
  var telefone = dados.telefone || "(61) ________________";

  var totalNum = parseFloat(dados.valor) || 0;
  var sinalNum = parseFloat(dados.sinal) || 0;
  var freteNum = parseFloat(dados.frete) || 0;
  var totalComFrete = totalNum + freteNum;
  var faltaPagar = totalComFrete - sinalNum;
  if (faltaPagar < 0) faltaPagar = 0;
  var valorTotalFmt = totalComFrete.toFixed(2).replace('.', ',');
  var sinalFmt = sinalNum.toFixed(2).replace('.', ',');
  var faltaFmt = faltaPagar.toFixed(2).replace('.', ',');
  var freteFmt = freteNum.toFixed(2).replace('.', ',');

  function valorPorExtenso(valor) {
    if (!valor || valor === 0) return "zero reais";
    var unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
    var especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    var dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    var centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

    function extensoAte999(n) {
      if (n === 0) return "";
      if (n === 100) return "cem";
      var partes = [];
      var c = Math.floor(n / 100);
      var resto = n % 100;
      if (c > 0) partes.push(centenas[c]);
      if (resto > 0) {
        if (resto < 10) partes.push(unidades[resto]);
        else if (resto < 20) partes.push(especiais[resto - 10]);
        else {
          var d = Math.floor(resto / 10);
          var u = resto % 10;
          if (u > 0) partes.push(dezenas[d] + " e " + unidades[u]);
          else partes.push(dezenas[d]);
        }
      }
      return partes.join(" e ");
    }

    var reais = Math.floor(valor);
    var centavos = Math.round((valor - reais) * 100);
    var partes = [];

    if (reais > 0) {
      var milhoes = Math.floor(reais / 1000000);
      var milhares = Math.floor((reais % 1000000) / 1000);
      var resto = reais % 1000;
      if (milhoes > 0) partes.push(extensoAte999(milhoes) + (milhoes === 1 ? " milhão" : " milhões"));
      if (milhares > 0) partes.push(extensoAte999(milhares) + " mil");
      if (resto > 0) partes.push(extensoAte999(resto));
    }

    var texto = partes.join(" e ");
    if (reais > 0) texto += (reais === 1 ? " real" : " reais");

    if (centavos > 0) {
      if (reais > 0) texto += " e ";
      var c = Math.floor(centavos / 10);
      var u = centavos % 10;
      var textoCentavos = "";
      if (centavos < 10) textoCentavos = unidades[centavos];
      else if (centavos < 20) textoCentavos = especiais[centavos - 10];
      else {
        if (u > 0) textoCentavos = dezenas[c] + " e " + unidades[u];
        else textoCentavos = dezenas[c];
      }
      texto += textoCentavos + (centavos === 1 ? " centavo" : " centavos");
    }

    return texto;
  }

  var linhasTabela = "";
  if (dados.pecas && dados.pecas.length > 0) {
    dados.pecas.forEach(function(nomePeca) {
      var item = State.estoqueMap[nomePeca];
      var qtd = dados.pecasQtd && dados.pecasQtd[nomePeca] ? parseInt(dados.pecasQtd[nomePeca]) : 1;
      var preco = item ? (parseFloat(item.preco) || 0) : 0;
      var descricao = nomePeca;
      if (item) {
        var partes = [];
        if (item.categoria) partes.push(item.categoria);
        if (item.modelo) partes.push(item.modelo);
        if (partes.length > 0) descricao += " (" + partes.join(" — ") + ")";
      }
      linhasTabela += '<tr>' +
        '<td style="text-align:center;">' + qtd + '</td>' +
        '<td>' + descricao + '</td>' +
        '<td style="text-align:center;">R$ ' + preco.toFixed(2).replace('.', ',') + '</td>' +
        '<td style="text-align:center;">R$ ' + (preco * qtd).toFixed(2).replace('.', ',') + '</td>' +
        '</tr>';
    });
  } else {
    for (var i = 0; i < 3; i++) {
      linhasTabela += '<tr><td style="text-align:center; height:24px;">&nbsp;</td><td>&nbsp;</td><td style="text-align:center;">&nbsp;</td><td style="text-align:center;">&nbsp;</td></tr>';
    }
  }

  return '<div class="pagina-contrato">' +
    '<div class="logo-container"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT2qBAlvPlxMFaok_zho9se2IT9smgKtY9Dvg&s" class="logo-contrato"></div>' +
    '<div class="titulo-contrato">CONTRATO DE LOCAÇÃO PEGUE & MONTE</div>' +
    '<div class="dados-contratada"><span class="negrito">CONTRATADA:</span> TRALALÁ DECORAÇÕES DE FESTAS</div>' +
    '<div class="dados-contratada"><span class="negrito">CNPJ:</span> 21.918.863/0001-12</div>' +
    '<div class="dados-contratada"><span class="negrito">E-MAIL:</span> tralaladecoracoes@gmail.com</div>' +
    '<br>' +
    '<div class="dados-contratante"><span class="negrito">CONTRATANTE:</span> ' + nome + '</div>' +
    '<div class="dados-contratante"><span class="negrito">CPF:</span> ' + cpf + '</div>' +
    '<div class="dados-contratante"><span class="negrito">ENDEREÇO CLIENTE:</span> ' + endereco + '</div>' +
    '<div class="dados-contratante"><span class="negrito">TELEFONE:</span> ' + telefone + '</div>' +
    '<div class="dados-contratante"><span class="negrito">DATA DA FESTA:</span> ' + dataFmt + '</div>' +
    '<div class="dados-contratante"><span class="negrito">RETIRADA DOS ITENS:</span> ____/____/______, DAS 8H00 AS 11H00 E DAS 13H00 AS 17H00</div>' +
    '<div class="dados-contratante"><span class="negrito">DEVOLUÇÃO DOS ITENS:</span> ____/____/______, 8H00 DAS 11H00 (caso não seja entregue na data e horário combinado será cobrado o valor de uma locação para cada dia de atraso).</div>' +
    '<p style="margin-top:6px;">As partes acima identificadas têm, entre si, justo e acertado o presente contrato de prestação de serviços, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descritas no presente contrato.</p>' +
    '<div class="clausula-titulo">DO OBJETO DO CONTRATO</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 1ª.</span> É objeto do presente contrato a prestação de serviço de Locação de:</div>' +
    '<table class="tabela-itens"><thead><tr><th style="width:60px;">QTDE.</th><th>DESCRIÇÃO DO PRODUTO</th><th style="width:110px;">VALOR UNITÁRIO</th><th style="width:110px;">VALOR TOTAL</th></tr></thead><tbody>' + linhasTabela + '</tbody></table>' +
    '<div class="clausula-titulo" style="margin-top: 12px;">DO PAGAMENTO</div>' +
    '<div class="clausula-texto">O serviço contratado no presente instrumento será remunerado pela quantia total de <b>R$ ' + valorTotalFmt + ' (' + valorPorExtenso(totalComFrete) + ')</b>, referente à locação dos itens e serviços descritos neste contrato.</div>' +
    '<div class="resumo-pagamento">' +
      '<div class="linha-pagamento"><span class="label-pag">Valor total do contrato:</span><span class="valor-pag">R$ ' + valorTotalFmt + '</span></div>' +
      (freteNum > 0 ? '<div class="linha-pagamento"><span class="label-pag">— Frete incluso:</span><span class="valor-pag">R$ ' + freteFmt + '</span></div>' : '') +
      '<div class="linha-pagamento"><span class="label-pag">Sinal pago no ato da reserva:</span><span class="valor-pag" style="color: #27ae60;">R$ ' + sinalFmt + '</span></div>' +
      '<div class="linha-pagamento linha-total"><span class="label-pag"><b>Valor restante a pagar:</b></span><span class="valor-pag" style="color: #e74c3c; font-weight: bold;">R$ ' + faltaFmt + '</span></div>' +
    '</div>' +
    '<div class="clausula-texto">A CONTRATANTE declara estar ciente do valor acordado e compromete-se a efetuar o pagamento conforme as condições previamente estabelecidas entre as partes.</div>' +
    '<div class="paragrafo">Parágrafo primeiro. A CONTRATANTE não poderá, sem prévia autorização da CONTRATADA, sublocar, emprestar, ou ceder os móveis locados.</div>' +
    '<div class="clausula-titulo">OBRIGAÇÃO DA CONTRATADA</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 2ª.</span> O serviço contratado no presente instrumento deverá ser pago no ato da reserva.</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 3ª.</span> É dever da CONTRATADA oferecer os itens de acordo com as especificações do contrato.</div>' +
    '<div class="clausula-texto">Em dinheiro ou depósito bancário (Caixa Econômica Federal, Agencia: 2403, Op.001 Conta corrente: 21702-0 em nome de Aline Alves de Araújo do Valle, CPF: 864.331.211-87 pix).</div>' +
    '<div class="paragrafo">Parágrafo primeiro. Não será aceito, sob hipótese alguma, pagamento pós-festa.</div>' +
    '<div class="clausula-texto"><span class="negrito">Cláusula 4ª.</span> O recibo do depósito da transferência bancária ou pix, referente ao valor, efetuada na conta informada pela CONTRATADA, servirá para a CONTRATANTE como comprovante de cumprimento da obrigação de pagar.</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 5ª.</span> É dever da CONTRATANTE devolver o(s) produto(s) de acordo com o que foi locado no dia informado neste contrato.</div>' +
    '<div class="paragrafo">Parágrafo único. A CONTRATANTE deverá retirar e entregar os itens no endereço no seguinte endereço Qn 508 CONJUNTO 03 Loja 06, Samambaia Sul, munido de cópia do comprovante de residência em seu nome, cópia ou foto CPF e RG documentos necessários para a retiradas das peças.</div>' +
    '<div class="clausula-titulo">DA DEVOLUÇÃO</div>' +
    '<div class="clausula-texto"><span class="negrito">Cláusula 6ª.</span> Caso Haja perda, Danos, Quebra ou não devolução dos itens, a CONTRATANTE arcará com 50% do valor de uma peça nova para reposição (caso haja recuperação). NÃO havendo recuperação, será cobrado o valor de mercado por cada item, em dinheiro ou outra forma que convier às PARTES. Em caso de quebra ou extravio de peças a CONTRATANTE assinará uma nota promissória se comprometendo com o pagamento que será devolvida após a quitação do débito.</div>' +
    '<div class="paragrafo">Parágrafo primeiro: É dever da CONTRATANTE devolver as peças como foi entregue, no dia e horário marcado. Será cobrado multa de uma diária dos itens alocados com cada dia de atraso da devolução.</div>' +
    '<div class="paragrafo">OBS: É proibido furar o bolo cenográfico, usar cola quente no painel, peças e mesas, usar confeitos coloridos ou vela faísca. Estes itens danificam e mancham peças e mobília (uso estará sujeito, em caso de avarias, a pagar pela recuperação ou peça nova caso não seja possível recuperação).</div>' +
    '<div class="paragrafo">O tapete deverá ser devolvido como foi entregue, sem doces e bolos. Caso contrário pagará multa de limpeza de R$ 40,00 (quarenta reais).</div>' +
    '<div class="paragrafo">Parágrafo Segundo: É dever da CONTRATANTE devolver o kit ou itens na data informada neste contrato. Caso contrário, será cobrado o valor de uma locação por cada dia de atraso.</div>' +
    '<div class="clausula-titulo">DO CANCELAMENTO</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 7ª.</span> Em caso de desistência a CONTRATANTE arcará com a multa de quebra de contrato de 50% do valor total do seu contrato.</div>' +
    '<div class="paragrafo">Parágrafo primeiro: Em caso de força maior, a CONTRATANTE poderá solicitar uma carta crédito na quantia paga, para utilização de até um ano a partir da data da notificação. A carta crédito não poderá ser transferida para outro titular, nem prorrogada, cabendo a CONTRATADA confirmar disponibilidade de peças e data. A CONTRATANTE deverá comprovar o fato ocorrido com documentos oficiais.</div>' +
    '<div class="paragrafo">Parágrafo Segundo: A Parte impossibilitada de cumprir sua obrigação deverá notificar a outra, de imediato, acerca da extensão do problema e o prazo estimado para remarcação da nova data.</div>' +
    '<div class="clausula-titulo">DAS CONDIÇÕES GERAIS</div>' +
    '<div class="clausula-titulo">DO FORO</div>' +
    '<div class="clausula-texto">As Partes elegem o foro da Circunscrição Judiciária de Brasília – DF para dirimir os conflitos que porventura venham a surgir em decorrência da execução do presente contrato, com renúncia de qualquer outro, por mais privilegiado que seja.</div>' +
    '<div class="clausula-texto">E por assim estarem de acordo, o contrato será assinado de forma digitalizada, sendo as vias compartilhadas em meio eletrônico e permitida a assinatura híbrida (física e digital).</div>' +
    '<div id="espaco-nota-promissoria-loja"></div>' +
    '<div style="text-align:center; margin-top:8px;">Brasília-DF, ' + dataAtual + '.</div>' +
    '<div class="assinatura"><div class="assinatura-nome">CONTRATADA:</div><div class="linha-assinatura"></div><div class="assinatura-nome">TRALALÁ DECORAÇÕES DE FESTA — CNPJ: 21.918.863/0001-12</div><div class="assinatura-nome" style="font-size:9pt; margin-top:4px;">REPRESENTANTE LEGAL: ALINE ARAUJO DO VALLE</div></div>' +
    '<div class="assinatura"><div class="assinatura-nome">CONTRATANTE:</div><div class="linha-assinatura"></div><div class="assinatura-nome">' + nome + ' — CPF: ' + cpf + '</div></div>' +
    '<div class="rodape-loja">TRALALÁ DECORAÇÕES DE FESTAS — QN 508 CONJUNTO 03 LOJA 06, SAMAMBAIA SUL. (61) 9. 8191-9559</div>' +
  '</div>';
// ============================================================
// CONTRATO 2 — FRETE (LEVA E MONTA)
// ============================================================


function gerarContratoComFrete(dados) {
  dados = dados || {};

  // Evita que dados digitados pelo cliente alterem o HTML.
  function esc(valor) {
    return String(valor == null ? "" : valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function texto(valor, padrao) {
    return esc(
      valor !== undefined &&
      valor !== null &&
      String(valor).trim() !== ""
        ? valor
        : padrao
    );
  }

  function dataBR(valor) {
    if (!valor) return "____/____/______";
    var s = String(valor);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return s.split("-").reverse().join("/");
    }
    return esc(s);
  }

  function moeda(valor) {
    var n = Number(valor);
    if (!isFinite(n)) return "______,__";
    return n.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function valorPorExtenso(valor) {
    // Usa o valor por extenso informado no cadastro,
    // sem inventar um texto para valores diferentes.
    return texto(valor, "________________________");
  }

  var nome = texto(dados.nome, "________________________");
  var cpf = texto(dados.cpf, "________________________");
  var endereco = texto(dados.endereco, "________________________");
  var telefone = texto(dados.telefone, "(61) ________________");
  var local = texto(dados.local, "________________________");
  var localMaiusculo = texto(
    dados.local ? String(dados.local).toUpperCase() : "",
    "________________________"
  );

  var dataFesta = dataBR(dados.data);
  var dataRetirada = dataBR(dados.dataRetirada || dados.data);
  var horarioFesta = texto(dados.horario, "____:____");
  var horarioRetirada = texto(dados.horarioRetirada, "____:____");
  var horarioEntrega = texto(dados.horarioEntrega, "____:____");

  var tema = texto(dados.tema, "________________________");
  var pecas = texto(
    descricaoPecasDetalhada(dados.pecas, dados.pecasQtd),
    "________________________"
  );

  var descricaoObjeto = texto(
    dados.descricaoObjeto,
    "Aluguel de KIT " + (dados.tema || "________")
  );

  var valorTotal = Number(dados.valor);
  if (!isFinite(valorTotal)) valorTotal = 0;

  var sinalInformado =
    dados.sinal !== undefined &&
    dados.sinal !== null &&
    dados.sinal !== "";

  var sinal = sinalInformado ? Number(dados.sinal) : NaN;
  var restanteInformado =
    dados.restante !== undefined &&
    dados.restante !== null &&
    dados.restante !== "";

  var restante = restanteInformado
    ? Number(dados.restante)
    : (sinalInformado ? valorTotal - sinal : NaN);

  var valorSinal = isFinite(sinal) ? moeda(sinal) : "______,__";
  var valorRestante = isFinite(restante)
    ? moeda(restante)
    : "______,__";

  var dataSinal = dataBR(dados.dataPagamentoSinal);
  var dataRestante = dataBR(dados.dataPagamentoRestante || dados.data);
  var dataOrcamento = dataBR(dados.dataEnvioOrcamento);
  var dataAtual = new Date().toLocaleDateString("pt-BR");

  var rodape =
    '<div class="rodape-loja" style="text-align:center;font-weight:bold;">' +
    'TRALALÁ DECORAÇÕES DE FESTAS<br>' +
    'Qn 508 CONJUNTO 03 LOJA 06, SAMAMBAIA SUL.<br>' +
    '(61) 9. 8191-9559' +
    '</div>';

  return `
    <!-- PÁGINA 1 -->
    <div class="pagina-contrato">

      <div class="logo-container">
        <img
          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT2qBAlvPlxMFaok_zho9se2IT9smgKtY9Dvg&s"
          class="logo-contrato"
          alt="Tralalá Decorações"
        >
      </div>

      <div class="titulo-contrato">
        CONTRATO DE PRESTAÇÃO DE SERVIÇOS PARA LOCAÇÃO
      </div>

      <div class="dados-contratada">
        <b>CONTRATADA: TRALALÁ DECORAÇÕES DE FESTAS</b><br>
        <b>CNPJ: 21.918.863/0001-12</b><br>
        <b>E-MAIL:tralaladecoracoes@gmail.com</b>
      </div>

      <div class="dados-contratante" style="margin-top:18px;">
        <b>CONTRATANTE:</b> ${nome}<br>
        <b>CPF:</b> ${cpf}<br>
        <b>ENDEREÇO CLIENTE:</b> ${endereco}<br>
        <b>LOCAL DA FESTA:</b> ${local}<br>
        <b>TELEFONE:</b> ${telefone}<br>
        <b>DATA DA FESTA:</b> ${dataFesta}<br>
        <b>HORARIO DA FESTA:</b> ${horarioFesta}
        &nbsp;&nbsp;&nbsp;
        <b>RETIRADA:</b> ${horarioRetirada}
      </div>

      <p>
        As partes acima identificadas têm, entre si, justo e acertado o
        presente contrato de prestação de serviços, que se regerá pelas
        cláusulas seguintes e pelas condições de preço, forma e termo
        de pagamento descritas no presente contrato.
      </p>

      <div class="clausula-titulo">DO OBJETO DO CONTRATO</div>

      <div class="clausula-texto">
        <b>Clausula 1ª.</b> É objeto do presente contrato a prestação
        de serviço de ${descricaoObjeto} (${pecas}) de sua propriedade,
        para o evento que se realizará no dia ${dataFesta}, conforme
        endereço especificado abaixo:
      </div>

      <p><b>LOCAL DA FESTA: ${localMaiusculo}.</b></p>

      <div class="paragrafo">
        <b>Primeiro.</b> A alteração do local para entrega do objeto
        deste contrato implica em prévia comunicação da CONTRATANTE
        no prazo de 48 horas antes da entrega.
      </div>

      <div class="paragrafo">
        <b>Parágrafo Segundo.</b> Caso haja alteração do local para
        entrega, poderá haver alteração do valor do frete conforme
        localidade e distância.
      </div>

      <div class="paragrafo">
        <b>Parágrafo Terceiro.</b> A CONTRATANTE não poderá, sem
        prévia autorização da CONTRATADA, sublocar, emprestar,
        ou ceder os móveis locados.
      </div>

      <div class="clausula-titulo">OBRIGAÇÃO DA CONTRATANTE</div>

      <div class="clausula-texto">
        <b>Clausula 2ª.</b> A CONTRATANTE deverá fornecer à
        CONTRATADA todas as informações necessárias para a
        realização do serviço, devendo especificar o material,
        tipo e a quantidade.
      </div>

      <div class="clausula-texto">
        <b>Clausula 3ª.</b> É dever da CONTRATANTE devolver o(s)
        produto(s) de acordo com o que foi locado no término
        da festa. A CONTRATADA efetuara a retirada dos itens
        no dia ${dataRetirada}.
      </div>

      ${rodape}
    </div>

    <!-- PÁGINA 2 -->
    <div class="pagina-contrato">

      <div class="paragrafo">
        <b>Parágrafo único.</b> A CONTRATADA deverá entregar e buscar
        o produto no endereço mencionado na cláusula 1ª, em caso
        de a CONTRATANTE optar por fazer retirada do produto no
        local, deverá devolvê-lo no local mencionado na cláusula
        1ª conforme combinado com a CONTRATADA.
      </div>

      <div class="clausula-titulo">OBRIGAÇÃO DA CONTRATADA</div>

      <div class="clausula-texto">
        <b>Clausula 4ª.</b> É dever da CONTRATADA oferecer o serviço
        de acordo com as especificações da CONTRATANTE, devendo
        o material ser entregue no dia ${dataFesta} até
        ${horarioEntrega} no endereço já especificado na Clausula 1ª.
      </div>

      <div class="clausula-texto">
        <b>Clausula 5ª.</b> A CONTRATADA fornecerá as seguintes peças:
      </div>

      <div class="paragrafo">
        (X) KIT COMEMORE (Descrito na clausula 1ª)
      </div>

      <div class="paragrafo">
        (X) KIT DECORAÇÃO (Descrito na clausula 1ª)
      </div>

      <div class="clausula-texto">
        <b>Clausula 6ª.</b> O serviço contratado no presente instrumento
        será remunerado pela quantia de R$ ${moeda(valorTotal)}
        ( ${valorPorExtenso(dados.valorExtenso)} ), devendo ser pago:
      </div>

      <div class="paragrafo">
        ✓ ${dataSinal} - R$ ${valorSinal} ( no ato da reserva)
      </div>

      <div class="paragrafo">
        ✓ ${dataRestante} – R$ ${valorRestante}
        ( no ato da montagem em dinheiro ou pix ou cartão)
      </div>

      <div class="paragrafo">
        *pagamentos em cartão de credito e debito tem acréscimo
        da taxa da operadora do cartão.
      </div>

      <div class="clausula-texto">
        Em dinheiro ou depósito bancário (Caixa Econômica Federal,
        Agencia: 2403 ,Op.001 Conta corrente: 21702-0 em nome
        de Aline Alves de Araújo do Valle, CPF: 864.331.211-87)
        ou ( Banco Itaú, agencia 8624, conta corrente: 06209-0,
        Aline Alves de Araújo, CPF: 864.331.211.87) ou
        ( Banco do Brasil, Agencia:1230-0, conta corrente
        39.464-5, em nome Jorge Leonardo Sampaio do Valle,
        CPF: 794.883.315-34)
        <br><b>CHAVE PIX CNPJ: 21.918.863/0001-12</b>
      </div>

      <div class="paragrafo">
        <b>Parágrafo primeiro.</b> Não será aceito, sob hipótese
        alguma, pagamento pós-festa.
      </div>

      <div class="paragrafo">
        <b>Parágrafo Segundo.</b> No valor acima referido já está
        incluso frete.
      </div>

      <div class="paragrafo">
        <b>Parágrafo Terceiro.</b> O valor do frete é referente à
        entrega e à retirada que será realizada pela CONTRATADA
        no local do evento ou onde for combinado entre as PARTES.
      </div>

      <div class="paragrafo">
        <b>Parágrafo quarto.</b> NÃO está incluso no valor da locação
        de peças e mobílias, o serviço de arrumação de mesa,
        como colocar doces, bolo, lembrancinhas e personalizados
        feitos por terceiros, para esse serviço favor consultar
        valores com a CONTRATADA.
      </div>

      <div class="clausula-texto">
        <b>Cláusula 7ª.</b> O recibo do depósito da transferência
        bancária, referente ao sinal, efetuada na conta informada
        pela CONTRATADA, servirá para a CONTRATANTE como
        comprovante de cumprimento da obrigação de pagar.
      </div>

      <div class="clausula-titulo">DA DEVOLUÇÃO</div>

      <div class="clausula-texto">
        <b>cláusula 8ª.</b> Caso Haja perda, Danos, Quebra Ou não
        devolução dos itens, a CONTRATANTE arcará com 50% do
        valor de uma peça nova para reposição (caso haja
        recuperação) NÃO Havendo recuperação, será cobrado o
        valor de mercado por cada item, em dinheiro ou outra
        forma que convier às PARTES. Em caso de quebra ou
        extravio de peças a CONTRATATE assinará uma nota
        promissória se comprometendo-se com o pagamento
        que será devolvida após a quitação do debito.
      </div>

      ${rodape}
    </div>

    <!-- PÁGINA 3 -->
    <div class="pagina-contrato">

      <div class="paragrafo">
        <b>Parágrafo Primeiro:</b> E de responsabilidade da
        CONTRATANTE que na retirada da decoração, todas as peças
        alugadas estejam sobre a mesa, caso fique algum item,
        a CONTRATANTE se responsabilizará pela devolução,
        a recusa da devolução imediata, acarretará em multa
        de R$ 20,00, por diária/peça.
      </div>

      <div class="paragrafo">
        <b>Parágrafo segundo:</b> É dever da CONTRATANTE devolver
        as peças foi entregue. É proibido, furar o bolo cenográfico,
        usar cola quente no painel, peças e mesas, usar confeitos
        coloridos, vela faísca estes itens danificam e mancham
        peças e mobilha (uso estará sujeito em caso de avarias
        pagar pela recuperação ou peça nova caso não seja possível.
      </div>

      <div class="paragrafo">
        O tapete deverá ser devolvido com foi entregue sem doces
        e bolos, caso contrário pagará multa de limpeza de
        R$ 40,00 (quarenta reais).
      </div>

      <div class="clausula-titulo">DO CANCELAMENTO</div>

      <div class="clausula-texto">
        <b>Clausula 9ª.</b> Em caso de desistência a CONTRATANTE
        acará com a multa de quebra de contrato, 50% do
        valor total do seu contrato.
      </div>

      <div class="paragrafo">
        <b>Parágrafo primeiro:</b> Em caso de força maior,
        a CONTRATANTE, poderá solicitar uma carta credito
        na quantia paga, para utilização de até um ano
        a partir da data da notificação. Sendo que essa
        carta crédito não poderá ser transferida para outro
        titular, nem prorrogada. Cabendo a CONTRATADA
        confirmar disponibilidade de peças e data.
        A CONTRATANTE deverá comprovar o fato ocorrido
        com documentos oficiais.
      </div>

      <div class="paragrafo">
        <b>Parágrafo Segundo.</b> A Parte impossibilitada de cumprir
        sua obrigação deverá notificar a outra, de imediato,
        acerca da extensão do problema e o prazo estimado
        para remarcação da nova data.
      </div>

      <div class="clausula-titulo">DAS CONDIÇÕES GERAIS</div>

      <div class="clausula-texto">
        <b>Cláusula 10ª.</b> O orçamento ou aceite referente ao
        serviço contratado, enviado dia ${dataOrcamento}
        por email, faz parte integrante deste contrato.
      </div>

      <div class="clausula-titulo">DO FORO</div>

      <div class="clausula-texto">
        As Partes elegem o foro da Circunscrição Judiciária
        de Brasília – DF para dirimir os conflitos que
        porventura venham a surgir em decorrência da execução
        do presente contrato, com renúncia de qualquer outro,
        por mais privilegiado que seja.
      </div>

      <div class="clausula-texto">
        E por assim estarem de acordo, o contrato será sendo
        assinado de forma digitalizada, sendo as vias
        compartilhadas em meio eletrônico e permitida
        a assinatura hibrida (física e digital).
      </div>

      <div style="text-align:right;margin-top:12px;">
        Brasília-DF, ${dataAtual}.
      </div>

      <div class="assinatura">
        <b>CONTRATADA:</b>
        <div class="linha-assinatura"></div>
        <b>TRALALÁ DECORAÇOES DE FESTA</b><br>
        <b>CNPJ:21.918.863/0001-12</b><br>
        <b>REPRESENTANTE LEGAL: ALINE ARAUJO DO VALLE</b>
      </div>

      <div class="assinatura">
        <b>CONTRATANTE:</b>
        <div class="linha-assinatura"></div>
        <b>CONTRATANTE: ${nome}</b><br>
        <b>CPF: ${cpf}</b>
      </div>

      ${rodape}
    </div>
  `;
}

// ============================================================
// CONTRATO 3 — PEGUE E MONTE (LOJA)
// ============================================================
function gerarContratoPegueMonteLoja(dados) {
  var dataFmt = dados.data ? String(dados.data).split("-").reverse().join("/") : "____/____/______";
  var valorNum = parseFloat(dados.valor) || 0;
  var valorFmt = valorNum ? valorNum.toFixed(2).replace('.', ',') : "______,____";
  var dataAtual = new Date().toLocaleDateString('pt-BR');
  var nome = dados.nome || "_________________________";
  var cpf = dados.cpf || "_________________________";
  var endereco = dados.endereco || "_________________________";
  var telefone = dados.telefone || "(61) ________________";

  var totalNum = parseFloat(dados.valor) || 0;
  var sinalNum = parseFloat(dados.sinal) || 0;
  var freteNum = parseFloat(dados.frete) || 0;
  var totalComFrete = totalNum + freteNum;
  var faltaPagar = totalComFrete - sinalNum;
  if (faltaPagar < 0) faltaPagar = 0;
  var valorTotalFmt = totalComFrete.toFixed(2).replace('.', ',');
  var sinalFmt = sinalNum.toFixed(2).replace('.', ',');
  var faltaFmt = faltaPagar.toFixed(2).replace('.', ',');
  var freteFmt = freteNum.toFixed(2).replace('.', ',');

  function valorPorExtenso(valor) {
    if (!valor || valor === 0) return "zero reais";
    var unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
    var especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    var dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    var centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

    function extensoAte999(n) {
      if (n === 0) return "";
      if (n === 100) return "cem";
      var partes = [];
      var c = Math.floor(n / 100);
      var resto = n % 100;
      if (c > 0) partes.push(centenas[c]);
      if (resto > 0) {
        if (resto < 10) partes.push(unidades[resto]);
        else if (resto < 20) partes.push(especiais[resto - 10]);
        else {
          var d = Math.floor(resto / 10);
          var u = resto % 10;
          if (u > 0) partes.push(dezenas[d] + " e " + unidades[u]);
          else partes.push(dezenas[d]);
        }
      }
      return partes.join(" e ");
    }

    var reais = Math.floor(valor);
    var centavos = Math.round((valor - reais) * 100);
    var partes = [];

    if (reais > 0) {
      var milhoes = Math.floor(reais / 1000000);
      var milhares = Math.floor((reais % 1000000) / 1000);
      var resto = reais % 1000;
      if (milhoes > 0) partes.push(extensoAte999(milhoes) + (milhoes === 1 ? " milhão" : " milhões"));
      if (milhares > 0) partes.push(extensoAte999(milhares) + " mil");
      if (resto > 0) partes.push(extensoAte999(resto));
    }

    var texto = partes.join(" e ");
    if (reais > 0) texto += (reais === 1 ? " real" : " reais");

    if (centavos > 0) {
      if (reais > 0) texto += " e ";
      var c = Math.floor(centavos / 10);
      var u = centavos % 10;
      var textoCentavos = "";
      if (centavos < 10) textoCentavos = unidades[centavos];
      else if (centavos < 20) textoCentavos = especiais[centavos - 10];
      else {
        if (u > 0) textoCentavos = dezenas[c] + " e " + unidades[u];
        else textoCentavos = dezenas[c];
      }
      texto += textoCentavos + (centavos === 1 ? " centavo" : " centavos");
    }

    return texto;
  }

  var linhasTabela = "";
  if (dados.pecas && dados.pecas.length > 0) {
    dados.pecas.forEach(function(nomePeca) {
      var item = State.estoqueMap[nomePeca];
      var qtd = dados.pecasQtd && dados.pecasQtd[nomePeca] ? parseInt(dados.pecasQtd[nomePeca]) : 1;
      var preco = item ? (parseFloat(item.preco) || 0) : 0;
      var descricao = nomePeca;
      if (item) {
        var partes = [];
        if (item.categoria) partes.push(item.categoria);
        if (item.modelo) partes.push(item.modelo);
        if (partes.length > 0) descricao += " (" + partes.join(" — ") + ")";
      }
      linhasTabela += '<tr>' +
        '<td style="text-align:center;">' + qtd + '</td>' +
        '<td>' + descricao + '</td>' +
        '<td style="text-align:center;">R$ ' + preco.toFixed(2).replace('.', ',') + '</td>' +
        '<td style="text-align:center;">R$ ' + (preco * qtd).toFixed(2).replace('.', ',') + '</td>' +
        '</tr>';
    });
  } else {
    for (var i = 0; i < 3; i++) {
      linhasTabela += '<tr><td style="text-align:center; height:24px;">&nbsp;</td><td>&nbsp;</td><td style="text-align:center;">&nbsp;</td><td style="text-align:center;">&nbsp;</td></tr>';
    }
  }

  return '<div class="pagina-contrato">' +
    '<div class="logo-container"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT2qBAlvPlxMFaok_zho9se2IT9smgKtY9Dvg&s" class="logo-contrato"></div>' +
    '<div class="titulo-contrato">CONTRATO DE LOCAÇÃO PEGUE & MONTE</div>' +
    '<div class="dados-contratada"><span class="negrito">CONTRATADA:</span> TRALALÁ DECORAÇÕES DE FESTAS</div>' +
    '<div class="dados-contratada"><span class="negrito">CNPJ:</span> 21.918.863/0001-12</div>' +
    '<div class="dados-contratada"><span class="negrito">E-MAIL:</span> tralaladecoracoes@gmail.com</div>' +
    '<br>' +
    '<div class="dados-contratante"><span class="negrito">CONTRATANTE:</span> ' + nome + '</div>' +
    '<div class="dados-contratante"><span class="negrito">CPF:</span> ' + cpf + '</div>' +
    '<div class="dados-contratante"><span class="negrito">ENDEREÇO CLIENTE:</span> ' + endereco + '</div>' +
    '<div class="dados-contratante"><span class="negrito">TELEFONE:</span> ' + telefone + '</div>' +
    '<div class="dados-contratante"><span class="negrito">DATA DA FESTA:</span> ' + dataFmt + '</div>' +
    '<div class="dados-contratante"><span class="negrito">RETIRADA DOS ITENS:</span> ____/____/______, DAS 8H00 AS 11H00 E DAS 13H00 AS 17H00</div>' +
    '<div class="dados-contratante"><span class="negrito">DEVOLUÇÃO DOS ITENS:</span> ____/____/______, 8H00 DAS 11H00 (caso não seja entregue na data e horário combinado será cobrado o valor de uma locação para cada dia de atraso).</div>' +
    '<p style="margin-top:6px;">As partes acima identificadas têm, entre si, justo e acertado o presente contrato de prestação de serviços, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descritas no presente contrato.</p>' +
    '<div class="clausula-titulo">DO OBJETO DO CONTRATO</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 1ª.</span> É objeto do presente contrato a prestação de serviço de Locação de:</div>' +
    '<table class="tabela-itens"><thead><tr><th style="width:60px;">QTDE.</th><th>DESCRIÇÃO DO PRODUTO</th><th style="width:110px;">VALOR UNITÁRIO</th><th style="width:110px;">VALOR TOTAL</th></tr></thead><tbody>' + linhasTabela + '</tbody></table>' +
    '<div class="clausula-titulo" style="margin-top: 12px;">DO PAGAMENTO</div>' +
    '<div class="clausula-texto">O serviço contratado no presente instrumento será remunerado pela quantia total de <b>R$ ' + valorTotalFmt + ' (' + valorPorExtenso(totalComFrete) + ')</b>, referente à locação dos itens e serviços descritos neste contrato.</div>' +
    '<div class="resumo-pagamento">' +
      '<div class="linha-pagamento"><span class="label-pag">Valor total do contrato:</span><span class="valor-pag">R$ ' + valorTotalFmt + '</span></div>' +
      (freteNum > 0 ? '<div class="linha-pagamento"><span class="label-pag">— Frete incluso:</span><span class="valor-pag">R$ ' + freteFmt + '</span></div>' : '') +
      '<div class="linha-pagamento"><span class="label-pag">Sinal pago no ato da reserva:</span><span class="valor-pag" style="color: #27ae60;">R$ ' + sinalFmt + '</span></div>' +
      '<div class="linha-pagamento linha-total"><span class="label-pag"><b>Valor restante a pagar:</b></span><span class="valor-pag" style="color: #e74c3c; font-weight: bold;">R$ ' + faltaFmt + '</span></div>' +
    '</div>' +
    '<div class="clausula-texto">A CONTRATANTE declara estar ciente do valor acordado e compromete-se a efetuar o pagamento conforme as condições previamente estabelecidas entre as partes.</div>' +
    '<div class="paragrafo">Parágrafo primeiro. A CONTRATANTE não poderá, sem prévia autorização da CONTRATADA, sublocar, emprestar, ou ceder os móveis locados.</div>' +
    '<div class="clausula-titulo">OBRIGAÇÃO DA CONTRATADA</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 2ª.</span> O serviço contratado no presente instrumento deverá ser pago no ato da reserva.</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 3ª.</span> É dever da CONTRATADA oferecer os itens de acordo com as especificações do contrato.</div>' +
    '<div class="clausula-texto">Em dinheiro ou depósito bancário (Caixa Econômica Federal, Agencia: 2403, Op.001 Conta corrente: 21702-0 em nome de Aline Alves de Araújo do Valle, CPF: 864.331.211-87 pix).</div>' +
    '<div class="paragrafo">Parágrafo primeiro. Não será aceito, sob hipótese alguma, pagamento pós-festa.</div>' +
    '<div class="clausula-texto"><span class="negrito">Cláusula 4ª.</span> O recibo do depósito da transferência bancária ou pix, referente ao valor, efetuada na conta informada pela CONTRATADA, servirá para a CONTRATANTE como comprovante de cumprimento da obrigação de pagar.</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 5ª.</span> É dever da CONTRATANTE devolver o(s) produto(s) de acordo com o que foi locado no dia informado neste contrato.</div>' +
    '<div class="paragrafo">Parágrafo único. A CONTRATANTE deverá retirar e entregar os itens no endereço no seguinte endereço Qn 508 CONJUNTO 03 Loja 06, Samambaia Sul, munido de cópia do comprovante de residência em seu nome, cópia ou foto CPF e RG documentos necessários para a retiradas das peças.</div>' +
    '<div class="clausula-titulo">DA DEVOLUÇÃO</div>' +
    '<div class="clausula-texto"><span class="negrito">Cláusula 6ª.</span> Caso Haja perda, Danos, Quebra ou não devolução dos itens, a CONTRATANTE arcará com 50% do valor de uma peça nova para reposição (caso haja recuperação). NÃO havendo recuperação, será cobrado o valor de mercado por cada item, em dinheiro ou outra forma que convier às PARTES. Em caso de quebra ou extravio de peças a CONTRATANTE assinará uma nota promissória se comprometendo com o pagamento que será devolvida após a quitação do débito.</div>' +
    '<div class="paragrafo">Parágrafo primeiro: É dever da CONTRATANTE devolver as peças como foi entregue, no dia e horário marcado. Será cobrado multa de uma diária dos itens alocados com cada dia de atraso da devolução.</div>' +
    '<div class="paragrafo">OBS: É proibido furar o bolo cenográfico, usar cola quente no painel, peças e mesas, usar confeitos coloridos ou vela faísca. Estes itens danificam e mancham peças e mobília (uso estará sujeito, em caso de avarias, a pagar pela recuperação ou peça nova caso não seja possível recuperação).</div>' +
    '<div class="paragrafo">O tapete deverá ser devolvido como foi entregue, sem doces e bolos. Caso contrário pagará multa de limpeza de R$ 40,00 (quarenta reais).</div>' +
    '<div class="paragrafo">Parágrafo Segundo: É dever da CONTRATANTE devolver o kit ou itens na data informada neste contrato. Caso contrário, será cobrado o valor de uma locação por cada dia de atraso.</div>' +
    '<div class="clausula-titulo">DO CANCELAMENTO</div>' +
    '<div class="clausula-texto"><span class="negrito">Clausula 7ª.</span> Em caso de desistência a CONTRATANTE arcará com a multa de quebra de contrato de 50% do valor total do seu contrato.</div>' +
    '<div class="paragrafo">Parágrafo primeiro: Em caso de força maior, a CONTRATANTE poderá solicitar uma carta crédito na quantia paga, para utilização de até um ano a partir da data da notificação. A carta crédito não poderá ser transferida para outro titular, nem prorrogada, cabendo a CONTRATADA confirmar disponibilidade de peças e data. A CONTRATANTE deverá comprovar o fato ocorrido com documentos oficiais.</div>' +
    '<div class="paragrafo">Parágrafo Segundo: A Parte impossibilitada de cumprir sua obrigação deverá notificar a outra, de imediato, acerca da extensão do problema e o prazo estimado para remarcação da nova data.</div>' +
    '<div class="clausula-titulo">DAS CONDIÇÕES GERAIS</div>' +
    '<div class="clausula-titulo">DO FORO</div>' +
    '<div class="clausula-texto">As Partes elegem o foro da Circunscrição Judiciária de Brasília – DF para dirimir os conflitos que porventura venham a surgir em decorrência da execução do presente contrato, com renúncia de qualquer outro, por mais privilegiado que seja.</div>' +
    '<div class="clausula-texto">E por assim estarem de acordo, o contrato será assinado de forma digitalizada, sendo as vias compartilhadas em meio eletrônico e permitida a assinatura híbrida (física e digital).</div>' +
    '<div id="espaco-nota-promissoria-loja"></div>' +
    '<div style="text-align:center; margin-top:8px;">Brasília-DF, ' + dataAtual + '.</div>' +
    '<div class="assinatura"><div class="assinatura-nome">CONTRATADA:</div><div class="linha-assinatura"></div><div class="assinatura-nome">TRALALÁ DECORAÇÕES DE FESTA — CNPJ: 21.918.863/0001-12</div><div class="assinatura-nome" style="font-size:9pt; margin-top:4px;">REPRESENTANTE LEGAL: ALINE ARAUJO DO VALLE</div></div>' +
    '<div class="assinatura"><div class="assinatura-nome">CONTRATANTE:</div><div class="linha-assinatura"></div><div class="assinatura-nome">' + nome + ' — CPF: ' + cpf + '</div></div>' +
    '<div class="rodape-loja">TRALALÁ DECORAÇÕES DE FESTAS — QN 508 CONJUNTO 03 LOJA 06, SAMAMBAIA SUL. (61) 9. 8191-9559</div>' +
  '</div>';
}

// ============================================================
// KITS
// ============================================================
function renderKits() {
  var container = document.getElementById("lista-kits-render");
  if (!container) return;
  if (State.kits.length === 0) { container.innerHTML = '<p style="text-align:center; color:#999;">Nenhum kit cadastrado ainda.</p>'; return; }
  var html = "";
  State.kits.forEach(function(kit) {
    var pecas = kit.pecas || [];
    var temas = kit.temas || [];
    var total = 0;
    pecas.forEach(function(nome) { var it = State.estoqueMap[nome]; if (it) total += (parseFloat(it.preco) || 0); });
    temas.forEach(function(nome) { var it = State.estoqueMap[nome]; if (it) total += (parseFloat(it.preco) || 0); });
    var img = kit.imagem ? '<img src="' + kit.imagem + '" style="width:70px;height:70px;object-fit:cover;border-radius:8px;margin-right:10px;">' : '';
    html += '<div class="card-kit">' +
      '<div class="kit-header"><strong>🎁 ' + (kit.nome || 'Sem Nome') + '</strong><span class="badge-contador">Qtd: ' + (kit.quantidade || 1) + '</span></div>' +
      '<div class="kit-body" style="display:flex;">' + img + '<div style="flex:1;">' +
      '<div>🎨 <b>Temas:</b> ' + (temas.length ? temas.join(", ") : "—") + '</div>' +
      '<div>📦 <b>Peças (' + pecas.length + '):</b> ' + (pecas.length ? pecas.slice(0,5).join(", ") + (pecas.length > 5 ? '...' : '') : "—") + '</div>' +
      '<div>💰 <b>Valor sugerido:</b> ' + Utils.formatCurrency(total) + '</div></div></div>' +
      '<div class="kit-actions">' +
      '<button class="btn-promover-kit" onclick="window.promoverKitParaFesta(\'' + kit.id + '\')">✅ Promover p/ Festa</button>' +
      '<button class="btn-remover-kit" onclick="window.removerKit(\'' + kit.id + '\')">🗑️ Remover</button></div></div>';
  });
  container.innerHTML = html;
}

window.promoverKitParaFesta = function(idKit) {
  var kit = State.kits.filter(function(k) { return k.id === idKit; })[0];
  if (!kit) return;
  var nomeKitFesta = "Kit Customizado";
  document.querySelectorAll('.btn-kit-opcao').forEach(function(b) { b.classList.remove('ativo'); });
  State.kitAtual = nomeKitFesta;
  State.pecasSelecionadasKit[nomeKitFesta] = kit.pecas || [];
  State.pecasQtdKit[nomeKitFesta] = kit.pecasQtd || {};
  if (kit.temas && kit.temas.length > 0) {
    State.temasSelecionadosKit[nomeKitFesta] = kit.temas[0];
    State.temaAtual = kit.temas[0];
    State.temaAtualObj = State.estoqueMap[kit.temas[0]] || null;
    var filtro = document.getElementById("filtro-tema-input");
    var hidden = document.getElementById("busca-tema-input");
    if (filtro) filtro.value = kit.temas[0];
    if (hidden) hidden.value = kit.temas[0];
  }
  var box = document.getElementById("kit-acoes-box");
  var nome = document.getElementById("kit-acoes-nome");
  if (box) box.classList.add("ativo");
  if (nome) nome.textContent = nomeKitFesta;
  atualizarInfoKitFesta();
  atualizarResumoSelecao();
  calcularSomaAutomatica();
  var painelKits = document.getElementById("painel-gerador-kits");
  if (painelKits) painelKits.style.display = "none";
  window.scrollTo({ top: 0, behavior: 'smooth' });
  Utils.showToast("✅ Kit promovido! Preencha os dados do cliente.", "success");
};

window.removerKit = function(idKit) {
  if (confirm("Remover este kit?")) {
    Database.excluirKitNuvem(idKit).then(function() { Utils.showToast("Kit removido!", "success"); }).catch(function() { Utils.showToast("Falha ao remover.", "error"); });
  }
};

function salvarKit() {
  var nomeEl = document.getElementById("kit-nome");
  var qtdEl = document.getElementById("kit-quantidade");
  var imgInput = document.getElementById("kit-imagem");
  var nome = nomeEl ? nomeEl.value.trim() : "";
  var qtd = qtdEl ? (parseInt(qtdEl.value) || 1) : 1;
  if (!nome) return Utils.showToast("Preencha o nome do kit.", "warning");
  if (!State.kitCriando.pecas || State.kitCriando.pecas.length === 0) {
    if (!State.kitCriando.temas || State.kitCriando.temas.length === 0) return Utils.showToast("Selecione pelo menos uma peça ou tema.", "warning");
  }
  var processar = function(img) {
    ModalStatus.exibir("SALVANDO KIT...", nome);
    Database.salvarKitNuvem({ nome, quantidade: qtd, pecas: State.kitCriando.pecas || [], pecasQtd: State.kitCriando.pecasQtd || {}, temas: State.kitCriando.temas || [], imagem: img || "", criadoEm: Date.now() })
      .then(function() {
        ModalStatus.sucesso("✓ KIT SALVO");
        if (nomeEl) nomeEl.value = "";
        if (qtdEl) qtdEl.value = "1";
        if (imgInput) imgInput.value = "";
        State.kitCriando = { nome: "", quantidade: 1, pecas: [], temas: [], imagem: "", pecasQtd: {} };
        atualizarInfoKitCriando();
      }).catch(function() { ModalStatus.erro("Erro ao salvar kit."); });
  };
  if (imgInput && imgInput.files && imgInput.files[0]) {
    reduzirImagem(imgInput.files[0], 600, 0.85).then(processar).catch(function() { processar(""); });
  } else { processar(""); }
}

// ============================================================
// SALVAR FESTA
// ============================================================
function handleSalvarFesta() {
  var elCliente = document.getElementById("nome-cliente");
  var elData = document.getElementById("data");
  var hidden = document.getElementById("busca-tema-input");
  var filtro = document.getElementById("filtro-tema-input");
  var cliente = elCliente ? elCliente.value.trim() : "";
  var data = elData ? elData.value : "";
  if (hidden && hidden.value.trim()) State.temaAtual = hidden.value.trim();
  else if (filtro && filtro.value.trim()) State.temaAtual = filtro.value.trim();
  if (!cliente || !data || !State.temaAtual || !State.kitAtual) return Utils.showToast("Preencha cliente, data, tema e selecione o kit!", "warning");
  var disp = verificarDisponibilidadeTema(data, State.temaAtual);
  if (!disp.livre) return Utils.showToast("🚫 Tema \"" + disp.tema + "\" já está alugado em " + Utils.formatDateBR(data) + " (" + disp.jaUsado + "/" + disp.disponivel + " já reservado). Escolha outra data ou outro tema.", "error");
  abrirModalQtdPecas();
}

// ============================================================
// MODAL QUANTIDADE DE PEÇAS
// ============================================================
function abrirModalQtdPecas() {
  var container = document.getElementById("lista-qtd-pecas");
  var pecas = State.pecasSelecionadasKit[State.kitAtual] || [];
  if (pecas.length === 0) { salvarReservaFinal(null); return; }
  var html = "";
  pecas.forEach(function(nome) {
    var item = State.estoqueMap[nome];
    var disponivel = item ? (parseInt(item.quantidade) || 0) : 0;
    var preco = item ? (parseFloat(item.preco) || 0) : 0;
    var img = item && item.imagem ? '<img src="' + item.imagem + '" style="width:50px;height:50px;border-radius:6px;object-fit:cover;flex-shrink:0;">' : '<div style="width:50px;height:50px;background:#eee;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#888;flex-shrink:0;">Sem Foto</div>';
    html += '<div style="display:flex; gap:10px; align-items:center; padding:10px; border-bottom:1px solid #eee;">' +
      img + '<div style="flex:1;">' +
      '<div style="font-weight:600;">' + nome + '</div>' +
      '<div style="font-size:11px; color:var(--text-muted);">Disponível: <b>' + disponivel + '</b> | ' + Utils.formatCurrency(preco) + '</div></div>' +
      '<div><label style="font-size:11px;">Qtd:</label><input type="number" class="input-qtd-peca" data-peca="' + nome.replace(/"/g, '&quot;') + '" min="0" max="' + disponivel + '" value="1" style="width:70px; padding:6px; border:1.5px solid #ddd; border-radius:6px; text-align:center;"></div>' +
      '</div>';
  });
  container.innerHTML = html;
  document.getElementById("modal-qtd-pecas").classList.add("ativo");
}

function salvarReservaFinal(pecasQtd) {
  var elCliente = document.getElementById("nome-cliente");
  var elCpf = document.getElementById("cliente-cpf");
  var elTelefone = document.getElementById("cliente-telefone");
  var elEndereco = document.getElementById("cliente-endereco");
  var elLocal = document.getElementById("local-evento");
  var elData = document.getElementById("data");
  var elTotal = document.getElementById("valor-total");
  var elSinal = document.getElementById("valor-sinal");
  var elObs = document.getElementById("adicionais-festa");
  var elValorFesta = document.getElementById("valor-festa");
  var hidden = document.getElementById("busca-tema-input");
  var filtro = document.getElementById("filtro-tema-input");
  var cliente = elCliente ? elCliente.value.trim() : "";
  var cpf = elCpf ? elCpf.value.trim() : "";
  var telefone = elTelefone ? elTelefone.value.trim() : "";
  var endereco = elEndereco ? elEndereco.value.trim() : "";
  var local = elLocal ? elLocal.value.trim() : "";
  var data = elData ? elData.value : "";
  var total = elTotal ? elTotal.value || "0" : "0";
  var sinal = elSinal ? elSinal.value || "0" : "0";
  var obs = elObs ? elObs.value.trim() : "";
  var valorFesta = elValorFesta ? (parseFloat(elValorFesta.value) || 0) : 0;
  var f = FreteCalc.calcular();
  var pecasDoKit = State.pecasSelecionadasKit[State.kitAtual] || [];
  var temaDoKit = State.temasSelecionadosKit[State.kitAtual] || State.temaAtual;
  var modeloContrato = State.montarNoLocal ? "com-frete" : "pegue-monte";
  var dadosReserva = {
    cliente: safe(cliente), cpf: safe(cpf), telefone: safe(telefone),
    endereco: safe(endereco), local: safe(local), data: safe(data),
    tema: safe(temaDoKit), kit: safe(State.kitAtual),
    pecas: Array.isArray(pecasDoKit) ? pecasDoKit : [],
    pecasQtd: pecasQtd || null,
    montarNoLocal: !!State.montarNoLocal,
    total: safe(total), sinal: safe(sinal), valorFesta: valorFesta || 0,
    frete: f.freteTotal || 0,
    freteKmIda: f.kmIda || 0, freteKmTotal: f.kmTotal || 0,
    freteSegundaViagem: !!f.segundaViagem,
    fretePrecoCombustivel: f.precoCombustivel || 0, freteLitros: f.litros || 0,
    freteCustoCombustivel: f.custoCombustivel || 0, freteManutencao: f.manutencao || 0,
    freteTotal: f.freteTotal || 0,
    modeloContrato: safe(modeloContrato), obs: safe(obs),
    desconto: State.descontoAplicado || { tipo: "percent", valor: 0, totalOriginal: 0, totalFinal: 0 },
    dataCriacao: Utils.getHojeDataString()
  };
  ModalStatus.exibir("SALVANDO RESERVA...", cliente);
  Database.salvarReservaNuvem(dadosReserva).then(function() {
    if (pecasQtd && Object.keys(pecasQtd).length > 0) {
      Object.keys(pecasQtd).forEach(function(nomePeca) {
        var item = State.estoqueMap[nomePeca];
        if (item && item.idFirebase) {
          var qtdUsada = pecasQtd[nomePeca];
          var qtdAtual = parseInt(item.quantidade) || 0;
          var novaQtd = Math.max(0, qtdAtual - qtdUsada);
          Database.atualizarPecaNuvem(item.idFirebase, { quantidade: novaQtd });
        }
      });
    }
    ModalStatus.sucesso("✓ RESERVA SALVA");
    var dadosContrato = {
      nome: safe(cliente), cpf: safe(cpf), telefone: safe(telefone),
      endereco: safe(endereco), local: safe(local), data: safe(data),
      horario: "", dataRetirada: safe(data), dataDevolucao: safe(data),
      valor: parseFloat(total) || 0,
      pecas: Array.isArray(pecasDoKit) ? pecasDoKit : [],
      pecasQtd: pecasQtd || null,
      tema: safe(temaDoKit), obs: safe(obs)
    };
    var htmlContrato = modeloContrato === "com-frete" ? gerarContratoComFrete(dadosContrato) : gerarContratoPegueMonte(dadosContrato);
    Database.salvarContratoNuvem({
      nome: safe(cliente), cpf: safe(cpf), data: safe(data),
      valor: parseFloat(total) || 0, modelo: safe(modeloContrato),
      tema: safe(temaDoKit), pecas: Array.isArray(pecasDoKit) ? pecasDoKit : [],
      obs: safe(obs), criadoEm: Date.now()
    }).catch(function(err) { console.warn("Contrato não salvo:", err); });
    var preview = document.getElementById("contrato-preview-content");
    if (preview) { preview.innerHTML = htmlContrato; preview.contentEditable = "false"; }
    document.getElementById("btn-editar-contrato").style.display = "inline-flex";
    document.getElementById("btn-salvar-edicao-contrato").style.display = "none";
    document.getElementById("btn-add-nota-promissoria").style.display = "none";
    window.__contratoTipo = modeloContrato;
    var modalVis = document.getElementById("modal-visualizar-contrato");
    if (modalVis) modalVis.classList.add("ativo");
    if (elCliente) elCliente.value = "";
    if (elCpf) elCpf.value = "";
    if (elTelefone) elTelefone.value = "";
    if (elEndereco) elEndereco.value = "";
    if (elLocal) elLocal.value = "";
    if (elData) elData.value = "";
    if (elTotal) elTotal.value = "";
    if (elSinal) elSinal.value = "";
    if (elObs) elObs.value = "";
    if (elValorFesta) elValorFesta.value = "0.00";
    State.temaAtual = ""; State.temaAtualObj = null; State.kitAtual = ""; State.montarNoLocal = false;
    State.pecasSelecionadasKit = {};
    State.temasSelecionadosKit = {};
    State.pecasQtdKit = {};
    State.descontoAplicado = { tipo: "percent", valor: 0, totalOriginal: 0, totalFinal: 0 };
    if (hidden) hidden.value = "";
    if (filtro) filtro.value = "";
    document.querySelectorAll('.btn-kit-opcao').forEach(function(b) { b.classList.remove('ativo'); });
    var kitBox = document.getElementById("kit-acoes-box");
    if (kitBox) kitBox.classList.remove("ativo");
    var painelMontagem = document.getElementById("painel-montagem-local");
    if (painelMontagem) painelMontagem.style.display = "none";
    var chk = document.getElementById("chk-montar-local");
    if (chk) chk.checked = false;
    var resumo = document.getElementById("resumo-selecao");
    if (resumo) resumo.style.display = "none";
    var detalhes = document.getElementById("detalhes-soma");
    if (detalhes) detalhes.innerHTML = "";
    var resultadoDesc = document.getElementById("resultado-desconto");
    if (resultadoDesc) resultadoDesc.innerHTML = "";
    var descValor = document.getElementById("desconto-valor");
    if (descValor) descValor.value = "";
    FreteCalc.limpar();
  }).catch(function(err) {
    console.error(err);
    ModalStatus.erro("Erro ao salvar reserva.");
  });
}

window.ConfirmarQtdPecas = function() {
  var inputs = document.querySelectorAll(".input-qtd-peca");
  var pecasQtd = {};
  var valido = true;
  inputs.forEach(function(input) {
    var nome = input.getAttribute("data-peca");
    var qtd = parseInt(input.value) || 0;
    var max = parseInt(input.max) || 0;
    if (qtd > max) {
      Utils.showToast("❌ " + nome + ": você pediu " + qtd + " mas só tem " + max + " disponível.", "error");
      valido = false;
    }
    if (qtd > 0) pecasQtd[nome] = qtd;
  });
  if (!valido) return;
  document.getElementById("modal-qtd-pecas").classList.remove("ativo");
  salvarReservaFinal(pecasQtd);
};

function handleSalvarOrcamento() {
  var clienteEl = document.getElementById("nome-cliente");
  var cpfEl = document.getElementById("cliente-cpf");
  var totalEl = document.getElementById("valor-total");
  var dataEl = document.getElementById("data");
  var obsEl = document.getElementById("adicionais-festa");
  var vfEl = document.getElementById("valor-festa");
  var nomeCliente = clienteEl ? clienteEl.value.trim() : "";
  if (!nomeCliente) return Utils.showToast("Preencha o nome do cliente.", "warning");
  var f = FreteCalc.calcular();
  Database.salvarOrcamentoNuvem({
    cliente: safe(nomeCliente), cpf: safe(cpfEl ? cpfEl.value.trim() : ""),
    tema: safe(State.temaAtual) || "Não selecionado", kit: safe(State.kitAtual),
    pecas: Array.isArray(State.pecasSelecionadasKit[State.kitAtual]) ? State.pecasSelecionadasKit[State.kitAtual] : [],
    montarNoLocal: !!State.montarNoLocal, total: safe(totalEl ? totalEl.value : "0"),
    valorFesta: vfEl ? (parseFloat(vfEl.value) || 0) : 0,
    frete: f.freteTotal || 0, freteKmIda: f.kmIda || 0, freteKmTotal: f.kmTotal || 0, freteSegundaViagem: !!f.segundaViagem,
    fretePrecoCombustivel: f.precoCombustivel || 0, freteLitros: f.litros || 0,
    freteCustoCombustivel: f.custoCombustivel || 0, freteManutencao: f.manutencao || 0, freteTotal: f.freteTotal || 0,
    dataFesta: safe(dataEl ? dataEl.value : ""), obs: safe(obsEl ? obsEl.value.trim() : ""),
    desconto: State.descontoAplicado, dataCriacao: Utils.getHojeDataString(), horaCriacao: Utils.getHoraString()
  }).then(function() { Utils.showToast("Orçamento salvo!", "success"); })
    .catch(function() { Utils.showToast("Erro ao salvar orçamento.", "error"); });
}

// ============================================================
// BIND EVENTOS
// ============================================================
function bindTudo() {
  var b;
  b = document.getElementById("btn-login-direto");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); handleLogin(); };
  b = document.getElementById("btn-logout-direto");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); handleLogout(); };
  var senhaEl = document.getElementById("senha");
  if (senhaEl) senhaEl.onkeypress = function(e) { if (e.key === "Enter") { var l = document.getElementById("btn-login-direto"); if (l) l.click(); } };
  b = document.getElementById("btn-ponto-entrada");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); Database.registrarPonto('entrada'); };
  b = document.getElementById("btn-ponto-saida");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); Database.registrarPonto('saida'); };
  b = document.getElementById("btn-abrir-relatorio-pontos");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); var p = document.getElementById("painel-relatorio-pontos-geral"); if (p) p.style.display = (p.style.display === "none" || p.style.display === "") ? "block" : "none"; };
  b = document.getElementById("btn-abrir-central-relatorios");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); var p = document.getElementById("secao-central-relatorios"); if (!p) return; var abrindo = (p.style.display === "none" || p.style.display === ""); p.style.display = abrindo ? "block" : "none"; if (abrindo) renderPlanilhaVendas(); };
  b = document.getElementById("btn-fechar-central-relatorios");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); var p = document.getElementById("secao-central-relatorios"); if (p) p.style.display = "none"; };
  b = document.getElementById("seletor-mes-planilha");
  if (b) b.onchange = function() { renderPlanilhaVendas(); };
  b = document.getElementById("btn-transformar-grafico");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); renderGraficoAnual(); };
  b = document.getElementById("btn-toggle-grafico");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); var pg = document.getElementById("painel-grafico-faturamento"); if (pg) pg.style.display = pg.style.display === 'none' ? 'block' : 'none'; };
  b = document.getElementById("btn-abrir-orcamentos");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); var p = document.getElementById("card-orcamentos-integrado"); if (!p) return; var abrindo = (p.style.display === "none" || p.style.display === ""); p.style.display = abrindo ? "block" : "none"; if (abrindo) renderOrcamentos(); };
  b = document.getElementById("btn-abrir-reunioes-painel");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); var p = document.getElementById("painel-reunioes-exclusivo"); if (!p) return; var abrindo = (p.style.display === "none" || p.style.display === ""); p.style.display = abrindo ? "block" : "none"; if (abrindo) iniciarPainelReunioes(); };
  b = document.getElementById("btn-fechar-reunioes");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); var p = document.getElementById("painel-reunioes-exclusivo"); if (p) p.style.display = "none"; };
  b = document.getElementById("btn-salvar-reuniao-avulsa");
  if (b) b.onclick = function(e) {
    if (e) e.preventDefault();
    var c = document.getElementById("reuniao-cliente"); var d = document.getElementById("reuniao-data-hora"); var pa = document.getElementById("reuniao-pauta");
    var cliente = c ? c.value.trim() : ""; var dataHora = d ? d.value : ""; var pauta = pa ? pa.value.trim() : "";
    if (!cliente || !dataHora) return Utils.showToast("Preencha cliente e data/hora.", "warning");
    ModalStatus.exibir("AGENDANDO...", cliente);
    Database.salvarReuniaoNuvem({ cliente, dataHora, pauta, criadoEm: Date.now() })
      .then(function() { ModalStatus.sucesso("✓ REUNIÃO AGENDADA"); if (c) c.value = ""; if (d) d.value = ""; if (pa) pa.value = ""; })
      .catch(function() { ModalStatus.erro("Erro ao agendar."); });
  };
  b = document.getElementById("btn-abrir-catalogo-temas");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); var p = document.getElementById("painel-catalogo-temas"); if (!p) return; var abrindo = (p.style.display === "none" || p.style.display === ""); p.style.display = abrindo ? "block" : "none"; if (abrindo) renderizarTemas(); };
  b = document.getElementById("btn-abrir-gerador-kits");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); var p = document.getElementById("painel-gerador-kits"); if (!p) return; var abrindo = (p.style.display === "none" || p.style.display === ""); p.style.display = abrindo ? "block" : "none"; if (abrindo) renderKits(); };
  b = document.getElementById("btn-fechar-gerador-kits");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); var p = document.getElementById("painel-gerador-kits"); if (p) p.style.display = "none"; };
  b = document.getElementById("btn-kit-selecionar-pecas");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); abrirModalPecas("kit"); };
  b = document.getElementById("btn-kit-selecionar-temas");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); abrirModalTema("kit"); };
  b = document.getElementById("btn-salvar-kit");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); salvarKit(); };
  b = document.getElementById("btn-abrir-gerador-contrato");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); var m = document.getElementById("modal-gerador-contrato"); if (m) m.classList.add("ativo"); carregarTemasNoContrato(); initContratoBusca(); };
  b = document.getElementById("btn-fechar-modal-contrato");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); var m = document.getElementById("modal-gerador-contrato"); if (m) m.classList.remove("ativo"); };
  var modalContrato = document.getElementById("modal-gerador-contrato");
  if (modalContrato) { modalContrato.addEventListener('click', function(e) { if (e.target === modalContrato) modalContrato.classList.remove("ativo"); }); }
  b = document.getElementById("btn-gerar-salvar-contrato");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); gerarContratoAvulso(false); };
  b = document.getElementById("btn-gerar-pdf-contrato");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); gerarContratoAvulso(true); };
  b = document.getElementById("btn-abrir-pecas-contrato");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); abrirModalPecas("contrato"); };
  var modalVis = document.getElementById("modal-visualizar-contrato");
  if (modalVis) {
    var fv = document.getElementById("btn-fechar-visualizacao");
    if (fv) fv.onclick = function() { modalVis.classList.remove("ativo"); };
    modalVis.addEventListener('click', function(e) { if (e.target === modalVis) modalVis.classList.remove("ativo"); });
  }
  b = document.getElementById("btn-baixar-pdf-contrato");
  if (b) b.onclick = function() { window.BaixarPDFContrato(); };
  b = document.getElementById("btn-imprimir-contrato");
  if (b) b.onclick = function() { window.ImprimirContrato(); };
  b = document.getElementById("btn-editar-contrato");
  if (b) b.onclick = function() { window.EditarContrato(); };
  b = document.getElementById("btn-salvar-edicao-contrato");
  if (b) b.onclick = function() { window.SalvarEdicaoContrato(); };
  b = document.getElementById("btn-add-nota-promissoria");
  if (b) b.onclick = function() { window.AbrirNotaPromissoria(); };
  b = document.getElementById("btn-fechar-modal-nota");
  if (b) b.onclick = function() { document.getElementById("modal-nota-promissoria").classList.remove("ativo"); };
  b = document.getElementById("btn-cancelar-nota");
  if (b) b.onclick = function() { document.getElementById("modal-nota-promissoria").classList.remove("ativo"); };
  b = document.getElementById("btn-gerar-nota");
  if (b) b.onclick = function() { window.GerarNotaPromissoria(); };
  b = document.getElementById("btn-fechar-modal-qtd");
  if (b) b.onclick = function() { document.getElementById("modal-qtd-pecas").classList.remove("ativo"); };
  b = document.getElementById("btn-cancelar-qtd");
  if (b) b.onclick = function() { document.getElementById("modal-qtd-pecas").classList.remove("ativo"); };
  b = document.getElementById("btn-confirmar-qtd");
  if (b) b.onclick = function() { window.ConfirmarQtdPecas(); };
  b = document.getElementById("btn-fechar-editar-reserva");
  if (b) b.onclick = function() { document.getElementById("modal-editar-reserva").classList.remove("ativo"); };
  b = document.getElementById("btn-cancelar-editar-reserva");
  if (b) b.onclick = function() { document.getElementById("modal-editar-reserva").classList.remove("ativo"); };
  b = document.getElementById("btn-salvar-editar-reserva");
  if (b) b.onclick = function() { window.SalvarEditarReserva(); };
  var botoesKit = document.querySelectorAll('.btn-kit-opcao');
  botoesKit.forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      botoesKit.forEach(function(x) { x.classList.remove('ativo'); });
      btn.classList.add('ativo');
      var nomeKit = btn.getAttribute('data-kit');
      State.kitAtual = nomeKit;
      var box = document.getElementById("kit-acoes-box");
      var nome = document.getElementById("kit-acoes-nome");
      if (box) box.classList.add("ativo");
      if (nome) nome.textContent = nomeKit;
      atualizarInfoKitFesta();
      atualizarResumoSelecao();
      Utils.showToast('Kit "' + nomeKit + '" selecionado!', "success");
    };
  });
  b = document.getElementById("btn-esc-pecas");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); if (!State.kitAtual) return Utils.showToast("Selecione um kit.", "warning"); abrirModalPecas("kit-festa"); };
  b = document.getElementById("btn-esc-tema");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); if (!State.kitAtual) return Utils.showToast("Selecione um kit.", "warning"); abrirModalTema("kit-festa"); };
  b = document.getElementById("btn-fechar-modal-pecas");
  if (b) b.onclick = function() { window.fecharModalPecas(); };
  b = document.getElementById("btn-cancelar-pecas");
  if (b) b.onclick = function() { window.fecharModalPecas(); };
  b = document.getElementById("btn-confirmar-pecas");
  if (b) b.onclick = function() { confirmarModalPecas(); };
  var filtroPecas = document.getElementById("filtro-pecas");
  if (filtroPecas) filtroPecas.oninput = function(e) { renderizarListaPecasModal(modalPecasContexto, e.target.value); };
  b = document.getElementById("btn-fechar-modal-tema");
  if (b) b.onclick = function() { document.getElementById("modal-tema-reserva").classList.remove("ativo"); };
  b = document.getElementById("btn-cancelar-tema");
  if (b) b.onclick = function() { document.getElementById("modal-tema-reserva").classList.remove("ativo"); };
  b = document.getElementById("btn-confirmar-tema");
  if (b) b.onclick = function() { confirmarModalTema(); };
  var filtroTemaModal = document.getElementById("filtro-tema-modal");
  if (filtroTemaModal) filtroTemaModal.oninput = function(e) { renderizarListaTemasModal(e.target.value); };
  var chkMontar = document.getElementById("chk-montar-local");
  if (chkMontar) {
    chkMontar.onchange = function() {
      State.montarNoLocal = !!chkMontar.checked;
      var painel = document.getElementById("painel-montagem-local");
      if (painel) painel.style.display = chkMontar.checked ? "block" : "none";
    };
  }
  var kmEl = document.getElementById("calc-km");
  var precoEl = document.getElementById("calc-valor-litro");
  var chkSegunda = document.getElementById("chk-segunda-viagem");
  if (kmEl) { kmEl.oninput = function() { FreteCalc.renderizar(); }; kmEl.onchange = function() { FreteCalc.renderizar(); }; }
  if (precoEl) { precoEl.oninput = function() { FreteCalc.renderizar(); }; precoEl.onchange = function() { FreteCalc.renderizar(); }; }
  if (chkSegunda) { chkSegunda.onchange = function() { FreteCalc.renderizar(); }; }
  var vfEl = document.getElementById("valor-festa");
  if (vfEl) vfEl.oninput = function() { recalcularTotais(); };
  var sinalEl = document.getElementById("valor-sinal");
  if (sinalEl) sinalEl.oninput = function() { recalcularTotais(); };
  b = document.getElementById("btn-soma-automatica");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); calcularSomaAutomatica(); };
  b = document.getElementById("btn-aplicar-desconto");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); aplicarDesconto(); };
  b = document.getElementById("btn-confirmar-agendamento");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); handleSalvarFesta(); };
  b = document.getElementById("btn-salvar-como-orcamento");
  if (b) b.onclick = function(e) { if (e) e.preventDefault(); handleSalvarOrcamento(); };
  b = document.getElementById("btn-adicionar-peca");
  if (b) b.onclick = function(e) {
    if (e) e.preventDefault();
    var nome = (document.getElementById("catalogo-peca-nome") || {}).value || "";
    var qtd = parseInt((document.getElementById("catalogo-peca-qtd") || {}).value) || 1;
    var categoria = (document.getElementById("catalogo-peca-categoria") || {}).value || "Outros";
    var modelo = (document.getElementById("catalogo-peca-modelo") || {}).value || "";
    var preco = parseFloat((document.getElementById("catalogo-peca-preco") || {}).value) || 0;
    var precoRep = parseFloat((document.getElementById("catalogo-peca-preco-reposicao") || {}).value) || 0;
    var fileInput = document.getElementById("catalogo-peca-imagem");
    nome = nome.trim();
    if (!nome) return Utils.showToast("Preencha o nome do tema/peça!", "warning");
    var executar = function(img) {
      Database.salvarPecaNuvem({ nome, quantidade: qtd, categoria, modelo, preco, precoReposicao: precoRep, imagem: img || "" }).then(function() {
        var nEl = document.getElementById("catalogo-peca-nome"); if (nEl) nEl.value = "";
        var qEl = document.getElementById("catalogo-peca-qtd"); if (qEl) qEl.value = "1";
        var mEl = document.getElementById("catalogo-peca-modelo"); if (mEl) mEl.value = "";
        var pEl = document.getElementById("catalogo-peca-preco"); if (pEl) pEl.value = "0";
        var prEl = document.getElementById("catalogo-peca-preco-reposicao"); if (prEl) prEl.value = "0";
        var iEl = document.getElementById("catalogo-peca-imagem"); if (iEl) iEl.value = "";
      });
    };
    if (fileInput && fileInput.files && fileInput.files[0]) {
      reduzirImagem(fileInput.files[0], 900, 0.82).then(executar).catch(function() { executar(""); });
    } else { executar(""); }
  };
  b = document.getElementById("btn-adicionar-categoria");
  if (b) b.onclick = function(e) {
    if (e) e.preventDefault();
    var input = document.getElementById("input-nova-categoria");
    var nome = input ? input.value.trim() : "";
    if (!nome) return Utils.showToast("Digite um nome.", "warning");
    window.adicionarCategoria(nome).then(function() { Utils.showToast("Categoria adicionada!", "success"); if (input) { input.value = ""; input.focus(); } })
      .catch(function(err) { Utils.showToast(String(err), "warning"); });
  };
  var inputCat = document.getElementById("input-nova-categoria");
  if (inputCat) inputCat.onkeypress = function(e) { if (e.key === "Enter") { var bt = document.getElementById("btn-adicionar-categoria"); if (bt) bt.click(); } };
  b = document.getElementById("btn-remover-categoria");
  if (b) b.onclick = function(e) {
    if (e) e.preventDefault();
    var s = document.getElementById("select-remover-categoria"); var cat = s ? s.value : "";
    if (!cat) return Utils.showToast("Selecione uma categoria.", "warning");
    window.removerCategoria(cat).then(function() { Utils.showToast("Categoria removida!", "success"); })
      .catch(function(err) { Utils.showToast(String(err), "warning"); });
  };
  b = document.getElementById("btn-remover-tema-admin");
  if (b) b.onclick = function(e) {
    if (e) e.preventDefault();
    var s = document.getElementById("select-remover-tema"); var idx = s ? parseInt(s.value) : NaN;
    if (isNaN(idx)) return Utils.showToast("Selecione um tema válido!", "warning");
    window.removerTema(idx);
  };
  
  // NOVOS BOTÕES: Orçamentos em Aberto
  b = document.getElementById("btn-abrir-orcamentos-aberto");
  if (b) b.onclick = function(e) { 
    if (e) e.preventDefault(); 
    var p = document.getElementById("painel-orcamentos-aberto"); 
    if (!p) return; 
    var abrindo = (p.style.display === "none" || p.style.display === ""); 
    p.style.display = abrindo ? "block" : "none"; 
    if (abrindo) listenOrcamentosAbertos(); 
  };
  
  b = document.getElementById("btn-fechar-orcamentos-aberto");
  if (b) b.onclick = function(e) { 
    if (e) e.preventDefault(); 
    var p = document.getElementById("painel-orcamentos-aberto"); 
    if (p) p.style.display = "none"; 
  };

  b = document.getElementById("btn-salvar-orcamento-aberto");
  if (b) b.onclick = function(e) {
    if (e) e.preventDefault();
    var dados = {
      cliente: document.getElementById("oa-cliente").value.trim(),
      whatsapp: document.getElementById("oa-whatsapp").value.trim(),
      dataFesta: document.getElementById("oa-data-festa").value,
      horarioFesta: document.getElementById("oa-horario-festa").value,
      endereco: document.getElementById("oa-endereco").value.trim(),
      tema: document.getElementById("oa-tema").value.trim(),
      tipoServico: document.getElementById("oa-tipo-servico").value,
      kit: document.getElementById("oa-kit").value,
      adicionais: document.getElementById("oa-adicionais-desc").value.trim(),
      descricao: document.getElementById("oa-descricao-itens").value.trim(),
      valorKit: parseFloat(document.getElementById("oa-valor-kit").value) || 0,
      valorAdicionais: parseFloat(document.getElementById("oa-valor-adicionais").value) || 0,
      valorFrete: parseFloat(document.getElementById("oa-valor-frete").value) || 0,
      valorDesconto: parseFloat(document.getElementById("oa-valor-desconto").value) || 0,
      valorEntrada: parseFloat(document.getElementById("oa-valor-entrada").value) || 0,
      valorTotal: parseFloat(document.getElementById("oa-valor-total").value) || 0,
      prazoPagamento: document.getElementById("oa-prazo-pagamento").value.trim(),
      dataEnvio: document.getElementById("oa-data-envio").value,
      dataRetorno: document.getElementById("oa-data-retorno").value,
      status: document.getElementById("oa-status").value,
      obs: document.getElementById("oa-obs").value.trim(),
      criadoEm: Date.now()
    };
    
    if (!dados.cliente) return alert("Preencha o nome do cliente.");
    if (db) {
      db.ref('orcamentos_abertos').push(dados).then(function() {
        alert("Orçamento salvo com sucesso!");
        document.getElementById("oa-cliente").value = "";
        document.getElementById("oa-whatsapp").value = "";
      }).catch(function(err) {
        alert("Erro ao salvar: " + err.message);
      });
    }
  };

  // NOVO BOTÃO: Clientes e Campanhas
  b = document.getElementById("btn-abrir-clientes-campanhas");
  if (b) b.onclick = function(e) { 
    if (e) e.preventDefault(); 
    var p = document.getElementById("painel-clientes-campanhas"); 
    if (!p) return; 
    var abrindo = (p.style.display === "none" || p.style.display === ""); 
    p.style.display = abrindo ? "block" : "none"; 
    if (abrindo && window.iniciarClientesCampanhas) window.iniciarClientesCampanhas(); 
  };
  
  b = document.getElementById("btn-fechar-clientes-campanhas");
  if (b) b.onclick = function(e) { 
    if (e) e.preventDefault(); 
    var p = document.getElementById("painel-clientes-campanhas"); 
    if (p) p.style.display = "none"; 
  };
  
  initModalEditar();

  // Inicializa o cálculo automático dos valores do orçamento em aberto
  var inputsValores = ["oa-valor-kit", "oa-valor-adicionais", "oa-valor-frete", "oa-valor-desconto"];
  inputsValores.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.oninput = function() {
        var kit = parseFloat(document.getElementById("oa-valor-kit").value) || 0;
        var adic = parseFloat(document.getElementById("oa-valor-adicionais").value) || 0;
        var frete = parseFloat(document.getElementById("oa-valor-frete").value) || 0;
        var desc = parseFloat(document.getElementById("oa-valor-desconto").value) || 0;
        var total = kit + adic + frete - desc;
        document.getElementById("oa-valor-total").value = total.toFixed(2);
      };
    }
  });
}

// ============================================================
// FUNÇÃO GLOBAL DE FECHAR MODAL DE PEÇAS
// ============================================================
window.fecharModalPecas = function() {
  window.__reservaEditandoPecas = null;
  window.__selecaoTempModalPecas = { selecionadas: [], quantidades: {} };
  var titulo = document.getElementById("titulo-modal-pecas");
  if (titulo) titulo.textContent = "🍽️ Escolher Peças";
  var modal = document.getElementById("modal-pecas");
  if (modal) modal.classList.remove("ativo");
};

// ============================================================
// EDITAR PEÇAS DA RESERVA DIRETO NO CARD
// ============================================================
window.EditarPecasReserva = function(idReserva) {
  var res = State.reservas.filter(function(r) { return r.id === idReserva; })[0];
  if (!res) return Utils.showToast("Reserva não encontrada.", "error");

  window.__reservaEditandoPecas = idReserva;
  modalPecasContexto = "reserva";

  State.pecasSelecionadasContrato = Array.isArray(res.pecas) ? res.pecas.slice() : [];
  State.pecasQtdContrato = res.pecasQtd ? Object.assign({}, res.pecasQtd) : {};

  var modal = document.getElementById("modal-pecas");
  if (!modal) return Utils.showToast("Modal não encontrado.", "error");
  modal.classList.add("ativo");

  var titulo = document.getElementById("titulo-modal-pecas");
  if (titulo) titulo.textContent = "🍽️ Editar Peças — " + (res.cliente || "Reserva");

  renderizarListaPecasModal("reserva", "");

  setTimeout(function() {
    var f = document.getElementById("filtro-pecas");
    if (f) f.value = "";
  }, 50);
};

// ============================================================
// IMPRESSÃO — só o contrato
// ============================================================
window.ImprimirContrato = function() {
  var preview = document.getElementById("contrato-preview-content");
  if (!preview) return Utils.showToast("Nenhum contrato aberto.", "warning");
  var pagina = preview.querySelector('.pagina-contrato');
  if (!pagina) return Utils.showToast("Contrato não encontrado.", "warning");

  var modal = document.getElementById("modal-visualizar-contrato");
  if (!modal) return Utils.showToast("Modal de contrato não encontrado.", "error");
  if (!modal.classList.contains("ativo")) modal.classList.add("ativo");

  setTimeout(function() { window.print(); }, 300);
};

// ============================================================
// PDF — com html2canvas + jsPDF puro
// ============================================================


window.BaixarPDFContrato = async function() {
  const preview = document.getElementById("contrato-preview-content");
  const originais = preview
    ? Array.from(preview.querySelectorAll(".pagina-contrato"))
    : [];

  if (!originais.length) {
    return Utils.showToast("Contrato não encontrado.", "warning");
  }

  if (typeof html2canvas === "undefined") {
    return Utils.showToast("html2canvas não carregou.", "error");
  }

  const JsPDF = window.jspdf?.jsPDF || window.jsPDF;

  if (!JsPDF) {
    return Utils.showToast("jsPDF não carregou.", "error");
  }

  const nome = (
    document.getElementById("c-nome")?.value ||
    document.getElementById("nome-cliente")?.value ||
    "contrato"
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();

  const LARGURA = 794;
  const ALTURA = 1123;
  const MARGEM = 48;
  const MAX_PAGINAS = 3;

  const area = document.createElement("div");

  area.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: ${LARGURA}px;
    background: white;
    z-index: -1;
    pointer-events: none;
  `;

  document.body.appendChild(area);

  function criarPagina() {
    const pagina = document.createElement("div");

    pagina.className = "pagina-contrato";

    pagina.style.cssText = `
      width: ${LARGURA}px;
      height: ${ALTURA}px;
      min-height: ${ALTURA}px;
      max-height: ${ALTURA}px;
      padding: ${MARGEM}px;
      margin: 0;
      background: white;
      box-sizing: border-box;
      overflow: visible;
      box-shadow: none;
      border: none;
      border-radius: 0;
      position: relative;
      font-family: 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.4;
      color: black;
    `;

    area.appendChild(pagina);
    return pagina;
  }

  function cabeNaPagina(pagina) {
    const limite = pagina.getBoundingClientRect().bottom - MARGEM;
    const elementos = Array.from(pagina.querySelectorAll("*"));

    for (const elemento of elementos) {
      const estilo = getComputedStyle(elemento);

      if (
        estilo.position === "absolute" ||
        estilo.position === "fixed"
      ) {
        continue;
      }

      const rect = elemento.getBoundingClientRect();

      if (rect.height > 0 && rect.bottom > limite + 2) {
        return false;
      }
    }

    return true;
  }

  async function aguardarImagens() {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await Promise.all(
      Array.from(area.querySelectorAll("img")).map(img => {
        if (img.complete) return Promise.resolve();

        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );
  }

  const paginas = [];

  try {
    Utils.showToast("Preparando as páginas do contrato...", "info");

    if (originais.length > 1) {
      // Contratos já divididos em páginas, como o novo
      // contrato de Locação de Festa com montagem.
      if (originais.length > MAX_PAGINAS) {
        throw new Error(
          "O contrato possui mais de três páginas."
        );
      }

      for (const original of originais) {
        const pagina = criarPagina();

        pagina.innerHTML = original.innerHTML;
        paginas.push(pagina);
      }

      await aguardarImagens();

      for (let i = 0; i < paginas.length; i++) {
        if (!cabeNaPagina(paginas[i])) {
          throw new Error(
            "O conteúdo da página " + (i + 1) +
            " ultrapassou a folha A4. " +
            "Ajuste o tamanho ou os espaçamentos antes de gerar."
          );
        }
      }

    } else {
      // Compatibilidade com os modelos antigos,
      // que possuem somente uma .pagina-contrato.
      const original = originais[0];

      let atual = criarPagina();
      paginas.push(atual);

      const blocos = Array.from(original.children);

      for (const bloco of blocos) {
        const copia = bloco.cloneNode(true);

        atual.appendChild(copia);
        await aguardarImagens();

        if (!cabeNaPagina(atual)) {
          atual.removeChild(copia);

          if (paginas.length >= MAX_PAGINAS) {
            throw new Error(
              "O contrato não cabe em três páginas A4."
            );
          }

          atual = criarPagina();
          paginas.push(atual);

          atual.appendChild(copia);
          await aguardarImagens();

          if (!cabeNaPagina(atual)) {
            throw new Error(
              "Um bloco do contrato é maior que uma página."
            );
          }
        }
      }
    }

    // Completa até três páginas, mantendo o padrão
    // usado anteriormente pelo sistema.
    while (paginas.length < MAX_PAGINAS) {
      paginas.push(criarPagina());
    }

    await aguardarImagens();

    const pdf = new JsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true
    });

    for (let i = 0; i < paginas.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      const canvas = await html2canvas(paginas[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: LARGURA
      });

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.96),
        "JPEG",
        0,
        0,
        210,
        297
      );
    }

  
    pdf.save("contrato-" + nome + ".pdf");

    Utils.showToast(
      "PDF gerado com três páginas!",
      "success"
    );

  } catch (erro) {
    console.error("Erro ao gerar PDF:", erro);

    Utils.showToast(
      erro.message || "Erro ao gerar PDF.",
      "error"
    );

  } finally {
    area.remove();
  }
};

window.gerarContratoPDF = window.BaixarPDFContrato;

// ============================================================
// EDITAR CONTRATO MANUALMENTE
// ============================================================
window.EditarContrato = function() {
  var preview = document.getElementById("contrato-preview-content");
  if (!preview) return;
  preview.contentEditable = "true";
  preview.style.outline = "2px dashed #3498db";
  preview.style.padding = "10px";
  preview.style.borderRadius = "8px";
  document.getElementById("btn-editar-contrato").style.display = "none";
  document.getElementById("btn-salvar-edicao-contrato").style.display = "inline-flex";
  Utils.showToast("✏️ Contrato liberado para edição", "info");
};

window.SalvarEdicaoContrato = function() {
  if (!confirm("⚠️ Tem certeza que deseja salvar essas alterações?\n\nO contrato será salvo permanentemente.")) return;
  var preview = document.getElementById("contrato-preview-content");
  if (!preview) return;
  var htmlEditado = preview.innerHTML;
  ModalStatus.exibir("SALVANDO EDIÇÃO...", "Aguarde, estamos salvando.");
  Database.salvarContratoNuvem({
    nome: "EDIÇÃO MANUAL",
    contratoEditado: htmlEditado,
    modelo: window.__contratoTipo || "pegue-monte",
    criadoEm: Date.now(),
    editadoManualmente: true
  }).then(function() {
    preview.contentEditable = "false";
    preview.style.outline = "";
    preview.style.padding = "";
    preview.style.borderRadius = "";
    document.getElementById("btn-editar-contrato").style.display = "inline-flex";
    document.getElementById("btn-salvar-edicao-contrato").style.display = "none";
    ModalStatus.sucesso("✓ EDIÇÃO SALVA COM SUCESSO");
  }).catch(function(err) {
    console.error(err);
    ModalStatus.erro("Erro ao salvar edição.");
  });
};

// ============================================================
// NOTA PROMISSÓRIA
// ============================================================
window.AbrirNotaPromissoria = function() {
  var hoje = new Date();
  var dataEmitISO = hoje.toISOString().split("T")[0];
  var elEmissao = document.getElementById("nota-data-emissao");
  if (elEmissao) elEmissao.value = dataEmitISO;
  var elDia = document.getElementById("nota-dia");
  if (elDia) elDia.value = hoje.getDate();
  var elMes = document.getElementById("nota-mes");
  if (elMes) elMes.value = mesesExtenso[hoje.getMonth()];
  var elAno = document.getElementById("nota-ano");
  if (elAno) elAno.value = hoje.getFullYear();
  var elNum = document.getElementById("nota-numero"); if (elNum) elNum.value = "";
  var elValor = document.getElementById("nota-valor"); if (elValor) elValor.value = "";
  var elVenc = document.getElementById("nota-vencimento"); if (elVenc) elVenc.value = "";
  var elEvento = document.getElementById("nota-data-evento"); if (elEvento) elEvento.value = "";
  var modal = document.getElementById("modal-nota-promissoria");
  if (modal) modal.classList.add("ativo");
};

window.GerarNotaPromissoria = function() {
  var venc = (document.getElementById("nota-vencimento") || {}).value || "";
  var num = (document.getElementById("nota-numero") || {}).value || "____";
  var valor = parseFloat((document.getElementById("nota-valor") || {}).value) || 0;
  var dataEvento = (document.getElementById("nota-data-evento") || {}).value || "";
  var dia = (document.getElementById("nota-dia") || {}).value || "____";
  var mes = (document.getElementById("nota-mes") || {}).value || "__________________";
  var ano = (document.getElementById("nota-ano") || {}).value || "20____";
  var vencFmt = venc ? venc.split("-").reverse().join("/") : "____/____/______";
  var valorFmt = valor ? valor.toFixed(2).replace('.', ',') : "______,00";
  var eventoFmt = dataEvento ? dataEvento.split("-").reverse().join("/") : "____/____/______";
  var dataExtenso = dia + " de " + mes + " de " + ano;
  var notaHTML = '<div class="nota-promissoria">' +
    '<h2>NOTA PROMISSÓRIA</h2>' +
    '<div style="display:flex; justify-content:space-between;">' +
      '<div><b>Vencimento:</b> ' + vencFmt + '</div>' +
      '<div><b>Número:</b> ' + num + '</div>' +
    '</div>' +
    '<div style="text-align:right; margin-top:6px;"><b>Valor:</b> R$ ' + valorFmt + '</div>' +
    '<div class="linha-nota" style="margin-top:15px;">' +
      'A(os) <b>' + dataExtenso + '</b>, pagarei a <b>Tralalá Decorações de Festas</b>, CNPJ <b>21.918.863/0001-12</b>, a quantia de <b>R$ ' + valorFmt + '</b>. Caso não seja entregue os itens alugados, conforme descrito no contrato, a festa se realizará no dia ' + eventoFmt + '. Em caso de extravio ou quebra de peças me comprometo a pagar valor de mercado por cada peça em moeda corrente.' +
    '</div>' +
    '<div style="text-align:center; margin-top:25px;">' +
      'Brasília-DF, <b>' + dataExtenso + '</b>.' +
    '</div>' +
    '<div class="assinatura-nota">' +
      '<div class="linha-assinatura-nota"></div>' +
      '<div style="font-weight:bold;">CONTRATANTE:</div>' +
      '<div>CPF:</div>' +
      '<div>ENDEREÇO CLIENTE:</div>' +
    '</div>' +
  '</div>';
 
  var preview = document.getElementById("contrato-preview-content");

  if (!preview) {
    Utils.showToast("Prévia do contrato não encontrada.", "warning");
    return;
  }

  var pagina = preview.querySelector(".pagina-contrato");

  if (!pagina) {
    Utils.showToast("Abra um contrato primeiro.", "warning");
    return;
  }

  var espaco = pagina.querySelector("#espaco-nota-promissoria-loja");

  if (!espaco) {
    espaco = document.createElement("div");
    espaco.id = "espaco-nota-promissoria-loja";
    pagina.appendChild(espaco);
  }

  espaco.innerHTML = notaHTML;

  document.getElementById("modal-nota-promissoria").classList.remove("ativo");

  Utils.showToast("✅ Nota Promissória adicionada!", "success");
};


// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  bindTudo();

  var listaReservas = document.getElementById("lista-reservas-render");
  if (listaReservas && !document.getElementById("busca-cliente-reservas")) {
    var buscaWrapper = document.createElement("div");
    buscaWrapper.id = "busca-cliente-wrapper";
    buscaWrapper.style.cssText = "margin-bottom: 15px; display: flex; gap: 8px; align-items: center;";

    buscaWrapper.innerHTML =
      '<div style="flex: 1; position: relative;">' +
        '<input type="text" id="busca-cliente-reservas" placeholder="🔍 Buscar cliente por nome..." ' +
          'style="width: 100%; padding: 12px 16px 12px 44px; border: 1.5px solid var(--border-color); ' +
          'border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.2s;" ' +
          'onfocus="this.style.borderColor=\'var(--primary)\'" ' +
          'onblur="this.style.borderColor=\'var(--border-color)\'">' +
        '<span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); ' +
          'font-size: 16px; pointer-events: none; color: var(--text-muted);">🔍</span>' +
      '</div>' +
      '<button type="button" id="btn-limpar-busca-cliente" ' +
        'style="padding: 12px 16px; background: var(--border-color); color: var(--text-main); ' +
        'border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 13px;">✕ Limpar</button>';

    listaReservas.parentNode.insertBefore(buscaWrapper, listaReservas);

    var inputBusca = document.getElementById("busca-cliente-reservas");
    inputBusca.addEventListener("input", function(e) {
      renderReservas(e.target.value);
    });

    var btnLimpar = document.getElementById("btn-limpar-busca-cliente");
    btnLimpar.addEventListener("click", function() {
      inputBusca.value = "";
      renderReservas("");
      inputBusca.focus();
    });
  }

  console.log("✅ Sistema Tralalá inicializado!");
  console.log("✅ app.js COMPLETO carregado com sucesso (Auth migrado + verificação corrigida)");
});
// ============================================================
// GERENCIADOR VISUAL DE PASTAS — reutiliza cards originais
// ============================================================
let pastasAgendamento = [];
let pastaAbertaId = null;
function normalizarIdsPasta(cards) {
  if (Array.isArray(cards)) return cards.filter(Boolean).map(String);
  if (cards && typeof cards === 'object') return Object.values(cards).filter(Boolean).map(String);
  return [];
}
function escaparTexto(valor) {
  return String(valor == null ? '' : valor).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function idsSelecionados() {
  return Array.from(document.querySelectorAll('#lista-reservas-render .checkbox-card:checked')).map(c => c.value);
}
function verificarSelecaoCards() {
  const n = idsSelecionados().length;
  const btn = document.getElementById('btn-agrupar-selecionados');
  if (btn) { btn.style.display = n ? 'inline-flex' : 'none'; btn.textContent = `📁 Agrupar (${n})`; }
}
function adicionarCheckboxes() {
  const lista = document.getElementById('lista-reservas-render');
  if (!lista) return;
  const visiveis = State.reservas.filter(r => !pastasAgendamento.some(p => normalizarIdsPasta(p.cards).includes(String(r.id))));
  lista.querySelectorAll('.card-reserva').forEach((card, i) => {
    const botao = card.querySelector('button[onclick*="DeletarReserva"]');
    const id = botao && botao.getAttribute('onclick').match(/'([^']+)'/);
    if (!id || card.querySelector('.checkbox-card')) return;
    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.className = 'checkbox-card'; chk.value = id[1];
    chk.setAttribute('aria-label', 'Selecionar agendamento');
    chk.style.cssText = 'width:20px;height:20px;margin:8px;accent-color:#a3536a';
    chk.addEventListener('change', verificarSelecaoCards);
    card.prepend(chk);
  });
  verificarSelecaoCards();
}
const renderReservasOriginalPastas = renderReservas;
renderReservas = function(filtro, opcoes) {
  renderReservasOriginalPastas(filtro, opcoes);
  if (!opcoes || !opcoes.container) adicionarCheckboxes();
  if (pastaAbertaId && (!opcoes || !opcoes.container)) renderizarPastas();
};

if (db) db.ref('pastas_agendamentos').on('value', snap => {
  const val = snap.val() || {};

  pastasAgendamento = Object.keys(val).map(id => ({
    id,
    ...val[id]
  }));

  renderReservas(
    (document.getElementById('busca-reservas') || {}).value || ''
  );

  renderizarPastas();
  renderizarPastasNoRelatorio();
});

window.abrirModalPastas = function() {
  pastaAbertaId = null;
  document.getElementById('modal-gerenciar-pastas').classList.add('ativo');
  renderizarPastas();
};
window.criarNovaPasta = async function() {
  const campo = document.getElementById('input-nova-pasta-nome');
  const nome = campo.value.trim();
  if (!nome || !db) return Utils.showToast('Informe o nome da pasta.', 'warning');
  try { await db.ref('pastas_agendamentos').push({nome, criadoEm: Date.now(), cards: []}); campo.value = ''; }
  catch(e) { Utils.showToast('Não foi possível criar a pasta.', 'error'); }
};
window.abrirPasta = function(id) { pastaAbertaId = id; renderizarPastas(); };
window.voltarPastas = function() { pastaAbertaId = null; renderizarPastas(); };
window.renomearPasta = async function(id) {
  const pasta = pastasAgendamento.find(p => p.id === id); if (!pasta) return;
  const nome = prompt('Novo nome da pasta:', pasta.nome);
  if (!nome || !nome.trim()) return;
  try { await db.ref('pastas_agendamentos/' + id).update({nome: nome.trim()}); }
  catch(e) { Utils.showToast('Erro ao renomear pasta.', 'error'); }
};
window.excluirPasta = async function(id) {
  if (!confirm('Excluir esta pasta? Os agendamentos voltarão à lista principal.')) return;
  try { await db.ref('pastas_agendamentos/' + id).remove(); pastaAbertaId = null; renderizarPastas(); }
  catch(e) { Utils.showToast('Erro ao excluir pasta.', 'error'); }
};
window.removerDaPasta = async function(idPasta, idReserva) {
  const p = pastasAgendamento.find(p => p.id === idPasta); if (!p) return;
  const ids = normalizarIdsPasta(p.cards).filter(id => id !== idReserva);
  try { await db.ref('pastas_agendamentos/' + idPasta + '/cards').set(ids.length ? ids : null); }
  catch(e) { Utils.showToast('Erro ao retirar agendamento.', 'error'); }
};
window.adicionarNaPasta = async function(idPasta) {
  const p = pastasAgendamento.find(p => p.id === idPasta); if (!p) return;
  const ocupados = new Set(pastasAgendamento.flatMap(x => normalizarIdsPasta(x.cards)));
  const disponiveis = State.reservas.filter(r => !ocupados.has(String(r.id)));
  if (!disponiveis.length) return Utils.showToast('Não há agendamentos fora das pastas.', 'warning');
  const resposta = prompt('Digite o número do agendamento para adicionar:\n' + disponiveis.map((r,i) => `${i+1} - ${r.cliente || 'Sem nome'}`).join('\n'));
  if (resposta === null) return;
  const i = Number(resposta)-1;
  if (!Number.isInteger(i) || i < 0 || i >= disponiveis.length) return Utils.showToast('Número inválido.', 'warning');
  const ids = [...new Set([...normalizarIdsPasta(p.cards), String(disponiveis[i].id)])];
  try { await db.ref('pastas_agendamentos/' + idPasta + '/cards').set(ids); }
  catch(e) { Utils.showToast('Erro ao adicionar agendamento.', 'error'); }
};

function renderizarPastasNoRelatorio() {
  const area = document.getElementById("pastas-relatorio");
  if (!area) return;

  area.innerHTML = "";

  pastasAgendamento.forEach(function(pasta) {
    const botao = document.createElement("button");

    botao.type = "button";
    botao.className = "btn btn-outline";

    botao.style.cssText =
      "padding:15px;text-align:left;" +
      "border:1px solid #e1cbd4;" +
      "border-radius:12px;background:#fff;";

    const quantidade = normalizarIdsPasta(pasta.cards).length;

    botao.textContent =
      "📁 " + pasta.nome + " (" + quantidade + ")";

    botao.onclick = function() {
      window.abrirModalPastas();
      window.abrirPasta(pasta.id);
    };

    area.appendChild(botao);
  });
}

function renderizarPastas() {
  const area = document.getElementById('lista-pastas-gerenciar');
  if (!area) return;
  const form = document.getElementById('criar-pasta-linha');
  if (!pastaAbertaId) {
    if (form) form.style.display = 'flex';
    area.innerHTML = pastasAgendamento.length ? pastasAgendamento.map(p => `
      <div style="padding:15px;border:1px solid #e1cbd4;border-radius:12px;background:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <button type="button" class="btn btn-outline" style="flex:1;text-align:left" onclick="abrirPasta('${p.id}')">📁 ${escaparTexto(p.nome)} (${normalizarIdsPasta(p.cards).length})</button>
        <button type="button" class="btn btn-outline" onclick="renomearPasta('${p.id}')">✏️</button>
        <button type="button" class="btn btn-outline" onclick="excluirPasta('${p.id}')">🗑️</button>
      </div>`).join('') : '<p>Nenhuma pasta criada ainda.</p>';
    return;
  }
  const p = pastasAgendamento.find(x => x.id === pastaAbertaId);
  if (!p) { pastaAbertaId = null; return renderizarPastas(); }
  if (form) form.style.display = 'none';
  area.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-outline" onclick="voltarPastas()">← Voltar</button><strong>📁 ${escaparTexto(p.nome)}</strong><button type="button" class="btn btn-primary" onclick="adicionarNaPasta('${p.id}')">+ Adicionar agendamento</button></div><div id="cards-dentro-pasta" style="display:grid;gap:12px;margin-top:15px"></div>`;
  const ids = normalizarIdsPasta(p.cards);
  const destino = document.getElementById('cards-dentro-pasta');
  renderReservasOriginalPastas('', {container: destino, ids});
  destino.querySelectorAll('.card-reserva').forEach(card => {
    const botao = card.querySelector('button[onclick*="DeletarReserva"]');
    const match = botao && botao.getAttribute('onclick').match(/'([^']+)'/);
    if (!match) return;
    const tirar = document.createElement('button');
    tirar.type = 'button'; tirar.className = 'btn btn-outline'; tirar.textContent = '↩ Retirar da pasta';
    tirar.onclick = () => window.removerDaPasta(p.id, match[1]);
    card.appendChild(tirar);
  });
}
document.addEventListener('DOMContentLoaded', () => {
  const gerenciar = document.getElementById('btn-nova-pasta');
  if (gerenciar) gerenciar.onclick = window.abrirModalPastas;
  const agrupar = document.getElementById('btn-agrupar-selecionados');
  if (agrupar) agrupar.onclick = async function() {
    const ids = idsSelecionados(); if (!ids.length) return;
    const nome = prompt('Nome da nova pasta para os agendamentos selecionados:');
    if (!nome || !nome.trim()) return;
    try { await db.ref('pastas_agendamentos').push({nome: nome.trim(), cards: ids, criadoEm: Date.now()}); verificarSelecaoCards(); }
    catch(e) { Utils.showToast('Erro ao agrupar agendamentos.', 'error'); }
  };
});
// ============================================================
// FUNÇÕES DE CONTRATO (Recuperadas)
// ============================================================
function carregarTemasNoContrato() {
  var select = document.getElementById("c-pecas");
  if (!select) return;
  select.innerHTML = "";
  State.estoqueArray.forEach(function(item) {
    var opt = document.createElement("option");
    opt.value = item.nome || "";
    opt.textContent = (item.nome || 'Sem nome') + ' (' + Utils.formatCurrency(item.preco||0) + ')';
    select.appendChild(opt);
  });
}

function initContratoBusca() {
  var input = document.getElementById("contrato-tema-busca");
  var caixa = document.getElementById("contrato-tema-sugestoes");
  var hidden = document.getElementById("contrato-tema-selecionado");
  if (!input || !caixa) return;
  if (input.__tralalaBound) return;
  input.__tralalaBound = true;
  input.oninput = function(e) {
    var termo = e.target.value.trim();
    if (!termo) { caixa.style.display = "none"; return; }
    var tNorm = Utils.normalizar(termo);
    var filtrados = State.estoqueArray.filter(function(i) { return Utils.normalizar(i.nome || "").indexOf(tNorm) !== -1; });
    caixa.innerHTML = "";
    filtrados.forEach(function(item) {
      var div = document.createElement("div");
      div.className = "sugestao-item";
      div.innerText = item.nome;
      div.onclick = function() {
        input.value = item.nome;
        if (hidden) hidden.value = item.nome;
        caixa.style.display = "none";
      };
      caixa.appendChild(div);
    });
    caixa.style.display = filtrados.length ? "block" : "none";
  };
}

function gerarContratoAvulso(gerarPdf) {
  var nome = (document.getElementById("c-nome") || {}).value || "";
  var cpf = (document.getElementById("c-cpf") || {}).value || "";
  var data = (document.getElementById("c-data") || {}).value || "";
  var horario = (document.getElementById("c-horario") || {}).value || "";
  var valor = parseFloat((document.getElementById("c-valor") || {}).value) || 0;
  var endereco = (document.getElementById("c-endereco") || {}).value || "";
  var telefone = (document.getElementById("c-telefone") || {}).value || "";
  var local = (document.getElementById("c-local") || {}).value || "";
  var modelo = (document.getElementById("c-modelo") || {}).value || "com-frete";
  var obs = (document.getElementById("c-obs") || {}).value || "";
  var tema = (document.getElementById("contrato-tema-selecionado") || {}).value || "";
  var selectPecas = document.getElementById("c-pecas");
  var pecas = [];
  if (selectPecas) {
    for (var i = 0; i < selectPecas.options.length; i++) { if (selectPecas.options[i].selected) pecas.push(selectPecas.options[i].value); }
  }
  if (!nome.trim()) { Utils.showToast("Preencha o nome do contratante!", "warning"); return; }
 
var dados = {
  nome, cpf, data, horario, valor,
  endereco, telefone, local,
  dataRetirada: data,
  dataDevolucao: data,
  tema, pecas, obs,

  sinal: (document.getElementById("c-sinal") || {}).value || "",
  restante: (document.getElementById("c-restante") || {}).value || "",
  horarioEntrega: (document.getElementById("c-horario-entrega") || {}).value || "",
  horarioRetirada: (document.getElementById("c-horario-retirada") || {}).value || "",
  dataPagamentoSinal: (document.getElementById("c-data-sinal") || {}).value || "",
  dataPagamentoRestante: (document.getElementById("c-data-restante") || {}).value || "",
  dataEnvioOrcamento: (document.getElementById("c-data-orcamento") || {}).value || ""
};

  var html;
  if (modelo === "com-frete") html = gerarContratoComFrete(dados);
  else if (modelo === "pegue-monte-loja") html = gerarContratoPegueMonteLoja(dados);
  else html = gerarContratoPegueMonte(dados);
  
  var preview = document.getElementById("contrato-preview-content");
  if (preview) { 
    preview.innerHTML = html; 
    preview.contentEditable = "false"; 
    preview.style.outline = ""; 
    preview.style.padding = ""; 
    preview.style.borderRadius = ""; 
  }
  document.getElementById("btn-editar-contrato").style.display = "inline-flex";
  document.getElementById("btn-salvar-edicao-contrato").style.display = "none";
  document.getElementById("btn-add-nota-promissoria").style.display = "inline-flex"
  window.__contratoTipo = modelo;
  var modalVis = document.getElementById("modal-visualizar-contrato");
  if (modalVis) modalVis.classList.add("ativo");
  
  if (gerarPdf) setTimeout(function() { window.BaixarPDFContrato(); }, 300);
}
