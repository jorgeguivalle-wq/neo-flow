// ============================================================
// MÓDULO DE CAMPANHAS E CLIENTES
// ============================================================

window.iniciarClientesCampanhas = function() {
  if (!window.State || !window.State.reservas) return;
  
  const container = document.getElementById("lista-clientes-campanhas-container");
  if (!container) return;

  // Pega as reservas que já estão no app.js
  const reservas = window.State.reservas;
  
  if (reservas.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:#999;'>Nenhuma reserva encontrada no sistema.</p>";
    return;
  }

  const clientesUnicos = {};

  reservas.forEach(r => {
    if (!r.cliente) return;
    // Cria uma chave única baseada no nome para evitar duplicados
    const key = r.cliente.toLowerCase().trim();
    if (!clientesUnicos[key]) {
      clientesUnicos[key] = { nome: r.cliente, festas: [] };
    }
    clientesUnicos[key].festas.push(r);
  });

  let html = "";
  const clientesArray = Object.values(clientesUnicos).sort((a, b) => a.nome.localeCompare(b.nome));

  clientesArray.forEach(c => {
    // Ordena as festas da mais recente para a mais antiga
    c.festas.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
    const ultimaFesta = c.festas[0];
    
    let dataFormatada = "Data não informada";
    let mesUltimaFesta = -1;
    
    if (ultimaFesta.data) {
      const partes = ultimaFesta.data.split('-');
      if (partes.length === 3) {
        dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
        mesUltimaFesta = parseInt(partes[1]) - 1; // 0 a 11
      }
    }
    
    // Lógica simples de filtro por mês (pode ser expandida depois)
    const filtroMes = document.getElementById("filtro-mes-festa-anterior").value;
    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    
    if (filtroMes && mesUltimaFesta !== -1 && meses[mesUltimaFesta] !== filtroMes) return;

    // Cria o link do WhatsApp (assumindo que o telefone esteja salvo na reserva)
    let btnWhats = "";
    if (ultimaFesta.telefone) {
      const numLimpo = ultimaFesta.telefone.replace(/\D/g,'');
      if (numLimpo.length >= 10) {
        const msg = encodeURIComponent(`Olá ${c.nome}, tudo bem? Aqui é da Tralalá Festas! Já faz um tempinho desde a festa de ${ultimaFesta.tema}, e estamos com novidades...`);
        btnWhats = `<a href="https://wa.me/55${numLimpo}?text=${msg}" target="_blank" style="padding:6px 10px; background:#25D366; color:#fff; border-radius:4px; font-size:12px; text-decoration:none; display:inline-block; margin-top:8px; font-weight:bold;">📱 Enviar Mensagem</a>`;
      }
    }

    html += `
      <div class="card-cliente-campanha" style="border-left-color: #3498db; margin-bottom: 12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:15px; color:var(--text-main);">👤 ${c.nome}</strong>
          <span class="badge-contador" style="background:#3498db;">${c.festas.length} festa(s)</span>
        </div>
        <p style="margin:5px 0; font-size:13px;">Última festa: <b>${dataFormatada}</b></p>
        <p style="margin:5px 0; font-size:13px;">🎨 Tema: <b>${ultimaFesta.tema || 'Não informado'}</b></p>
        <p style="margin:5px 0; font-size:13px;">💰 Valor: <b>R$ ${parseFloat(ultimaFesta.total || 0).toFixed(2).replace('.', ',')}</b></p>
        ${btnWhats}
      </div>
    `;
  });

  container.innerHTML = html || "<p style='text-align:center; color:#999;'>Nenhum cliente encontrado para este filtro.</p>";
};
