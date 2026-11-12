
/* Tralala Pro - Integracoes administrativas da Lala (sem acesso publico) */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const S = () => window.State || {};
  const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
  const number = v => Number(v);
  const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
  const node = (tag, value, css) => { const e=document.createElement(tag); if(value!==undefined) e.textContent=value; if(css)e.className=css; return e; };
  const btn = (label, handler, cls='btn btn-primary') => { const e=node('button',label,cls); e.type='button'; e.addEventListener('click',handler); return e; };
  const input = (type, placeholder='') => {const e=node('input');e.type=type;e.placeholder=placeholder;return e;};
  const notice = msg => node('p',msg,'tp-publicacao-info');
  const authorized = () => !!(S().db && S().usuarioUID);
  const own = () => { if(!authorized())throw Error('Entre no sistema para continuar.');return S().db.ref('lalaAtendente/administracao/'+S().usuarioUID); };
  const queue = () => { if(!authorized())throw Error('Entre no sistema para continuar.');return S().db.ref('atendimentosLala'); };
  async function config() { const snap=await own().once('value');return snap.val()||{}; }

  function quoteItems(kit, stock) {
    const names = [...(Array.isArray(kit.pecas)?kit.pecas:[]),...(Array.isArray(kit.temas)?kit.temas:[])];
    const required = new Map();
    for(const name of names){
      const key=norm(name);if(!key)continue;
      const raw = kit.pecasQtd && kit.pecasQtd[name];
      const qty = raw === undefined ? 1 : number(raw);
      required.set(key,{name,qty:(required.get(key)?.qty||0)+qty});
    }
    return [...required.entries()].map(([key,rec])=>{
      const matches=stock.filter(p=>norm(p.nome)===key);
      const found=matches.length===1?matches[0]:null;
      const current=found ? number(found.quantidade) : NaN;
      const validQty=Number.isInteger(rec.qty)&&rec.qty>0;
      const validStock=found && found.quantidade!=='' && found.quantidade!=null && Number.isInteger(current)&&current>=0;
      let status='REVISAR';
      if(matches.length>1)status='NOME DUPLICADO';
      else if(!matches.length)status='NÃO CADASTRADO';
      else if(!validQty||!validStock)status='DADOS INVÁLIDOS';
      else if(current<rec.qty)status='SALDO ATUAL INSUFICIENTE';
      return {name:rec.name,needed:rec.qty,current:validStock?current:null,status};
    });
  }

  async function checkKit(id,date) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00'))) throw Error('Informe uma data válida.');
    if(!authorized())throw Error('Faça login antes de consultar.');
    const [kitSnap, stockSnap, reservationsSnap, cfg] = await Promise.all([
      S().db.ref('kits/'+id).once('value'),
      S().db.ref('estoque').once('value'),
      S().db.ref('reservas').once('value'),
      config()
    ]);
    const kit=kitSnap.val();if(!kit)throw Error('Kit não encontrado no Firebase.');
    const stock=Object.values(stockSnap.val()||{}).filter(x=>x&&typeof x==='object');
    const reservations=Object.values(reservationsSnap.val()||{}).filter(x=>x&&typeof x==='object');
    const lines=quoteItems(kit,stock);
    const reservationsOnDay=reservations.filter(r=>r.data===date);
    const keys=new Set(lines.map(x=>norm(x.name)));
    const possible=reservationsOnDay.filter(r=>
      (Array.isArray(r.pecas)&&r.pecas.some(n=>keys.has(norm(n)))) ||
      keys.has(norm(r.tema))
    );
    const published=cfg.publicado||{};
    const price=published.kitsPrecos?.[id];
    const permitted=Array.isArray(published.kitsLiberados)&&published.kitsLiberados.includes(id);
    const priceValid=price!==''&&price!==undefined&&Number.isFinite(number(price))&&number(price)>0;

    return {
      kit:kit.nome||'Kit',
      date,
      lines,
      possible:possible.length,
      price:priceValid?number(price):null,
      permitted,
      limitations:'Consulta informativa. O saldo físico pode já refletir reservas antigas; não subtraímos reservas novamente. Não há bloqueio atômico, nem datas de retirada/devolução verificadas. Aprovação humana obrigatória.'
    };
  }

  function heading(parent,text){
    parent.append(node('h4',text));
  }

  function renderReport(parent,r){
    parent.replaceChildren();
    heading(parent,r.kit+' — '+r.date);
    parent.append(notice(
      `Preço comercial: ${r.price==null?'NÃO CADASTRADO':money(r.price)}. Liberação: ${r.permitted?'sim':'não'}.`
    ));
    if(!r.lines.length)parent.append(notice('Kit sem componentes cadastrados.'));

    for(const line of r.lines){
      const row=node('div',undefined,'tp-lala-kit-item');
      row.append(
        node('strong',line.name),
        node('small',`Necessário: ${line.needed} | Saldo cadastrado: ${line.current??'indefinido'}`),
        node('small',line.status)
      );
      parent.append(row);
    }

    parent.append(notice(
      `Reservas na data envolvendo componentes/tema do kit: ${r.possible}. Isso NÃO confirma indisponibilidade nem disponibilidade.`
    ));
    parent.append(notice('🚨 '+r.limitations));
  }

  function addKitChecker(){
    const editor=$('tp-lala-editor-conteudo');
    if(!editor || editor.querySelector('#tp-conferir-kit-real'))return;

    const box=node('section',undefined,'tp-publicacao-info');
    box.id='tp-conferir-kit-real';

    heading(box,'🔎 Conferência real do kit (somente consulta)');
    box.append(notice(
      'Lê kits, estoque e reservas diretamente do Firebase. A confirmação continua com a equipe.'
    ));

    const kitSel=node('select');
    kitSel.append(new Option('Escolha um kit',''));

    (S().kits||[]).forEach(k=>{
      if(k.id)kitSel.append(new Option(k.nome||'Kit sem nome',k.id));
    });

    const date=input('date');
    const result=node('div');

    const run=btn('🔎 Conferir cadastro',async()=>{
      if(!kitSel.value||!date.value){
        alert('Escolha kit e data.');
        return;
      }

      run.disabled=true;
      result.replaceChildren(notice('Conferindo...'));

      try{
        renderReport(result,await checkKit(kitSel.value,date.value));
      }catch(e){
        result.replaceChildren(notice('Erro: '+e.message));
      }finally{
        run.disabled=false;
      }
    });

    box.append(
      node('label','Kit cadastrado'),
      kitSel,
      node('label','Data da festa'),
      date,
      run,
      result
    );
    editor.append(box);
  }

  // Fila interna compartilhada entre usuários autorizados.
  // Não expõe clientes ao público.
  async function renderQueue(){
    const area=$('tp-lala-fila-atendimento');
    if(!area)return;

    area.replaceChildren();

    if(!authorized()){
      area.append(notice('Faça login.'));
      return;
    }

    heading(area,'🚨 Fila de Atendimento Humano');

    area.append(notice(
      'Transferências serão inseridas pela equipe ou por uma futura integração segura com a vitrine. A Lalá não pode continuar o atendimento automaticamente após a transferência.'
    ));

    const name=input('text','Nome ou apelido do cliente');
    const reason=input('text','Motivo da transferência');
    const whatsapp=input('text','WhatsApp (opcional)');

    const save=btn('➕ Registrar atendimento humano',async()=>{
      if(!name.value.trim()||!reason.value.trim()){
        alert('Informe cliente e motivo.');
        return;
      }

      save.disabled=true;

      try{
        const record={
          nome:name.value.trim().slice(0,120),
          motivo:reason.value.trim().slice(0,600),
          whatsapp:whatsapp.value.trim().slice(0,40),
          status:'pendente',
          criadoPor:S().usuarioUID,
          criadoEm:firebase.database.ServerValue.TIMESTAMP,
          atualizadoEm:firebase.database.ServerValue.TIMESTAMP
        };

        await queue().push().set(record);
        name.value='';
        reason.value='';
        whatsapp.value='';
        await drawList();
      }catch(e){
        alert('Falha ao registrar: '+e.message);
      }finally{
        save.disabled=false;
      }
    });

    area.append(name,reason,whatsapp,save);

    const list=node('div');
    list.id='tp-fila-real';
    area.append(list);

    async function drawList(){
      list.replaceChildren(notice('Carregando fila...'));

      try{
        const snap=await queue()
          .orderByChild('criadoEm')
          .limitToLast(100)
          .once('value');

        const rows=Object.entries(snap.val()||{}).reverse();
        list.replaceChildren();

        if(!rows.length){
          list.append(notice('Nenhum atendimento na fila.'));
          return;
        }

        for(const [id,rec] of rows){
          const card=node(
            'article',
            undefined,
            'tp-lala-atendimento-card '+
            (rec.status==='pendente'
              ?'pendente'
              :rec.status==='em-atendimento'
                ?'em-atendimento'
                :'finalizado')
          );

          card.append(
            node('h4',(rec.nome||'Cliente')+' — '+(rec.status||'pendente')),
            node('p',rec.motivo||'Sem motivo')
          );

          if(rec.whatsapp){
            card.append(node('p','Contato informado: '+rec.whatsapp));
          }

          const actions=node('div',undefined,'tp-lala-atendimento-acoes');

          if(rec.status==='pendente'){
            actions.append(
              btn('🙋 Assumir',()=>change(id,'pendente','em-atendimento'))
            );
          }

          if(rec.status==='em-atendimento'){
            actions.append(
              btn('✅ Finalizar',()=>change(id,'em-atendimento','finalizado'))
            );
          }

          card.append(actions);
          list.append(card);
        }
      }catch(e){
        list.replaceChildren(notice(
          'Falha ao ler fila: '+e.message+
          ' Verifique as regras do Firebase.'
        ));
      }
    }

    async function change(id,from,to){
      try{
        const ref=queue().child(id);
        const user=S().usuarioUID;

        const result=await ref.transaction(old=>{
          if(!old||old.status!==from)return;

          return {
            ...old,
            status:to,
            responsavelUid:to==='em-atendimento'
              ?user:(old.responsavelUid||user),
            atualizadoEm:firebase.database.ServerValue.TIMESTAMP
          };
        });

        if(!result.committed){
          alert('Este atendimento já foi assumido ou alterado.');
        }

        await drawList();
      }catch(e){
        alert('Erro ao alterar atendimento: '+e.message);
      }
    }

    await drawList();
  }

  async function renderCatalogAdmin(){
    const area=$('tp-vitrine-conteudo');
    if(!area)return;

    area.replaceChildren();
    heading(area,'🎨 Selecionar itens da vitrine');

    area.append(notice(
      'Esta seleção salva um RASCUNHO privado. Não disponibiliza informações internas na internet.'
    ));

    if(!authorized()){
      area.append(notice('Faça login.'));
      return;
    }

    const cfg=await config();
    const current=new Set(cfg.rascunhoVitrine?.ids||[]);
    const stock=(S().estoqueArray||[]).filter(x=>x&&x.idFirebase);

    const search=input('search','Pesquisar tema/peça...');
    const list=node('div');
    list.style.maxHeight='380px';
    list.style.overflowY='auto';

    const selections=new Set(current);

    function draw(){
      list.replaceChildren();

      for(const p of stock
        .filter(x=>norm(x.nome).includes(norm(search.value)))
        .slice(0,150)
      ){
        const row=node('label',undefined,'tp-vitrine-produto');
        const check=input('checkbox');
        check.checked=selections.has(p.idFirebase);

        check.addEventListener('change',()=>{
          if(check.checked) selections.add(p.idFirebase);
          else selections.delete(p.idFirebase);
        });

        row.append(check,node('span',p.nome||'Sem nome'));
        list.append(row);
      }
    }

    search.addEventListener('input',draw);
    draw();

    const save=btn('💾 Salvar seleção da vitrine',async()=>{
      save.disabled=true;

      try{
        await own().child('rascunhoVitrine').set({
          ids:[...selections],
          atualizadoEm:firebase.database.ServerValue.TIMESTAMP
        });

        alert('Seleção salva apenas para a equipe.');
      }catch(e){
        alert('Erro: '+e.message);
      }finally{
        save.disabled=false;
      }
    });

    area.append(search,list,save);
  }

  // Complementa os painéis já criados.
  function init(){
    document.querySelectorAll('[data-lala-tela="atendimentos"]')
      .forEach(b=>b.addEventListener(
        'click',
        ()=>setTimeout(renderQueue,0)
      ));

    document.querySelectorAll('[data-vitrine="catalogo"]')
      .forEach(b=>b.addEventListener(
        'click',
        ()=>setTimeout(()=>{
          renderCatalogAdmin().catch(e=>console.error(e));
        },0)
      ));

    document.querySelectorAll('[data-treino="kits"]')
      .forEach(b=>b.addEventListener(
        'click',
        ()=>setTimeout(addKitChecker,0)
      ));

    window.TralalaLalaIntegracoes=Object.freeze({
      conferirKit:checkKit,
      abrirFila:renderQueue
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  }else{
    init();
  }
})();
