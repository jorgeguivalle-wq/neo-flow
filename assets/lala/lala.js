// ============================================================
// ASSISTENTE VIRTUAL LALÁ 🌸 (VERSÃO CONSULTORA DE DADOS)
// ============================================================
(function() {
  'use strict';

  const LALA = {
    animacaoInterval: null,
    tutorialPasso: 0,
    totalPassos: 4,
    agendamentoPendente: null,
    aguardandoSituacaoMensagem: false, 

    buscar: function(texto) {
      if (!texto) return null;
      var t = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

      // 1. IDENTIFICADORES FLEXÍVEIS
      const pedeAgendar = t.includes('agend') || t.includes('marc') || t.includes('reuni') || t.includes('horari');
      const pedeMensagem = t.includes('mensag') || t.includes('falar') || t.includes('respond') || t.includes('text') || t.includes('falo') || t.includes('recus');
      const pedeCalculo = t.includes('calcul') || t.includes('lucro') || t.includes('margem') || t.includes('porcent');
      const pedeBomDia = t.includes('bom dia') || t.includes('resum') || t.includes('hoje') || t.includes('pendenc') || t.includes('agenda');
      const pedeFaturamento = t.includes('fatura') || t.includes('venda') || t.includes('lucro do mes') || t.includes('quanto ganhei');
      const pedeProximo = t.includes('proxim') || t.includes('quais festas') || t.includes('eventos');
      const pedeEstoque = t.includes('estoque') || t.includes('pecas') || t.includes('catalogo');
      const pedeTutorial = t.includes('tutorial') || t.includes('refaz') || t.includes('apresent') || t.includes('o que voce') || t.includes('func');

      // 2. EXECUÇÃO DAS INTENÇÕES
      if (pedeAgendar) return this.prepararAgendamento(texto);

      if (pedeMensagem) {
        if (t.includes('dinheir') || t.includes('reembols') || t.includes('devolv') || t.includes('pix')) return { resposta: this.gerarMensagemFinanceiro() };
        if (t.includes('atras') || t.includes('peca')) return { resposta: this.gerarMensagemAtraso() };
        if (t.includes('cancel') || t.includes('desist')) return { resposta: this.gerarMensagemCancelamento() };
        
        this.aguardandoSituacaoMensagem = true;
        return { resposta: "Claro! Eu te ajudo a escrever. ✍️<br><br>Sobre o que é a situação?<br>1 - Cliente quer o <b>dinheiro de volta</b><br>2 - Cliente com <b>atraso</b> na devolução<br>3 - Cliente quer <b>cancelar</b><br><br>Me conte com suas palavras!" };
      }

      if (this.aguardandoSituacaoMensagem) {
        this.aguardandoSituacaoMensagem = false;
        if (t.includes('dinheir') || t.includes('reembols') || t === '1') return { resposta: this.gerarMensagemFinanceiro() };
        if (t.includes('atras') || t === '2') return { resposta: this.gerarMensagemAtraso() };
        if (t.includes('cancel') || t === '3') return { resposta: this.gerarMensagemCancelamento() };
        return { resposta: "Entendi. Aqui vai uma mensagem educada para acalmar o cliente:<br><br><i>\"Olá, [Nome]! Tudo bem? Entendo a sua situação. Vou verificar e te retorno ainda hoje.\"</i>" };
      }

      if (pedeCalculo) return { resposta: this.calcularLucro(texto) };
      
      if (pedeBomDia) return { isBomDia: true };
      
      if (pedeFaturamento) return { isFaturamento: true };

      if (pedeProximo) return { isProximos: true };

      if (pedeEstoque) return { resposta: this.verificarEstoque() };

      if (pedeTutorial) {
        if (t.includes('refaz') || t.includes('tutorial') || t.includes('apresent')) return { isTutorial: true };
        return { resposta: "Eu sou a Lalá! 🌸 Posso:<br><br>☀️ <b>Bom dia:</b> Ver a agenda de hoje.<br>📅 <b>Agendar:</b> 'Agende com Maria 25/10 15:00'.<br>💬 <b>Mensagens:</b> Te ajudo a responder clientes.<br>🧮 <b>Lucro:</b> 'Calcula lucro de 1500 com custo 400'.<br>📊 <b>Faturamento:</b> 'Qual o faturamento do mês?'<br>📦 <b>Estoque:</b> 'Quantas peças temos?'<br>🎓 <b>Tutorial:</b> 'Refazer tutorial'." };
      }

      if (t.includes('oi') || t.includes('ola') || t.includes('tud') || t.includes('eai') || t.includes('opa')) {
        return { resposta: 'Oi! 🌸 Sou a Lalá. Precisa de ajuda com mensagens, agendamentos ou relatórios? Digite <b>"O que você faz?"</b>.' };
      }

      return null;
    },

    // =======================================================
    // NOVAS FUNÇÕES DE CONSULTA AO FIREBASE (VIA STATE)
    // =======================================================
    
    consultarFaturamentoMes: function() {
      if (!window.State || !window.State.reservas) return "Puxa, estou sem os dados das reservas no momento. 😥";
      
      const hoje = new Date();
      const mesAtual = hoje.getMonth();
      const anoAtual = hoje.getFullYear();
      
      let totalFaturado = 0;
      let qtdFestas = 0;

      window.State.reservas.forEach(r => {
        if (!r.data) return;
        const dataReserva = new Date(r.data + "T00:00:00");
        if (dataReserva.getMonth() === mesAtual && dataReserva.getFullYear() === anoAtual) {
          // Soma o valor total + o frete (para bater com o relatório do sistema)
          totalFaturado += (parseFloat(r.total) || 0) + (parseFloat(r.frete) || 0);
          qtdFestas++;
        }
      });

      const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      const nomeMes = meses[mesAtual];

      if (qtdFestas === 0) {
        return `Ainda não tivemos nenhuma festa registrada em <b>${nomeMes}</b>. Vamos agitar as vendas! 🚀`;
      }

      return `📊 <b>Resumo de ${nomeMes}:</b><br><br>🎉 Tivemos <b>${qtdFestas} festa(s)</b> agendada(s).<br>💰 Faturamento total: <b>R$ ${totalFaturado.toFixed(2).replace('.', ',')}</b>.<br><br>Quer ver os detalhes? Clique em <b>Venda Mensal & Anual</b> no painel!`;
    },

    consultarProximosEventos: function() {
      if (!window.State || !window.State.reservas) return "Puxa, estou sem os dados das reservas no momento. 😥";
      
      const hoje = new Date();
      hoje.setHours(0,0,0,0);

      // Filtra apenas festas futuras e ordena pela data mais próxima
      const futuras = window.State.reservas
        .filter(r => r.data && new Date(r.data + "T00:00:00") >= hoje)
        .sort((a, b) => new Date(a.data + "T00:00:00") - new Date(b.data + "T00:00:00"))
        .slice(0, 3); // Pega apenas as 3 próximas

      if (futuras.length === 0) {
        return "Não temos nenhuma festa agendada para os próximos dias. 📅";
      }

      let resposta = "📅 <b>Próximos Eventos:</b><br><br>";
      futuras.forEach(f => {
        const partesData = f.data.split('-');
        const dataFormatada = `${partesData[2]}/${partesData[1]}`;
        resposta += `🎉 <b>${dataFormatada}</b> - ${f.cliente}<br>🎨 Tema: ${f.tema || 'Não informado'}<br><br>`;
      });
      return resposta;
    },

    verificarEstoque: function() {
      if (!window.State || !window.State.estoqueArray) return "Puxa, não consegui acessar o catálogo agora. 😥";
      
      const totalPecas = window.State.estoqueArray.length;
      
      if (totalPecas === 0) {
        return "Nosso catálogo está vazio no momento. Que tal cadastrar algumas peças? 📦";
      }

      return `📦 Temos <b>${totalPecas} peças/temas</b> cadastrados no catálogo.<br><br>Para ver os detalhes, clique em <b>Ver Catálogo</b> no painel principal!`;
    },

    // =======================================================
    // OUTRAS FUNÇÕES (Agendamento, Mensagens, Lucro)
    // =======================================================
    prepararAgendamento: function(textoOriginal) {
      let texto = textoOriginal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let dia = "", mes = "";
      const regexBarra = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/;
      const regexExtenso = /(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i;
      const matchBarra = texto.match(regexBarra);
      const matchExtenso = texto.match(regexExtenso);

      if (matchBarra) { dia = matchBarra[1]; mes = matchBarra[2]; } 
      else if (matchExtenso) {
        dia = matchExtenso[1];
        const meses = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
        mes = String(meses.indexOf(matchExtenso[2]) + 1).padStart(2, '0');
      }

      let hora = "";
      const regexHora = /(\d{1,2})(?::(\d{2})|h(\d{2})?| horas?| hrs?)/;
      const matchHora = texto.match(regexHora);
      if (matchHora) hora = matchHora[1].padStart(2, '0') + ":" + (matchHora[2] || matchHora[3] || "00");

      let cliente = "Cliente";
      const regexNome = /(?:com|para)\s+(?:a\s+|o\s+)?([a-zA-ZÀ-ÿ\s]+?)(?:\s+(?:dia|no|as|às|\d|$))/i;
      const matchNome = textoOriginal.match(regexNome);
      if (matchNome) { cliente = matchNome[1].trim(); cliente = cliente.replace(/(reuniao|reunião|agendar|marcar|horario)/gi, "").trim(); }

      if (!dia || !hora) return { resposta: "Entendi que você quer agendar! 😊 Mas faltou a data e a hora.<br><br>Pode me dizer assim: <b>'Agende com Maria 25/10 às 15:00'</b>" };

      const ano = matchBarra && matchBarra[3] ? matchBarra[3] : new Date().getFullYear();
      const dataFormatada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      
      this.agendamentoPendente = { cliente, dataStr: `${dia}/${mes}`, hora, dataFinal: `${dataFormatada}T${hora}` };
      return { resposta: `📅 <b>Confirmação:</b><br><br>👤 <b>${cliente}</b><br>📆 <b>${dia}/${mes}</b><br>⏰ <b>${hora}</b><br><br>Posso salvar? (Digite <b>Sim</b> ou <b>Não</b>)` };
    },

    confirmarAgendamento: function() {
      if (!this.agendamentoPendente) return "Não tem nada pendente.";
      const agendamento = this.agendamentoPendente; this.agendamentoPendente = null;
      if (!window.db) return "Erro: Sem conexão com o banco. Verifique o app.js.";
      return window.db.ref('reunioes').push({ cliente: agendamento.cliente, dataHora: agendamento.dataFinal, pauta: "Agendada pela Lalá", criadoEm: Date.now() })
        .then(() => `✅ Prontinho! Reunião com <b>${agendamento.cliente}</b> salva.`)
        .catch(() => "Erro ao salvar. 😥");
    },
    cancelarAgendamento: function() { this.agendamentoPendente = null; return "Tudo bem, cancelei o agendamento. 🚫"; },

    calcularLucro: function(texto) {
      const numeros = texto.match(/\d+([.,]\d+)?/g);
      if (!numeros || numeros.length < 2) return "Preciso do valor e do custo. Exemplo: <b>'Calcula lucro de 1500 com custo 400'</b>";
      let v1 = parseFloat(numeros[0].replace(',', '.')), v2 = parseFloat(numeros[1].replace(',', '.'));
      let valorFesta = Math.max(v1, v2), custo = Math.min(v1, v2);
      let lucro = valorFesta - custo, margem = (lucro / valorFesta) * 100;
      return `🧮 <b>Calculadora de Lucro</b><br><br>💰 Festa: R$ ${valorFesta.toFixed(2)}<br>💸 Custo: R$ ${custo.toFixed(2)}<br>📈 Lucro: <b style="color:#27ae60;">R$ ${lucro.toFixed(2)}</b><br>🎯 Margem: <b>${margem.toFixed(1)}%</b>`;
    },

    gerarMensagemFinanceiro: function() { return `<i>"Olá, [Nome]! Tudo bem? Entendo. Sobre o valor, infelizmente não consigo fazer a devolução no momento, pois o valor já foi destinado aos custos. Mas posso verificar se é possível usar como crédito para uma próxima festa."</i>`; },
    gerarMensagemAtraso: function() { return `<i>"Olá, [Nome]! Passando para saber se as peças já estão prontas para devolução. Precisamos organizar o estoque. Lembrando que a diária de atraso se aplica."</i>`; },
    gerarMensagemCancelamento: function() { return `<i>"Oi, [Nome]! Que pena saber que a festa não vai mais acontecer. Conforme o contrato, o sinal é retido, mas posso verificar com a direção a possibilidade de uma carta de crédito futura."</i>`; },

    darBomDia: function() {
      if (!window.State || !window.db) return Promise.resolve("Puxa, estou sem conexão com o banco. 😥");
      const hoje = new Date(); 
      const dataHojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      return window.db.ref('reunioes').once('value').then(snap => {
        const reunioes = snap.val() || {}; let reunioesHoje = [];
        Object.values(reunioes).forEach(r => { if (r.dataHora && r.dataHora.startsWith(dataHojeStr)) { const hora = r.dataHora.split('T')[1] || '00:00'; reunioesHoje.push(`${hora} - ${r.cliente}`); } });
        const orcamentosPendentes = window.State.orcamentosAbertos ? window.State.orcamentosAbertos.filter(o => o.status === 'aguardando').length : 0;
        let resposta = "Bom dia! ☀️ Aqui está o seu resumo:<br><br>";
        resposta += reunioesHoje.length > 0 ? `📅 <b>Reuniões:</b><br>${reunioesHoje.join('<br>')}<br><br>` : `📅 <b>Reuniões:</b> Nenhuma agendada para hoje.<br><br>`;
        resposta += orcamentosPendentes > 0 ? `💰 <b>Orçamentos:</b> Existem ${orcamentosPendentes} aguardando resposta.<br>` : `💰 <b>Orçamentos:</b> Nenhum pendente.<br>`;
        return resposta + `<br>Vamos arrasar hoje! 💗`;
      }).catch(err => "Deu um erro ao buscar a agenda. 😥");
    },

    iniciarAnimacao: function() {
      this.pararAnimacao();
      const sprite = document.getElementById('lala-sprite');
      if (!sprite) return;
      const posicoesX = ['0%', '33.33%', '66.66%', '100%'];
      const posicoesY = ['0%', '100%'];
      let frame = 0; 
      this.animacaoInterval = setInterval(() => {
        let linha = Math.floor(frame / 4); 
        let coluna = frame % 4;            
        sprite.style.backgroundPosition = `${posicoesX[coluna]} ${posicoesY[linha]}`;
        frame++;
        if (frame >= 8) frame = 0; 
      }, 500); 
    },
    pararAnimacao: function() { if (this.animacaoInterval) clearInterval(this.animacaoInterval); },

    iniciarTutorial: function() {
      const container = document.getElementById('lala-personagem-container');
      const balao = document.getElementById('lala-balao-tutorial');
      if (!container || !balao) return;
      container.style.display = 'block'; balao.classList.add('ativo'); this.iniciarAnimacao(); this.tutorialPasso = 1; this.atualizarBalaoTutorial();
    },
    pular: function() {
      const balao = document.getElementById('lala-balao-tutorial'); if (balao) balao.classList.remove('ativo');
      this.pararAnimacao(); this.limparDestaques();
      if (window.db && window.State && window.State.usuarioLogadoEmail) {
        const u = window.State.usuarioLogadoEmail.includes('aline') ? 'aline' : 'leo';
        window.db.ref(`configuracoes/tutorial/${u}`).update({ dispensado: true });
      }
    },
    proximo: function() {
      if (this.tutorialPasso < this.totalPassos) { this.tutorialPasso++; this.atualizarBalaoTutorial(); }
      else {
        this.pular();
        if (window.db && window.State && window.State.usuarioLogadoEmail) {
          const u = window.State.usuarioLogadoEmail.includes('aline') ? 'aline' : 'leo';
          window.db.ref(`configuracoes/tutorial/${u}`).update({ apresentado: true, dispensado: false });
        }
      }
    },
    voltar: function() { if (this.tutorialPasso > 1) { this.tutorialPasso--; this.atualizarBalaoTutorial(); } },
    limparDestaques: function() { document.querySelectorAll('.tutorial-destaque').forEach(el => el.classList.remove('tutorial-destaque')); },
    destacarElemento: function(idElemento) {
      this.limparDestaques(); const el = document.getElementById(idElemento);
      if (el) { el.classList.add('tutorial-destaque'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    },
    atualizarBalaoTutorial: function() {
      const txt = document.getElementById('lala-tutorial-texto'); const btnVoltar = document.getElementById('btn-tutorial-voltar'); const btnProximo = document.getElementById('btn-tutorial-proximo');
      if (!txt) return;
      if (btnVoltar) btnVoltar.style.display = this.tutorialPasso > 1 ? 'block' : 'none';
      if (btnProximo) btnProximo.innerText = this.tutorialPasso === this.totalPassos ? 'Concluir 🎉' : 'Próximo ➔';

      if (this.tutorialPasso === 1) { txt.innerHTML = "Oi! Eu sou a Lalá! Este é o <b>Agendamento</b>."; this.destacarElemento("titulo-form-reserva"); } 
      else if (this.tutorialPasso === 2) { txt.innerHTML = "Digite <b>'Bom dia'</b> para ver suas reuniões e pendências!"; this.destacarElemento("btn-abrir-orcamentos-aberto"); } 
      else if (this.tutorialPasso === 3) { txt.innerHTML = "Peça pra mim agendar reuniões! <b>'Agende com Maria 25/10 15:00'</b>."; this.destacarElemento("btn-abrir-reunioes-painel"); } 
      else if (this.tutorialPasso === 4) { txt.innerHTML = "Quer saber as vendas ou calcular o lucro? <b>'Qual o faturamento do mês?'</b>."; this.destacarElemento("btn-abrir-central-relatorios"); }
    }
  };

  window.LalaTutorial = LALA;

  document.addEventListener('DOMContentLoaded', function() {
    var fab = document.getElementById('lala-fab'); var janela = document.getElementById('lala-janela'); var body = document.getElementById('lala-body'); var input = document.getElementById('lala-input'); var enviar = document.getElementById('lala-enviar'); var fechar = document.getElementById('lala-fechar');
    if (!fab || !janela) return;
    fab.addEventListener('click', function() { janela.classList.toggle('ativo'); fab.classList.remove('pulso'); if (janela.classList.contains('ativo')) setTimeout(() => input.focus(), 200); });
    fechar.addEventListener('click', () => janela.classList.remove('ativo'));

    function addMsg(texto, tipo) {
      var div = document.createElement('div'); div.className = 'lala-msg ' + tipo; div.innerHTML = texto;
      body.appendChild(div); body.scrollTop = body.scrollHeight;
    }

    function responder(texto) {
      if (!texto || !texto.trim()) return;
      addMsg(texto, 'user');
      setTimeout(() => {
        var resposta = LALA.buscar(texto);
        
        if (resposta && resposta.isBomDia) { addMsg("Deixa eu ver a agenda... ⏳", 'bot'); LALA.darBomDia().then(res => addMsg(res, 'bot')); } 
        else if (resposta && resposta.isFaturamento) { addMsg(LALA.consultarFaturamentoMes(), 'bot'); }
        else if (resposta && resposta.isProximos) { addMsg(LALA.consultarProximosEventos(), 'bot'); }
        else if (resposta && resposta.isTutorial) { addMsg("Claro! Abrindo o tutorial. 😊", 'bot'); setTimeout(() => { if (LALA.iniciarTutorial) LALA.iniciarTutorial(); }, 1000); }
        else if (resposta && resposta.resposta) { addMsg(resposta.resposta, 'bot'); }
        else if (resposta && resposta.isConfirmar) { addMsg(LALA.confirmarAgendamento(), 'bot'); }
        else if (resposta && resposta.isCancelar) { addMsg(LALA.cancelarAgendamento(), 'bot'); }
        else { addMsg("Ainda não sei responder isso. 😅 Digite <b>'O que você faz?'</b>.", 'bot'); }
      }, 800);
    }

    enviar.addEventListener('click', function() { var t = input.value.trim(); if (t) { responder(t); input.value = ''; } });
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviar.click(); });
  });
})();
