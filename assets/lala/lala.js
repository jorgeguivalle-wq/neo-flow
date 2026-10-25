// ============================================================
// ASSISTENTE VIRTUAL LALÁ 🌸 (VERSÃO CORRIGIDA v4)
// Mantém todas as correções da v3 e adiciona:
//  - Saudação automática no 1º acesso ao chat após login
//  - Indicador de 3 pontinhos durante o carregamento dos dados
//  - Troca da saudação para o texto final quando dados prontos
//  - Indicador "Lalá está consultando..." para consultas demoradas
//  - Sem tempo fixo: polling curto até State.carregando=false
//  - Mensagem amigável em caso de demora/erro
//  - Sem duplicação ao fechar/abrir chat (flag + sessionStorage por uid)
//  - Remoção garantida de indicadores (finally)
//  - Tudo o que era da v3 preservado (segurança, datas, perfis,
//    agendamento, tutorial, animação)
// ============================================================
(function() {
  'use strict';

  // ----------------------------------------------------------
  // PERFIS
  // ----------------------------------------------------------
  const PERFIS_POR_EMAIL = {
    'leonardodovalle@gmail.com': 'leo',
    'jorgeguivalle@gmail.com': 'leo',
    'tralaladecoracoes@gmail.com': 'aline'
  };

  function detectarPerfilPorEmail(email) {
    if (!email) return 'leo';
    const e = String(email).toLowerCase().trim();
    if (PERFIS_POR_EMAIL[e]) return PERFIS_POR_EMAIL[e];
    if (e.indexOf('aline') !== -1) return 'aline';
    return 'leo';
  }

  // ----------------------------------------------------------
  // ESCAPE
  // ----------------------------------------------------------
  function escapeHTML(v) {
    if (v === undefined || v === null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ----------------------------------------------------------
  // VALIDAÇÃO DE DATA/HORA
  // ----------------------------------------------------------
  function validarDataHora(dia, mes, ano, hora, minuto) {
    const d = parseInt(dia, 10);
    const m = parseInt(mes, 10);
    const h = parseInt(hora, 10);
    const min = parseInt(minuto, 10);

    if (isNaN(d) || d < 1 || d > 31) return { ok: false, motivo: 'dia' };
    if (isNaN(m) || m < 1 || m > 12) return { ok: false, motivo: 'mes' };
    if (isNaN(h) || h < 0 || h > 23) return { ok: false, motivo: 'hora' };
    if (isNaN(min) || min < 0 || min > 59) return { ok: false, motivo: 'minuto' };

    let anoUsado;
    let anoFoiInformado = false;
    if (ano !== undefined && ano !== null && String(ano).trim() !== '') {
      const a = parseInt(ano, 10);
      if (isNaN(a) || a < 1900 || a > 2999) return { ok: false, motivo: 'ano' };
      anoUsado = a;
      anoFoiInformado = true;
    } else {
      anoUsado = new Date().getFullYear();
    }

    const ultimoDia = new Date(anoUsado, m, 0).getDate();
    if (d > ultimoDia) return { ok: false, motivo: 'dia_inexistente' };

    return {
      ok: true, dia: d, mes: m, ano: anoUsado, anoFoiInformado: anoFoiInformado,
      hora: h, minuto: min,
      dataObj: new Date(anoUsado, m - 1, d, h, min, 0, 0)
    };
  }

  // ----------------------------------------------------------
  // SAUDAÇÃO
  // Textos fixos — podem ir por innerHTML sem risco de XSS.
  // ----------------------------------------------------------
  const SAUDACAO_CARREGANDO =
    '🌸 Olá! Sou a Lalá, sua secretária virtual! 💗 Estou organizando minha agenda e consultando as informações do Neo Flow. Só um instantinho...';

  const SAUDACAO_PRONTO =
    '✨ Prontinho! Já organizei tudo por aqui! 💕 Estou à disposição para consultar sua agenda, conferir orçamentos, ajudar com clientes e muito mais. Como posso ajudar hoje?';

  const SAUDACAO_DEMOROU =
    '⏳ Algumas informações ainda não estão disponíveis (o Neo Flow está lento agora). Já dá para conversar comigo, mas pode ser que eu não veja tudo. Tente de novo daqui a pouco! 💗';

  const SAUDACAO_ERRO =
    '😥 Puxa, não consegui carregar as informações do Neo Flow agora. Algumas consultas podem falhar. Se continuar assim, verifique a conexão e recarregue a página. 💗';

  const TEXTO_CONSULTA = 'Lalá está consultando as informações...';

  // ----------------------------------------------------------
  // ESTADO
  // ----------------------------------------------------------
  const LALA = {
    animacaoInterval: null,
    tutorialPasso: 0,
    totalPassos: 4,

    agendamentoPendente: null,
    agendamentoAguardandoAno: null,

    aguardandoSituacaoMensagem: false,
    aguardandoEscolhaPerfil: false,

    tutorialJaVerificadoNestaSessao: false,
    _perfilForcadoNaSessao: null,
    _perfilCache: null,

    _dadosCarregados: { estoque: false, reservas: false },

    // Saudação
    _boasVindasJaMostradas: false,
    _saudacaoEmAndamento: false,
    _saudacaoTimer: null,
    _saudacaoAguardando: null,

    // ------------------------------------------------------
    // BANCO / PERFIL
    // ------------------------------------------------------
    obterBanco: function() {
      if (window.db) return window.db;
      if (typeof db !== 'undefined' && db) return db;
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
        return firebase.database();
      }
      return null;
    },

    escapeHTML: function(v) { return escapeHTML(v); },

    obterPerfil: function() {
      if (this._perfilForcadoNaSessao === 'aline' || this._perfilForcadoNaSessao === 'leo') {
        return this._perfilForcadoNaSessao;
      }
      if (this._perfilCache === 'aline' || this._perfilCache === 'leo') {
        return this._perfilCache;
      }
      return detectarPerfilPorEmail(window.State && window.State.usuarioLogadoEmail);
    },

    carregarPerfilDoUsuario: function() {
      const self = this;
      const banco = this.obterBanco();
      const uid = window.State && window.State.usuarioUID;
      if (!banco || !uid) {
        this._perfilCache = detectarPerfilPorEmail(window.State && window.State.usuarioLogadoEmail);
        return Promise.resolve(this._perfilCache);
      }
      return banco.ref('configuracoes/tutorial/' + uid + '/perfil').once('value')
        .then(function(snap) {
          const salvo = snap.val();
          if (salvo === 'aline' || salvo === 'leo') self._perfilCache = salvo;
          else self._perfilCache = detectarPerfilPorEmail(window.State && window.State.usuarioLogadoEmail);
          return self._perfilCache;
        })
        .catch(function(err) {
          console.warn('Lalá: erro ao ler perfil do usuário, usando e-mail.', err);
          self._perfilCache = detectarPerfilPorEmail(window.State && window.State.usuarioLogadoEmail);
          return self._perfilCache;
        });
    },

    trocarPerfil: function(perfil) {
      if (perfil !== 'aline' && perfil !== 'leo') return Promise.reject(new Error('perfil_invalido'));
      this._perfilForcadoNaSessao = perfil;
      this._perfilCache = perfil;
      const banco = this.obterBanco();
      const uid = window.State && window.State.usuarioUID;
      if (!banco || !uid) return Promise.resolve(perfil);
      return banco.ref('configuracoes/tutorial/' + uid + '/perfil').set(perfil)
        .then(function() { return perfil; })
        .catch(function(err) {
          console.warn('Lalá: erro ao gravar perfil do usuário.', err);
          return perfil;
        });
    },

    normalizarTexto: function(texto) {
      if (!texto) return '';
      return String(texto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    },

    // ------------------------------------------------------
    // BUSCAR
    // ------------------------------------------------------
    buscar: function(textoOriginal) {
      if (!textoOriginal) return null;
      const t = this.normalizarTexto(textoOriginal);
      
if (
  t.includes('o que voce faz') ||
  t.includes('o que vc faz') ||
  t.includes('como voce pode ajudar') ||
  t.includes('quais suas funcoes')
) {
  return {
    resposta:
      '🌸 Eu sou a Lalá, sua secretária virtual do Neo Flow! 💗<br><br>' +
      '📅 <b>Agenda:</b> Consulto reuniões e próximos eventos.<br>' +
      '💰 <b>Faturamento:</b> Mostro o resumo das vendas.<br>' +
      '📦 <b>Estoque:</b> Consulto o catálogo.<br>' +
      '💬 <b>Mensagens:</b> Ajudo a responder clientes.<br>' +
      '🧮 <b>Lucro:</b> Faço cálculos de lucro e margem.<br>' +
      '🎓 <b>Tutorial:</b> Ensino a usar o Neo Flow.<br><br>' +
      '✨ É só me dizer o que você precisa!'
  };
}


      if (this.agendamentoPendente) {
        const ehSim = /^(sim|s|yes|confirmo|confirmar|pode salvar|salvar|ok|claro)\b/.test(t);
        const ehNao = /^(nao|n|cancel|cancela|desist|deixa|deixa pra depois|melhor nao)\b/.test(t);
        if (ehSim) return { isConfirmar: true };
        if (ehNao) return { isCancelar: true };
      }

      if (this.agendamentoAguardandoAno) {
        const ehSim = /^(sim|s|yes|confirmo|pode|isso|usar proximo ano|proximo ano)\b/.test(t);
        const ehNao = /^(nao|n|cancel|cancela|desist|deixa)\b/.test(t);
        if (ehSim) {
          const base = this.agendamentoAguardandoAno;
          this.agendamentoAguardandoAno = null;
          const proximoAno = new Date().getFullYear() + 1;
          const v = validarDataHora(base.dia, base.mes, proximoAno, base.hora, base.minuto);
          if (!v.ok) {
            return { resposta: 'Não consegui ajustar para o próximo ano. Vamos tentar de novo: informe a data completa com ano.' };
          }
          this.agendamentoPendente = {
            cliente: base.cliente,
            dia: v.dia, mes: v.mes, ano: v.ano,
            hora: v.hora, minuto: v.minuto,
            dataFinal: v.ano + '-' + String(v.mes).padStart(2, '0') + '-' + String(v.dia).padStart(2, '0') + 'T' + String(v.hora).padStart(2, '0') + ':' + String(v.minuto).padStart(2, '0'),
            dataStr: String(v.dia).padStart(2, '0') + '/' + String(v.mes).padStart(2, '0') + '/' + v.ano
          };
          return { resposta: '📅 <b>Confirmação (próximo ano):</b><br><br>👤 <b>' + escapeHTML(base.cliente) + '</b><br>📆 <b>' + escapeHTML(this.agendamentoPendente.dataStr) + '</b><br>⏰ <b>' + String(v.hora).padStart(2,'0') + ':' + String(v.minuto).padStart(2,'0') + '</b><br><br>Posso salvar? (Digite <b>Sim</b> ou <b>Não</b>)' };
        }
        if (ehNao) {
          const base = this.agendamentoAguardandoAno;
          this.agendamentoAguardandoAno = null;
          return { resposta: 'Ok, cancelei. Quando quiser, me diga a data completa com o ano, por exemplo: <b>"Agende com Maria 25/10/2027 às 15:00"</b>.' };
        }
        return { resposta: 'Só pra confirmar: você quer usar o <b>próximo ano</b> para essa data? Responda <b>Sim</b> ou <b>Não</b>.' };
      }

      if (this.aguardandoEscolhaPerfil) {
        this.aguardandoEscolhaPerfil = false;
        if (t.indexOf('aline') !== -1) return this.executarTrocaPerfil('aline');
        if (t.indexOf('leo') !== -1) return this.executarTrocaPerfil('leo');
        return { resposta: 'Não entendi. Responda <b>aline</b> ou <b>leo</b>.' };
      }

      if (this.aguardandoSituacaoMensagem) {
        this.aguardandoSituacaoMensagem = false;
        if (t === '1' || t.indexOf('dinheir') !== -1 || t.indexOf('reembols') !== -1) {
          return { resposta: this.gerarMensagemFinanceiro() };
        }
        if (t === '2' || t.indexOf('atras') !== -1) {
          return { resposta: this.gerarMensagemAtraso() };
        }
        if (t === '3' || t.indexOf('cancel') !== -1) {
          return { resposta: this.gerarMensagemCancelamento() };
        }
        return { resposta: 'Entendi. Aqui vai uma mensagem educada para acalmar o cliente:<br><br><i>"Olá, [Nome]! Tudo bem? Entendo a sua situação. Vou verificar e te retorno ainda hoje."</i>' };
      }

      const querTrocarPerfil =
        t.indexOf('trocar perfil') !== -1 ||
        t.indexOf('trocar de perfil') !== -1 ||
        t.indexOf('mudar perfil') !== -1 ||
        t.indexOf('mudar de perfil') !== -1 ||
        t.indexOf('trocar para aline') !== -1 ||
        t.indexOf('trocar para leo') !== -1 ||
        t.indexOf('perfil aline') !== -1 ||
        t.indexOf('perfil leo') !== -1;

      if (querTrocarPerfil) {
        if (t.indexOf('aline') !== -1) return this.executarTrocaPerfil('aline');
        if (t.indexOf('leo') !== -1) return this.executarTrocaPerfil('leo');
        this.aguardandoEscolhaPerfil = true;
        return { resposta: 'Para qual perfil você quer trocar? Responda <b>aline</b> ou <b>leo</b>.' };
      }

      const temFaturamento =
        t.indexOf('faturament') !== -1 ||
        t.indexOf('vendas do mes') !== -1 ||
        t.indexOf('lucro do mes') !== -1 ||
        t.indexOf('quanto ganhei') !== -1 ||
        t.indexOf('quanto vendi') !== -1;

      const temEstoque =
        t.indexOf('estoque') !== -1 ||
        t.indexOf('quantas pecas') !== -1 ||
        t.indexOf('catalogo') !== -1;

      const temCalculo =
        t.indexOf('calcul') !== -1 ||
        (t.indexOf('lucro') !== -1 && /\d/.test(t)) ||
        t.indexOf('margem') !== -1;

      const temProximos =
        (t.indexOf('proxim') !== -1) ||
        t.indexOf('quais festas') !== -1;

      const temPalavraAgendar =
        t.indexOf('agend') !== -1 ||
        t.indexOf('marcar') !== -1 ||
        t.indexOf('reuniao') !== -1 ||
        t.indexOf('horario') !== -1;

      const ehPedidoDeAgenda =
        t.indexOf('minha agenda') !== -1 ||
        t.indexOf('ver agenda') !== -1 ||
        t.indexOf('agenda de hoje') !== -1 ||
        t.indexOf('agenda do dia') !== -1;

      const ehBomDia =
        t.indexOf('bom dia') !== -1 ||
        t.indexOf('resum') !== -1 ||
        t.indexOf('hoje') !== -1 ||
        t.indexOf('pendenc') !== -1 ||
        ehPedidoDeAgenda;

      const temTutorial =
        t.indexOf('tutorial') !== -1 ||
        t.indexOf('refaz') !== -1 ||
        t.indexOf('apresent') !== -1 ||
        t.indexOf('como funciona') !== -1 ||
        t.indexOf('como faz') !== -1;

      const temMensagemBase =
        t.indexOf('mensag') !== -1 ||
        t.indexOf('respond') !== -1 ||
        t.indexOf('text') !== -1 ||
        t.indexOf('recus') !== -1 ||
        (t.indexOf('falar') !== -1 && !temFaturamento && !temEstoque && !temCalculo);

      if (temPalavraAgendar && !ehPedidoDeAgenda) return this.prepararAgendamento(textoOriginal);

      if (temMensagemBase && !temFaturamento && !temEstoque && !temCalculo && !temTutorial) {
        if (t.indexOf('dinheir') !== -1 || t.indexOf('reembols') !== -1 || t.indexOf('devolv') !== -1 || t.indexOf('pix') !== -1) {
          return { resposta: this.gerarMensagemFinanceiro() };
        }
        if (t.indexOf('atras') !== -1 || t.indexOf('peca') !== -1) {
          return { resposta: this.gerarMensagemAtraso() };
        }
        if (t.indexOf('cancel') !== -1 || t.indexOf('desist') !== -1) {
          return { resposta: this.gerarMensagemCancelamento() };
        }
        this.aguardandoSituacaoMensagem = true;
        return { resposta: 'Claro! Eu te ajudo a escrever. ✍️<br><br>Sobre o que é a situação?<br>1 - Cliente quer o <b>dinheiro de volta</b><br>2 - Cliente com <b>atraso</b> na devolução<br>3 - Cliente quer <b>cancelar</b><br><br>Me conte com suas palavras!' };
      }

      if (temCalculo) return { resposta: this.calcularLucro(textoOriginal) };
      if (ehBomDia) return { isBomDia: true };
      if (temFaturamento) return { isFaturamento: true };
      if (temProximos) return { isProximos: true };
      if (temEstoque) return { resposta: this.verificarEstoque() };

      if (temTutorial) {
        if (t.indexOf('refaz') !== -1 || t.indexOf('tutorial') !== -1 || t.indexOf('apresent') !== -1) {
          return { isTutorial: true };
        }
        return { resposta: 'Eu sou a Lalá! 🌸 Posso:<br><br>☀️ <b>Bom dia:</b> Ver a agenda de hoje.<br>📅 <b>Agendar:</b> "Agende com Maria 25/10 15:00".<br>💬 <b>Mensagens:</b> Te ajudo a responder clientes.<br>🧮 <b>Lucro:</b> "Calcula lucro de 1500 com custo 400".<br>📊 <b>Faturamento:</b> "Qual o faturamento do mês?"<br>📦 <b>Estoque:</b> "Quantas peças temos?"<br>🎓 <b>Tutorial:</b> "Refazer tutorial".<br>👤 <b>Perfil:</b> "Trocar perfil".' };
      }

      if (t === 'oi' || t === 'ola' || t === 'opa' || t === 'eai' || t.indexOf('tudo bem') !== -1 || t.indexOf('tudo bom') !== -1) {
        return { resposta: 'Oi! 🌸 Sou a Lalá. Precisa de ajuda com mensagens, agendamentos ou relatórios? Digite <b>"O que você faz?"</b>.' };
      }

      return null;
    },

    executarTrocaPerfil: function(novoPerfil) {
      const self = this;
      const anterior = this.obterPerfil();
      if (anterior === novoPerfil) {
        return { resposta: 'Você já está no perfil <b>' + escapeHTML(novoPerfil) + '</b>. 🌸' };
      }
      this.trocarPerfil(novoPerfil).then(function() {
        self.tutorialJaVerificadoNestaSessao = false;
        self.verificarTutorialInicial();
      });
      return { resposta: 'Pronto! Agora estou no perfil <b>' + escapeHTML(novoPerfil) + '</b>. 🌸 O tutorial vai respeitar o progresso desse perfil.' };
    },

    // ======================================================
    // CONSULTAS
    // ======================================================

consultarOrcamentosPendentes: function() {
  const banco = this.obterBanco();

  if (!banco) {
    return Promise.resolve(
      '😥 Não consegui acessar o banco de dados.'
    );
  }

  return banco.ref('orcamentos_abertos').once('value')
    .then(function(snapshot) {
      const dados = snapshot.val() || {};

      const pendentes = Object.values(dados).filter(function(o) {
        return o && o.status === 'aguardando';
      });

      if (pendentes.length === 0) {
        return '🎉 Nenhum orçamento aguardando resposta!';
      }

      return '📨 <b>Orçamentos aguardando resposta:</b><br><br>' +
        '📋 Total: <b>' + pendentes.length + '</b><br><br>' +
        'Acesse Orçamentos em Aberto para consultar os detalhes.';
    })
    .catch(function(erro) {
      console.error('Erro ao consultar orçamentos:', erro);
      return '😥 Não consegui consultar os orçamentos agora.';
    });
},

    // ==============================================
    // COMANDOS LALÁ — CONSULTAS DO NEO FLOW
    // ==============================================

    consultarComandoLala: async function(comando) {
      const esc = this.escapeHTML;
      const state = window.State;

      const dinheiro = function(valor) {
        return Number(valor || 0).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        });
      };

      const dataBR = function(data) {
        if (!data) return 'Não informada';
        const partes = String(data).slice(0, 10).split('-');
        return partes.length === 3
          ? partes.reverse().join('/')
          : String(data);
      };

      const dataISO = function(d) {
        return d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0');
      };

      const reservas = state && Array.isArray(state.reservas)
        ? state.reservas : [];

      if (!state || state.carregando) {
        return '⏳ Ainda estou carregando os dados. Tente novamente em instantes.';
      }

      // AGENDA DO FIM DE SEMANA
      if (comando === '/fim-semana') {
        const hoje = new Date();
        const sabado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        const diasAteSabado = (6 - hoje.getDay() + 7) % 7;
        sabado.setDate(sabado.getDate() + diasAteSabado);

        const domingo = new Date(sabado);
        domingo.setDate(domingo.getDate() + 1);

        const datas = [dataISO(sabado), dataISO(domingo)];
        const eventos = reservas.filter(r => datas.includes(r.data));

        if (!eventos.length) {
          return '🎉 Nenhuma reserva encontrada para este fim de semana.';
        }

        let html = '🎉 <b>Agenda do fim de semana</b><br><br>';

        datas.forEach(function(data, indice) {
          const lista = eventos.filter(r => r.data === data);
          html += '<b>' + (indice === 0 ? 'Sábado' : 'Domingo') +
            ' — ' + dataBR(data) + '</b><br>';

          if (!lista.length) html += 'Nenhuma reserva.<br>';

          lista.forEach(function(r) {
            html += '🎈 ' + esc(r.cliente || 'Cliente não informado') +
              '<br>🎨 ' + esc(r.tema || 'Sem tema') +
              '<br>📦 ' + esc(r.kit || 'Kit não informado') +
              '<br>🏠 ' + (r.montarNoLocal ? 'Decoração completa' : 'Pegue e Monte') +
              '<br><br>';
          });
        });

        return html;
      }

      // LISTA DE SEPARAÇÃO
      if (comando === '/separacao') {
        const hoje = new Date();
        const sabado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        sabado.setDate(sabado.getDate() + (6 - hoje.getDay() + 7) % 7);
        const domingo = new Date(sabado);
        domingo.setDate(domingo.getDate() + 1);

        const datas = [dataISO(sabado), dataISO(domingo)];
        const eventos = reservas.filter(r => datas.includes(r.data));

        if (!eventos.length) {
          return '📋 Não encontrei reservas para separar neste fim de semana.';
        }

        let html = '📋 <b>Lista de separação</b><br><br>';

        eventos.forEach(function(r) {
          html += '<b>' + esc(r.cliente || 'Cliente') + '</b>' +
            ' — ' + dataBR(r.data) +
            '<br>🎨 ' + esc(r.tema || 'Sem tema') +
            '<br>📦 ' + esc(r.kit || 'Kit não informado') + '<br>';

          const pecas = Array.isArray(r.pecas) ? r.pecas : [];

          if (!pecas.length) {
            html += '⚠️ Peças não detalhadas nesta reserva.<br>';
          } else {
            pecas.forEach(function(nome) {
              const qtd = r.pecasQtd && r.pecasQtd[nome]
                ? Number(r.pecasQtd[nome]) : 1;
              html += '• ' + qtd + 'x ' + esc(nome) + '<br>';
            });
          }

          html += '<br>';
        });

        return html;
      }

      // PAGAMENTOS PENDENTES
      if (comando === '/pagamentos') {
        const pendentes = reservas.filter(function(r) {
          return Number(r.total || 0) > Number(r.sinal || 0);
        });

        if (!pendentes.length) {
          return '💸 Não encontrei saldos calculados em aberto nas reservas.';
        }

        let soma = 0;
        let html = '💸 <b>Saldos a conferir</b><br><br>';

        pendentes.forEach(function(r) {
          const restante = Math.max(
            0, Number(r.total || 0) - Number(r.sinal || 0)
          );
          soma += restante;

          html += '👤 ' + esc(r.cliente || 'Cliente') +
            '<br>📅 ' + dataBR(r.data) +
            '<br>💰 Saldo calculado: <b>' + dinheiro(restante) +
            '</b><br><br>';
        });

        html += '<b>Total calculado: ' + dinheiro(soma) + '</b>';
        html += '<br><br>⚠️ Este cálculo usa total menos sinal. ' +
          'Confirme pagamentos posteriores antes de cobrar.';

        return html;
      }

      // ORÇAMENTOS SEM RESPOSTA
      if (comando === '/orcamentos') {
        const banco = this.obterBanco();
        if (!banco) return '😥 Banco de dados indisponível.';

        const snap = await banco.ref('orcamentos_abertos').once('value');
        const todos = Object.values(snap.val() || {});

        const pendentes = todos.filter(function(o) {
          return o && o.status === 'aguardando';
        });

        if (!pendentes.length) {
          return '📨 Nenhum orçamento com status aguardando.';
        }

        let html = '📨 <b>Orçamentos aguardando resposta</b><br><br>';

        pendentes.forEach(function(o) {
          html += '👤 ' + esc(o.cliente || 'Cliente') +
            '<br>🎨 ' + esc(o.tema || 'Sem tema') +
            '<br>💰 ' + dinheiro(o.valorTotal) +
            '<br>🔔 Retorno: ' + dataBR(o.dataRetorno) +
            '<br><br>';
        });

        return html;
      }

      // ENTREGAS E DEVOLUÇÕES
      if (comando === '/logistica') {
        const hoje = dataISO(new Date());
        const eventos = reservas
          .filter(r => r.data && r.data >= hoje)
          .sort((a, b) => a.data.localeCompare(b.data))
          .slice(0, 15);

        if (!eventos.length) {
          return '🚚 Nenhuma reserva futura encontrada.';
        }

        let html = '🚚 <b>Logística das próximas reservas</b><br><br>';

        eventos.forEach(function(r) {
          html += '📅 ' + dataBR(r.data) +
            '<br>👤 ' + esc(r.cliente || 'Cliente') +
            '<br>📦 ' + (r.montarNoLocal
              ? 'Montagem no local'
              : 'Pegue e Monte') +
            '<br>📍 ' + esc(r.local || r.endereco || 'Local não informado') +
            '<br>↩️ ' + (r.itensDevolvidos
              ? 'Devolução registrada'
              : 'Devolução não registrada') +
            '<br><br>';
        });

        html += '⚠️ Os horários de entrega e retirada não estão ' +
          'disponíveis nos campos padrão das reservas. ' +
          'Confira os contratos antes de organizar as rotas.';

        return html;
      }

      return 'Comando não reconhecido.';
    },


    consultarFaturamentoMes: function() {
      if (!window.State || !window.State.reservas) {
        return 'Puxa, estou sem os dados das reservas no momento. 😥';
      }
      if (window.State.reservas.length === 0 && !this._dadosCarregados.reservas) {
        return 'Ainda estou carregando as reservas. Me pergunte de novo em alguns segundos. ⏳';
      }
      this._dadosCarregados.reservas = true;

      const hoje = new Date();
      const mesAtual = hoje.getMonth();
      const anoAtual = hoje.getFullYear();
      let totalFaturado = 0;
      let qtdFestas = 0;

      window.State.reservas.forEach(function(r) {
        if (!r.data) return;
        const dataReserva = new Date(r.data + 'T00:00:00');
        if (dataReserva.getMonth() === mesAtual && dataReserva.getFullYear() === anoAtual) {
          totalFaturado += (parseFloat(r.total) || 0) + (parseFloat(r.frete) || 0);
          qtdFestas++;
        }
      });

      const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      if (qtdFestas === 0) {
        return 'Ainda não tivemos nenhuma festa registrada em <b>' + escapeHTML(meses[mesAtual]) + '</b>. Vamos agitar as vendas! 🚀';
      }
      return '📊 <b>Resumo de ' + escapeHTML(meses[mesAtual]) + ':</b><br><br>🎉 Tivemos <b>' + qtdFestas + ' festa(s)</b>.<br>💰 Faturamento total: <b>R$ ' + totalFaturado.toFixed(2).replace('.', ',') + '</b>.<br><br>Quer ver os detalhes? Clique em <b>Venda Mensal & Anual</b>.';
    },

    consultarProximosEventos: function() {
      if (!window.State || !window.State.reservas) {
        return 'Puxa, estou sem os dados das reservas no momento. 😥';
      }
      if (window.State.reservas.length === 0 && !this._dadosCarregados.reservas) {
        return 'Ainda estou carregando as reservas. Me pergunte de novo em alguns segundos. ⏳';
      }
      this._dadosCarregados.reservas = true;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const futuras = window.State.reservas
        .filter(function(r) { return r.data && new Date(r.data + 'T00:00:00') >= hoje; })
        .sort(function(a, b) { return new Date(a.data + 'T00:00:00') - new Date(b.data + 'T00:00:00'); })
        .slice(0, 3);

      if (futuras.length === 0) return 'Não temos nenhuma festa agendada para os próximos dias. 📅';
      let resposta = '📅 <b>Próximos Eventos:</b><br><br>';
      futuras.forEach(function(f) {
        const partesData = String(f.data).split('-');
        resposta += '🎉 <b>' + escapeHTML(partesData[2] + '/' + partesData[1]) + '</b> - ' + escapeHTML(f.cliente) + '<br>🎨 Tema: ' + escapeHTML(f.tema || 'Não informado') + '<br><br>';
      });
      return resposta;
    },

    verificarEstoque: function() {
      if (!window.State || !window.State.estoqueArray) {
        return 'Puxa, não consegui acessar o catálogo. 😥';
      }
      if (window.State.estoqueArray.length === 0 && !this._dadosCarregados.estoque) {
        return 'Ainda estou carregando o catálogo. Me pergunte de novo em alguns segundos. ⏳';
      }
      this._dadosCarregados.estoque = true;

      const totalPecas = window.State.estoqueArray.length;
      if (totalPecas === 0) return 'Nosso catálogo está vazio no momento. Que tal cadastrar algumas peças? 📦';
      return '📦 Temos <b>' + totalPecas + ' peças/temas</b> cadastrados no catálogo.<br><br>Para ver os detalhes, clique em <b>Ver Catálogo</b> no painel principal!';
    },

    // ======================================================
    // AGENDAMENTO
    // ======================================================
    prepararAgendamento: function(textoOriginal) {
      const texto = this.normalizarTexto(textoOriginal);

      let dia = '', mes = '', ano = '';
      const regexBarra = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/;
      const regexExtenso = /(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?/i;
      const matchBarra = texto.match(regexBarra);
      const matchExtenso = texto.match(regexExtenso);

      if (matchBarra) {
        dia = matchBarra[1]; mes = matchBarra[2]; ano = matchBarra[3] || '';
      } else if (matchExtenso) {
        dia = matchExtenso[1];
        const meses = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
        mes = String(meses.indexOf(matchExtenso[2]) + 1).padStart(2, '0');
        ano = matchExtenso[3] || '';
      }

      let hora = '', minuto = '';
      const regexHora = /(\d{1,2})(?::(\d{2})|h(\d{2})?| horas?| hrs?)/;
      const matchHora = texto.match(regexHora);
      if (matchHora) { hora = matchHora[1]; minuto = matchHora[2] || matchHora[3] || '00'; }

      let cliente = 'Cliente';
      const regexNome = /(?:com|para)\s+(?:a\s+|o\s+)?([a-zA-ZÀ-ÿ\s]+?)(?:\s+(?:dia|no|as|às|\d|$))/i;
      const matchNome = textoOriginal.match(regexNome);
      if (matchNome) {
        cliente = matchNome[1].trim().replace(/(reuniao|reunião|agendar|marcar|horario)/gi, '').trim();
      }

      if (!dia || !hora) {
        return { resposta: 'Entendi que você quer agendar! 😊 Mas faltou a data e a hora.<br><br>Pode me dizer assim: <b>"Agende com Maria 25/10 às 15:00"</b>' };
      }

      const v = validarDataHora(dia, mes, ano, hora, minuto);
      if (!v.ok) {
        let msgMotivo = '';
        if (v.motivo === 'dia_inexistente') msgMotivo = 'Esse dia não existe no mês informado (ex.: 31/02).';
        else if (v.motivo === 'dia') msgMotivo = 'O dia precisa estar entre 1 e 31.';
        else if (v.motivo === 'mes') msgMotivo = 'O mês precisa estar entre 1 e 12.';
        else if (v.motivo === 'hora') msgMotivo = 'A hora precisa estar entre 00 e 23 (25:00 não existe).';
        else if (v.motivo === 'minuto') msgMotivo = 'Os minutos precisam estar entre 00 e 59.';
        else if (v.motivo === 'ano') msgMotivo = 'O ano precisa ter 4 dígitos (ex.: 2026).';
        else msgMotivo = 'Data ou hora inválida.';
        return { resposta: '⚠️ ' + msgMotivo + '<br><br>Tente assim: <b>"Agende com Maria 25/10/2026 às 15:00"</b>' };
      }

      const agora = new Date();
      if (!v.anoFoiInformado) {
        const dataTentativa = new Date(v.ano, v.mes - 1, v.dia, v.hora, v.minuto, 0, 0);
        if (dataTentativa.getTime() < agora.getTime()) {
          const proximoAno = agora.getFullYear() + 1;
          this.agendamentoAguardandoAno = {
            cliente: cliente, dia: v.dia, mes: v.mes, hora: v.hora, minuto: v.minuto
          };
          return { resposta: '📅 Essa data (<b>' + String(v.dia).padStart(2,'0') + '/' + String(v.mes).padStart(2,'0') + '</b> às <b>' + String(v.hora).padStart(2,'0') + ':' + String(v.minuto).padStart(2,'0') + '</b>) já passou em ' + v.ano + '.<br><br>Quer usar <b>' + proximoAno + '</b>? Responda <b>Sim</b> ou <b>Não</b>.' };
        }
      }

      const dataFinal = v.ano + '-' + String(v.mes).padStart(2, '0') + '-' + String(v.dia).padStart(2, '0') + 'T' + String(v.hora).padStart(2, '0') + ':' + String(v.minuto).padStart(2, '0');
      const dataStr = String(v.dia).padStart(2, '0') + '/' + String(v.mes).padStart(2, '0') + '/' + v.ano;

      this.agendamentoPendente = {
        cliente: cliente, dia: v.dia, mes: v.mes, ano: v.ano,
        hora: v.hora, minuto: v.minuto,
        dataFinal: dataFinal, dataStr: dataStr
      };

      return { resposta: '📅 <b>Confirmação:</b><br><br>👤 <b>' + escapeHTML(cliente) + '</b><br>📆 <b>' + escapeHTML(dataStr) + '</b><br>⏰ <b>' + String(v.hora).padStart(2,'0') + ':' + String(v.minuto).padStart(2,'0') + '</b><br><br>Posso salvar? (Digite <b>Sim</b> ou <b>Não</b>)' };
    },

    confirmarAgendamento: function() {
      if (!this.agendamentoPendente) return Promise.resolve('Não tem nada pendente para confirmar.');
      const agendamento = this.agendamentoPendente;
      const banco = this.obterBanco();
      if (!banco) {
        return Promise.resolve('Erro: o banco de dados não está pronto. O agendamento continua pendente — tente de novo em instantes.');
      }
      const self = this;
      return banco.ref('reunioes').push({
        cliente: agendamento.cliente,
        dataHora: agendamento.dataFinal,
        pauta: 'Agendada pela Lalá',
        criadoEm: Date.now()
      }).then(function() {
        self.agendamentoPendente = null;
        return '✅ Prontinho! Reunião com <b>' + escapeHTML(agendamento.cliente) + '</b> salva em ' + escapeHTML(agendamento.dataStr) + ' às ' + String(agendamento.hora).padStart(2,'0') + ':' + String(agendamento.minuto).padStart(2,'0') + '.';
      }).catch(function(err) {
        console.warn('Lalá: erro ao salvar reunião.', err);
        return 'Erro ao salvar no banco. 😥 O agendamento com <b>' + escapeHTML(agendamento.cliente) + '</b> continua pendente. Digite <b>Sim</b> para tentar de novo ou <b>Não</b> para cancelar.';
      });
    },

    cancelarAgendamento: function() {
      if (!this.agendamentoPendente) return Promise.resolve('Não tinha nada pendente para cancelar.');
      const agendamento = this.agendamentoPendente;
      this.agendamentoPendente = null;
      return Promise.resolve('Tudo bem, cancelei o agendamento com <b>' + escapeHTML(agendamento.cliente) + '</b>. 🚫');
    },

    // ======================================================
    // BOM DIA
    // ======================================================
    darBomDia: function() {
      const banco = this.obterBanco();
      if (!banco) {
        return Promise.resolve('Puxa, ainda estou acordando o banco de dados... ☕ Tente me dar "Bom dia" de novo em 2 segundinhos!');
      }
      const hoje = new Date();
      const dataHojeStr = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');

      const pReunioes = banco.ref('reunioes').once('value')
        .then(function(snap) {
          const reunioes = snap.val() || {};
          const lista = [];
          Object.keys(reunioes).forEach(function(k) {
            const r = reunioes[k];
            if (r && r.dataHora && String(r.dataHora).indexOf(dataHojeStr) === 0) {
              const hora = String(r.dataHora).split('T')[1] || '00:00';
              lista.push(escapeHTML(hora + ' - ' + (r.cliente || 'Sem nome')));
            }
          });
          return lista;
        })
        .catch(function(err) { console.warn('Lalá: erro ao ler reuniões.', err); return null; });

      const pOrcamentos = banco.ref('orcamentos_abertos').once('value')
        .then(function(snap) {
          const todos = snap.val() || {};
          let pendentes = 0;
          Object.keys(todos).forEach(function(k) {
            const o = todos[k];
            if (o && o.status === 'aguardando') pendentes++;
          });
          return pendentes;
        })
        .catch(function(err) { console.warn('Lalá: erro ao ler orçamentos.', err); return null; });

      return Promise.all([pReunioes, pOrcamentos]).then(function(res) {
        const reunioesHoje = res[0];
        const orcamentosPendentes = res[1];
        let resposta = 'Bom dia! ☀️ Aqui está o seu resumo:<br><br>';
        if (reunioesHoje === null) resposta += '📅 <b>Reuniões:</b> não consegui consultar a agenda agora.<br><br>';
        else if (reunioesHoje.length > 0) resposta += '📅 <b>Reuniões:</b><br>' + reunioesHoje.join('<br>') + '<br><br>';
        else resposta += '📅 <b>Reuniões:</b> Nenhuma agendada para hoje.<br><br>';
        if (orcamentosPendentes === null) resposta += '💰 <b>Orçamentos:</b> não consegui consultar agora.<br>';
        else if (orcamentosPendentes > 0) resposta += '💰 <b>Orçamentos:</b> Existem ' + orcamentosPendentes + ' aguardando resposta.<br>';
        else resposta += '💰 <b>Orçamentos:</b> Nenhum pendente.<br>';
        return resposta + '<br>Vamos arrasar hoje! 💗';
      }).catch(function(err) {
        console.error('Lalá: erro no Bom Dia.', err);
        return 'Deu um erro ao buscar a agenda. Verifique as permissões do banco. 😥';
      });
    },

    // ======================================================
    // CÁLCULO
    // ======================================================
    calcularLucro: function(textoOriginal) {
      const texto = this.normalizarTexto(textoOriginal);
      const numeros = texto.match(/\d+([.,]\d+)?/g);
      if (!numeros || numeros.length < 2) return 'Preciso do valor e do custo. Exemplo: <b>"Calcula lucro de 1500 com custo 400"</b>';
      const n1 = parseFloat(numeros[0].replace(',', '.'));
      const n2 = parseFloat(numeros[1].replace(',', '.'));
      const posCusto = texto.indexOf('custo');
      const posPrimeiroNum = texto.search(/\d/);
      const custoPrimeiro = posCusto !== -1 && posPrimeiroNum !== -1 && posCusto < posPrimeiroNum;
      let valorFesta, custo;
      if (custoPrimeiro) { custo = n1; valorFesta = n2; } else { valorFesta = n1; custo = n2; }
      const lucro = valorFesta - custo;
      const margem = valorFesta > 0 ? (lucro / valorFesta) * 100 : 0;
      const corLucro = lucro >= 0 ? '#27ae60' : '#e74c3c';
      const rotulo = lucro >= 0 ? '📈 Lucro' : '📉 Prejuízo';
      return '🧮 <b>Calculadora de Lucro</b><br><br>💰 Festa: R$ ' + valorFesta.toFixed(2) + '<br>💸 Custo: R$ ' + custo.toFixed(2) + '<br>' + rotulo + ': <b style="color:' + corLucro + ';">R$ ' + lucro.toFixed(2) + '</b><br>🎯 Margem: <b>' + margem.toFixed(1) + '%</b>';
    },

    gerarMensagemFinanceiro: function() {
      return '<i>"Olá, [Nome]! Tudo bem? Entendo. Sobre o valor, infelizmente não consigo fazer a devolução no momento, pois o valor já foi destinado aos custos. Mas posso verificar se é possível usar como crédito para uma próxima festa."</i>';
    },
    gerarMensagemAtraso: function() {
      return '<i>"Olá, [Nome]! Passando para saber se as peças já estão prontas para devolução. Precisamos organizar o estoque. Lembrando que a diária de atraso se aplica."</i>';
    },
    gerarMensagemCancelamento: function() {
      return '<i>"Oi, [Nome]! Que pena saber que a festa não vai mais acontecer. Conforme o contrato, o sinal é retido, mas posso verificar com a direção a possibilidade de uma carta de crédito futura."</i>';
    },

    // ======================================================
    // ANIMAÇÃO
    // ======================================================
    iniciarAnimacao: function() {
      this.pararAnimacao();
      const sprite = document.getElementById('lala-sprite');
      if (!sprite) return;
      const posicoesX = ['0%', '33.33%', '66.66%', '100%'];
      const posicoesY = ['0%', '100%'];
      let frame = 0;
      this.animacaoInterval = setInterval(function() {
        const linha = Math.floor(frame / 4);
        const coluna = frame % 4;
        sprite.style.backgroundPosition = posicoesX[coluna] + ' ' + posicoesY[linha];
        frame++;
        if (frame >= 8) frame = 0;
      }, 500);
    },
    pararAnimacao: function() {
      if (this.animacaoInterval) { clearInterval(this.animacaoInterval); this.animacaoInterval = null; }
    },

    // ======================================================
    // TUTORIAL
    // ======================================================
    iniciarTutorial: function() {
      const container = document.getElementById('lala-personagem-container');
      const balao = document.getElementById('lala-balao-tutorial');
      if (!container || !balao) return;
      container.style.display = 'block';
      balao.classList.add('ativo');
      this.iniciarAnimacao();
      this.tutorialPasso = 1;
      this.atualizarBalaoTutorial();
    },

    pular: function() {
      const balao = document.getElementById('lala-balao-tutorial');
      if (balao) balao.classList.remove('ativo');
      this.pararAnimacao();
      this.limparDestaques();
      const banco = this.obterBanco();
      if (!banco) return;
      const perfil = this.obterPerfil();
      banco.ref('configuracoes/tutorial/' + perfil).update({ dispensado: true })
        .catch(function(err) { console.warn('Lalá: erro ao marcar tutorial como pulado.', err); });
    },

    proximo: function() {
      if (this.tutorialPasso < this.totalPassos) { this.tutorialPasso++; this.atualizarBalaoTutorial(); }
      else {
        this.pular();
        const banco = this.obterBanco();
        if (!banco) return;
        const perfil = this.obterPerfil();
        banco.ref('configuracoes/tutorial/' + perfil).update({ apresentado: true, dispensado: false })
          .catch(function(err) { console.warn('Lalá: erro ao marcar tutorial como concluído.', err); });
      }
    },

    voltar: function() { if (this.tutorialPasso > 1) { this.tutorialPasso--; this.atualizarBalaoTutorial(); } },

    limparDestaques: function() {
      document.querySelectorAll('.tutorial-destaque').forEach(function(el) { el.classList.remove('tutorial-destaque'); });
    },

    destacarElemento: function(idElemento) {
      this.limparDestaques();
      const el = document.getElementById(idElemento);
      if (el) { el.classList.add('tutorial-destaque'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    },

    atualizarBalaoTutorial: function() {
      const txt = document.getElementById('lala-tutorial-texto');
      const btnVoltar = document.getElementById('btn-tutorial-voltar');
      const btnProximo = document.getElementById('btn-tutorial-proximo');
      if (!txt) return;
      if (btnVoltar) btnVoltar.style.display = this.tutorialPasso > 1 ? 'block' : 'none';
      if (btnProximo) btnProximo.innerText = this.tutorialPasso === this.totalPassos ? 'Concluir 🎉' : 'Próximo ➔';

      if (this.tutorialPasso === 1) {
        txt.innerHTML = 'Oi! Eu sou a Lalá! Este é o <b>Agendamento</b>. É aqui que você cadastra uma nova festa.';
        this.destacarElemento('titulo-form-reserva');
      } else if (this.tutorialPasso === 2) {
        txt.innerHTML = 'Aqui estão os <b>Orçamentos em Aberto</b>. Use esse painel para acompanhar quem ainda não fechou.';
        this.destacarElemento('btn-abrir-orcamentos-aberto');
      } else if (this.tutorialPasso === 3) {
        txt.innerHTML = 'Quer marcar reunião com cliente? Use <b>Agendar Reuniões</b>. Ou me diga <b>"Agende com Maria 25/10 15:00"</b>.';
        this.destacarElemento('btn-abrir-reunioes-painel');
      } else if (this.tutorialPasso === 4) {
        txt.innerHTML = 'Quer saber as vendas ou calcular o lucro? Abra <b>Venda Mensal & Anual</b> ou pergunte pra mim.';
        this.destacarElemento('btn-abrir-central-relatorios');
      }
    },

    verificarTutorialInicial: function() {
      if (this.tutorialJaVerificadoNestaSessao) return Promise.resolve(false);
      this.tutorialJaVerificadoNestaSessao = true;
      const self = this;
      return this.carregarPerfilDoUsuario().then(function() {
        const banco = self.obterBanco();
        if (!banco) return false;
        const perfil = self.obterPerfil();
        return banco.ref('configuracoes/tutorial/' + perfil).once('value')
          .then(function(snap) {
            const cfg = snap.val() || {};
            if (cfg.apresentado === true || cfg.dispensado === true) return false;
            setTimeout(function() { self.iniciarTutorial(); }, 800);
            return true;
          })
          .catch(function(err) { console.warn('Lalá: erro ao verificar tutorial inicial.', err); return false; });
      });
    },

    // ======================================================
    // SAUDAÇÃO AUTOMÁTICA
    // ======================================================
    // Chave de sessionStorage por uid — evita repetir em reloads,
    // mas não persiste entre sessões de navegador diferentes.
    chaveSaudacaoSessao: function() {
      const uid = (window.State && window.State.usuarioUID) || 'anon';
      return 'lala_saudacao_' + uid;
    },

    jaMostrouSaudacaoNestaSessao: function() {
      try { return sessionStorage.getItem(this.chaveSaudacaoSessao()) === '1'; }
      catch (e) { return false; }
    },

    marcarSaudacaoMostrada: function() {
      try { sessionStorage.setItem(this.chaveSaudacaoSessao(), '1'); }
      catch (e) { /* storage bloqueado, ignora */ }
    },

    // Verifica se os dados principais já carregaram.
    // Não usa tempo fixo: consulta o State do app.js.
    dadosPrincipaisProntos: function() {
      if (!window.State) return false;
      // State.carregando começa true e vira false no 1º listenReservas.
      if (window.State.carregando === true) return false;
      // Estoque: se ainda não tiver sido populado, esperamos um tico mais.
      // Se estiver vazio E carregando === false, consideramos pronto
      // (catálogo pode estar legitimamente vazio).
      return true;
    },

    // ------------------------------------------------------
    // Indicador de digitação (3 pontinhos) genérico.
    // Retorna o elemento criado para permitir substituição.
    // ------------------------------------------------------
    criarIndicadorHTML: function(textoOpcional) {
      const texto = textoOpcional ? '<span class="lala-indicador-texto">' + escapeHTML(textoOpcional) + '</span>' : '';
      return '<div class="lala-indicador">' +
        '<span class="lala-digitando" aria-hidden="true"><span></span><span></span><span></span></span>' +
        texto +
        '</div>';
    },

    // ------------------------------------------------------
    // Indicador "Lalá está consultando..."
    // Separado do boas-vindas, com id único para não duplicar.
    // ------------------------------------------------------
    mostrarIndicadorConsulta: function() {
      const body = document.getElementById('lala-body');
      if (!body) return null;
      if (document.getElementById('lala-indicador-consulta')) return null;
      const div = document.createElement('div');
      div.className = 'lala-msg bot';
      div.id = 'lala-indicador-consulta';
      div.innerHTML = this.criarIndicadorHTML(TEXTO_CONSULTA);
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
      return div;
    },

    esconderIndicadorConsulta: function() {
      const el = document.getElementById('lala-indicador-consulta');
      if (el && el.parentNode) el.parentNode.removeChild(el);
    },

    // ------------------------------------------------------
    // Saudação automática — chamada ao abrir o chat.
    // Primeira vez após login: injeta "carregando" e depois
    // troca para "pronto"/"demorou"/"erro" conforme o State.
    // ------------------------------------------------------
    iniciarSaudacaoSeNecessario: function() {
      // Já mostrou nesta sessão de chat? Sai.
      if (this._boasVindasJaMostradas) return;
      if (this.jaMostrouSaudacaoNestaSessao()) {
        this._boasVindasJaMostradas = true;
        return;
      }
      if (this._saudacaoEmAndamento) return;

      const body = document.getElementById('lala-body');
      if (!body) return;

      this._saudacaoEmAndamento = true;

      // Evita duplicar se já existir (ex.: usuário fechou/abriu rápido)
      const existente = document.getElementById('lala-saudacao-carregando');
      if (existente && existente.parentNode) existente.parentNode.removeChild(existente);

      // --- Mensagem 1: carregando com indicador ---
      const divCarregando = document.createElement('div');
      divCarregando.className = 'lala-msg bot';
      divCarregando.id = 'lala-saudacao-carregando';
      divCarregando.innerHTML =
        escapeHTML(SAUDACAO_CARREGANDO) +
        '<br><br>' + this.criarIndicadorHTML('');
      body.appendChild(divCarregando);
      body.scrollTop = body.scrollHeight;

      const self = this;
      const inicio = Date.now();
      const LIMITE_ESPERA = 15000;   // 15 s → mensagem de demora
      const INTERVALO = 400;

      // Cancela timer anterior se houver
      if (this._saudacaoTimer) { clearInterval(this._saudacaoTimer); this._saudacaoTimer = null; }

      const verificar = function() {
        // Se o chat foi fechado, não faz nada além de continuar tentando
        // (a saudação aparece no DOM quando reabrir; e o flag impede
        // nova tentativa no próximo abrir).
        const bodyAtual = document.getElementById('lala-body');
        if (!bodyAtual) return;

        let estado = 'aguardando';

        // Sem banco / sem State → erro
        if (!self.obterBanco() || !window.State) {
          estado = 'erro';
        } else if (self.dadosPrincipaisProntos()) {
          estado = 'pronto';
        } else if (Date.now() - inicio > LIMITE_ESPERA) {
          estado = 'demorou';
        }

        if (estado === 'aguardando') return;

        // Para o polling
        if (self._saudacaoTimer) { clearInterval(self._saudacaoTimer); self._saudacaoTimer = null; }

        const alvo = document.getElementById('lala-saudacao-carregando');
        if (alvo && alvo.parentNode) alvo.parentNode.removeChild(alvo);

        let textoFinal;
        if (estado === 'pronto') textoFinal = SAUDACAO_PRONTO;
        else if (estado === 'demorou') textoFinal = SAUDACAO_DEMOROU;
        else textoFinal = SAUDACAO_ERRO;

        const divFinal = document.createElement('div');
        divFinal.className = 'lala-msg bot';
        divFinal.id = 'lala-saudacao-pronto';
        // Texto fixo — pode ir por innerHTML sem risco
        divFinal.innerHTML = escapeHTML(textoFinal);
        bodyAtual.appendChild(divFinal);
        bodyAtual.scrollTop = bodyAtual.scrollHeight;

        self._boasVindasJaMostradas = true;
        self._saudacaoEmAndamento = false;
        self.marcarSaudacaoMostrada();
      };

      // Executa uma vez imediatamente (caso os dados já estejam prontos)
      verificar();
      if (!this._boasVindasJaMostradas) {
        this._saudacaoTimer = setInterval(verificar, INTERVALO);
      }
    }
  };

  window.LalaTutorial = LALA;

  // ============================================================
  // CHAT — DOMContentLoaded
  // ============================================================
  document.addEventListener('DOMContentLoaded', function() {
    const fab = document.getElementById('lala-fab');
    const janela = document.getElementById('lala-janela');
    const body = document.getElementById('lala-body');
    const input = document.getElementById('lala-input');
    const enviar = document.getElementById('lala-enviar');
    const fechar = document.getElementById('lala-fechar');

    if (!fab || !janela) return;

    fab.addEventListener('click', function() {
      const abrindo = !janela.classList.contains('ativo');
      janela.classList.toggle('ativo');
      fab.classList.remove('pulso');
      if (abrindo) {
        setTimeout(function() { if (input) input.focus(); }, 200);
        // Saudação automática ao abrir pela 1ª vez após login.
        // Verifica o State/uid: se ainda não logou, a saudação espera
        // a próxima abertura (não força nada).
        LALA.iniciarSaudacaoSeNecessario();
      }
    });

    if (fechar) {
      fechar.addEventListener('click', function() {
        janela.classList.remove('ativo');
        LALA.pararAnimacao();
      });
    }

    // -------- helpers de mensagem --------
    function addBotMsg(html) {
      const div = document.createElement('div');
      div.className = 'lala-msg bot';
      div.innerHTML = String(html === undefined || html === null ? '' : html);
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
      return div;
    }

    function addUserMsg(texto) {
      const div = document.createElement('div');
      div.className = 'lala-msg user';
      div.textContent = String(texto === undefined || texto === null ? '' : texto);
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    }

    // Envolve promessas de consulta com o indicador "Lalá está consultando..."
    // Garante remoção no finally, mesmo em erro.
    function comIndicadorConsulta(promise) {
      LALA.mostrarIndicadorConsulta();
      return promise.then(function(r) {
        LALA.esconderIndicadorConsulta();
        return r;
      }).catch(function(err) {
        LALA.esconderIndicadorConsulta();
        throw err;
      });
    }

    function responder(texto) {
      if (!texto || !texto.trim()) return;
      addUserMsg(texto);
      
      // COMANDOS AUTOMÁTICOS DA LALÁ
      const comandosLala = [
        '/fim-semana',
        '/separacao',
        '/pagamentos',
        '/orcamentos',
        '/logistica'
      ];

      if (comandosLala.includes(texto.trim())) {
        comIndicadorConsulta(
          LALA.consultarComandoLala(texto.trim())
        )
          .then(function(mensagem) {
            addBotMsg(mensagem);
          })
          .catch(function(erro) {
            console.error('Comando Lalá:', erro);
            addBotMsg('😥 Não consegui executar essa consulta.');
          });

        return;
      }


      setTimeout(function() {
        let resposta;
        try { resposta = LALA.buscar(texto); }
        catch (err) {
          console.error('Lalá: erro em buscar().', err);
          addBotMsg('Deu um erro interno. Tente de novo. 😥');
          return;
        }

        if (resposta && resposta.isConfirmar) {
          comIndicadorConsulta(LALA.confirmarAgendamento())
            .then(function(msg) { addBotMsg(msg); })
            .catch(function(err) {
              console.warn('Lalá: erro em confirmarAgendamento.', err);
              addBotMsg('Erro ao salvar. 😥 O agendamento continua pendente.');
            });
          return;
        }

        if (resposta && resposta.isCancelar) {
          comIndicadorConsulta(LALA.cancelarAgendamento())
            .then(function(msg) { addBotMsg(msg); })
            .catch(function(err) {
              console.warn('Lalá: erro em cancelarAgendamento.', err);
              addBotMsg('Erro ao cancelar. 😥');
            });
          return;
        }

        if (resposta && resposta.isBomDia) {
          comIndicadorConsulta(LALA.darBomDia())
            .then(function(res) { addBotMsg(res); })
            .catch(function(err) {
              console.warn('Lalá: erro em darBomDia.', err);
              addBotMsg('Erro ao consultar a agenda. 😥');
            });
          return;
        }

if (texto.trim() === '/orcamentos') {
  comIndicadorConsulta(
    LALA.consultarOrcamentosPendentes()
  ).then(function(msg) {
    addBotMsg(msg);
  }).catch(function(err) {
    console.error(err);
    addBotMsg('😥 Erro ao consultar orçamentos.');
  });
  return;
}

        if (resposta && resposta.isFaturamento) { addBotMsg(LALA.consultarFaturamentoMes()); return; }
        if (resposta && resposta.isProximos) { addBotMsg(LALA.consultarProximosEventos()); return; }

        if (resposta && resposta.isTutorial) {
          addBotMsg('Claro! Abrindo o tutorial. 😊');
          setTimeout(function() { if (LALA.iniciarTutorial) LALA.iniciarTutorial(); }, 800);
          return;
        }

        if (resposta && resposta.resposta) { addBotMsg(resposta.resposta); return; }

        addBotMsg("Ainda não sei responder isso. 😅 Digite <b>'O que você faz?'</b>.");
      }, 500);
    }

    if (enviar) {
      enviar.addEventListener('click', function() {
        const t = input.value.trim();
        if (t) { responder(t); input.value = ''; }
      });
    }

    if (input) {
      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); if (enviar) enviar.click(); }
      });
    }

    
// ============================================
// COMANDO LALÁ - MENU E ENVIO AUTOMÁTICO
// ============================================

const btnComando = document.getElementById('btn-comando-lala');
const menuComando = document.getElementById('menu-comando-lala');

if (btnComando && menuComando) {
  btnComando.addEventListener('click', function() {
    menuComando.hidden = !menuComando.hidden;
  });
}

const atalhos = document.querySelectorAll('.lala-atalho');

atalhos.forEach(function(btn) {
  btn.addEventListener('click', function() {
    const pergunta = btn.getAttribute('data-pergunta');
    if (!pergunta) return;

    // Abre o chat automaticamente
    if (janela && !janela.classList.contains('ativo')) {
      janela.classList.add('ativo');
      fab.classList.remove('pulso');
      LALA.iniciarSaudacaoSeNecessario();
    }

    // Fecha o menu
    if (menuComando) {
      menuComando.hidden = true;
    }

    // Envia a pergunta para a Lalá
    responder(pergunta);

    if (input) input.focus();
  });
});

