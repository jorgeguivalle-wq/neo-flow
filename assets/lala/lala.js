// ============================================================
// ASSISTENTE VIRTUAL LALÁ 🌸 (VERSÃO FINAL - GRID 4x2)
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

      // 1. INTENÇÃO: Agendar
      if (t.includes('agende') || t.includes('agendar') || t.includes('marcar') || (t.includes('reuniao') && !t.includes('mensagem'))) {
        return this.prepararAgendamento(texto);
      }

      // 2. INTENÇÃO: Mensagem Difícil
      if ((t.includes('mensagem') || t.includes('falar') || t.includes('responder') || t.includes('texto')) && !t.includes('tutorial')) {
        if (t.includes('dinheiro') || t.includes('reembolso') || t.includes('devolver') || t.includes('pix')) return { resposta: this.gerarMensagemFinanceiro() };
        if (t.includes('atraso') || t.includes('peça') || t.includes('peca')) return { resposta: this.gerarMensagemAtraso() };
        if (t.includes('cancelar') || t.includes('desistiu')) return { resposta: this.gerarMensagemCancelamento() };
        
        this.aguardandoSituacaoMensagem = true;
        return { resposta: "Claro! Eu te ajudo a escrever. ✍️<br><br>Sobre o que é a situação?<br>1 - Cliente quer o <b>dinheiro de volta</b><br>2 - Cliente com <b>atraso</b> na devolução<br>3 - Cliente quer <b>cancelar</b><br><br>Me conte com suas palavras!" };
      }

      if (this.aguardandoSituacaoMensagem) {
        this.aguardandoSituacaoMensagem = false;
        if (t.includes('dinheiro') || t.includes('reembolso') || t === '1') return { resposta: this.gerarMensagemFinanceiro() };
        if (t.includes('atraso') || t === '2') return { resposta: this.gerarMensagemAtraso() };
        if (t.includes('cancelar') || t === '3') return { resposta: this.gerarMensagemCancelamento() };
        return { resposta: "Entendi. Aqui vai uma mensagem educada para acalmar o cliente:<br><br><i>\"Olá, [Nome]! Tudo bem? Entendo a sua situação. Vou verificar e te retorno ainda hoje.\"</i>" };
      }

      // 3. INTENÇÃO: Calculadora
      if (t.includes('calcula') || t.includes('lucro') || t.includes('margem')) {
        return { resposta: this.calcularLucro(texto) };
      }

      // 4. INTENÇÃO: Bom dia
      if (t.includes('bom dia') || t.includes('resumo') || t.includes('o que temos hoje') || t.includes('pendencia')) {
        return { isBomDia: true };
      }

      // 5. INTENÇÃO: Relatório
      if (t.includes('explica') || t.includes('relatorio') || t.includes('mes') || t.includes('vendas')) {
        return { isRelatorio: true };
      }

      // 6. INTENÇÃO: Disponibilidade
      if (t.includes('livre') || t.includes('disponivel') || t.includes('ocupado')) {
        return { resposta: this.verificarDisponibilidade(texto) };
      }

      // 7. INTENÇÃO: Tutorial / Ajuda
      if (t.includes('tutorial') || t.includes('refazer') || t.includes('o que voce faz') || t.includes('ajuda')) {
        if (t.includes('refazer') || t.includes('tutorial')) return { isTutorial: true };
        return { resposta: "Eu sou a Lalá! 🌸 Posso:<br><br>☀️ <b>Bom dia:</b> Ver a agenda de hoje.<br>📅 <b>Agendar:</b> 'Agende com Maria 25/10 15:00'.<br>💬 <b>Mensagens:</b> Te ajudo a responder clientes.<br>🧮 <b>Lucro:</b> 'Calcula lucro de 1500 com custo 400'.<br>📊 <b>Relatório:</b> 'Explica o mês'.<br>🎓 <b>Tutorial:</b> 'Refazer tutorial'." };
      }

      if (t.includes('oi') || t.includes('ola') || t.includes('tudo bem')) {
        return { resposta: 'Oi! 🌸 Sou a Lalá. Precisa de ajuda com mensagens, agendamentos ou relatórios? Digite <b>"O que você faz?"</b>.' };
      }

      return null;
    },

    prepararAgendamento: function(textoOriginal) {
      let texto = textoOriginal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let dataStr = "", mes = "", dia = "";
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
      const regexHora = /(\d{1,2})(?::(\d{2})|h(\d{2})?| horas?)/;
      const matchHora = texto.match(regexHora);
      if (matchHora) hora = matchHora[1].padStart(2, '0') + ":" + (matchHora[2] || matchHora[3] || "00");

      let cliente = "";
      const regexNome = /(?:com|para)\s+(?:a\s+|o\s+)?([a-zA-ZÀ-ÿ\s]+?)(?:\s+(?:dia|no|as|às|\d|$))/i;
      const matchNome = textoOriginal.match(regexNome);
      if (matchNome) { cliente = matchNome[1].trim(); cliente = cliente.replace(/(reuniao|reunião|agendar|marcar)/gi, "").trim(); }

      if (!dia || !hora) return { resposta: "Entendi que você quer agendar! 😊 Mas faltou a data e a hora.<br><br>Pode me dizer assim: <b>'Agende com Maria 25/10 às 15:00'</b>" };
      if (!cliente) cliente = "Cliente (nome não informado)";

      const ano = matchBarra && matchBarra[3] ? matchBarra[3] : new Date().getFullYear();
      const dataFormatada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      this.agendamentoPendente = { cliente, dataStr: `${dia}/${mes}`, hora, dataFinal: `${dataFormatada}T${hora}` };
      
      return { resposta: `📅 <b>Confirmação:</b><br><br>👤 <b>${cliente}</b><br>📆 <b>${dia}/${mes}</b><br>⏰ <b>${hora}</b><br><br>Posso salvar? (Digite <b>Sim</b> ou <b>Não</b>)` };
    },

    gerarMensagemFinanceiro: function() { return `<i>"Olá, [Nome]! Tudo bem? Entendo. Sobre o valor, infelizmente não consigo fazer a devolução no momento, pois o valor já foi destinado aos custos. Mas posso verificar se é possível usar como crédito para uma próxima festa."</i>`; },
    gerarMensagemAtraso: function() { return `<i>"Olá, [Nome]! Passando para saber se as peças já estão prontas para devolução. Precisamos organizar o estoque. Lembrando que a diária de atraso se aplica."</i>`; },
    gerarMensagemCancelamento: function() { return `<i>"Oi, [Nome]! Que pena saber que a festa não vai mais acontecer. Conforme o contrato, o sinal é retido, mas posso verificar com a direção a possibilidade de uma carta de crédito futura."</i>`; },
    cancelarAgendamento: function() { this.agendamentoPendente = null; return "Tudo bem, cancelei o agendamento. 🚫"; },

    confirmarAgendamento: function() {
      if (!this.agendamentoPendente) return "Não tem nada pendente.";
      const agendamento = this.agendamentoPendente; this.agendamentoPendente = null;
      if (!window.db) return "Erro: Sem conexão com o banco.";
      return window.db.ref('reunioes').push({ cliente: agendamento.cliente, dataHora: agendamento.dataFinal, pauta: "Agendada pela Lalá", criadoEm: Date.now() })
        .then(() => `✅ Prontinho! Reunião com <b>${agendamento.cliente}</b> salva.`)
        .catch(() => "Erro ao salvar. 😥");
    },

    calcularLucro: function(texto) {
      const numeros = texto.match(/\d+([.,]\d+)?/g);
      if (!numeros || numeros.length < 2) return "Preciso do valor e do custo. Exemplo: <b>'Calcula lucro de 1500 com custo 400'</b>";
      let v1 = parseFloat(numeros[0].replace(',', '.')), v2 = parseFloat(numeros[1].replace(',', '.'));
      let valorFesta = Math.max(v1, v2), custo = Math.min(v1, v2);
      let lucro = valorFesta - custo, margem = (lucro / valorFesta) * 100;
      return `🧮 <b>Calculadora de Lucro</b><br><br>💰 Festa: R$ ${valorFesta.toFixed(2)}<br>💸 Custo: R$ ${custo.toFixed(2)}<br>📈 Lucro: <b style="color:#27ae60;">R$ ${lucro.toFixed(2)}</b><br>🎯 Margem: <b>${margem.toFixed(1)}%</b>`;
    },

    verificarDisponibilidade: function(texto) {
      const dataMatch = texto.match(/(\d{1,2})[\/\-](\d{1,2})/);
      if (!dataMatch) return "Me diga a data. Exemplo: <b>'O tema Safári está livre dia 25/10?'</b>";
      let dia = dataMatch[1].padStart(2, '0'); let mes = dataMatch[2].padStart(2, '0');
      const dataFormatada = `${new Date().getFullYear()}-${mes}-${dia}`;
      if (!window.State || !window.State.reservas) return "Puxa, não consigo acessar a lista de reservas agora. 😥";
      const conflitos = window.State.reservas.filter(r => r.data === dataFormatada);
      if (conflitos.length === 0) return `✅ Está <b>LIVRE</b>! Não achei reserva no dia ${dia}/${mes}. 🎉`;
      return `🚨 Opa! Já tem festa nesse dia para: <b>${conflitos.map(c => c.cliente).join(', ')}</b>.`;
    },

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

    // =======================================================
    // CONTROLE DA ANIMAÇÃO (GRID 4x2)
    // =======================================================
    iniciarAnimacao: function() {
      this.pararAnimacao();
      
      const sprite = document.getElementById('lala-sprite');
      if (!sprite) return;

      // Posições X (Colunas 1 a 4) e Y (Linhas 1 e 2)
      const posicoesX = ['0%', '33.33%', '66.66%', '100%'];
      const posicoesY = ['0%', '100%'];

      let frame = 0; 

      this.animacaoInterval = setInterval(() => {
        let linha = Math.floor(frame / 4); // 0 para cima, 1 para baixo
        let coluna = frame % 4;            // 0, 1, 2, 3

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
      else if (this.tutorialPasso === 4) { txt.innerHTML = "Quer saber as vendas ou calcular o lucro? <b>'Calcula o lucro de 1500 com custo de 400'</b>."; this.destacarElemento("btn-abrir-central-relatorios"); }
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
