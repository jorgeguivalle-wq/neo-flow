
/* TRALALÁ PRO — PUBLICAR CATÁLOGO PÚBLICO */
(() => {
  'use strict';

  const state = () => window.State || {};

  const imageSafe = v =>
    typeof v === 'string' &&
    /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(v) &&
    v.length < 180000
      ? v
      : '';

  const text = (s, max) =>
    String(s || '').trim().slice(0, max);

  const price = v => {
    if (v === null || v === undefined || v === '') {
      return null;
    }

    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  let publishing = false;

  async function publicarVitrine() {
    if (publishing) return;

    const s = state();

    if (!s.db || !s.usuarioUID) {
      return alert('Entre como administrador autorizado.');
    }

    if (!confirm(
      'Publicar os itens selecionados no catálogo público? ' +
      'Confira nomes, preços e fotografias antes de continuar.'
    )) {
      return;
    }

    publishing = true;

    try {
      const root = s.db;

      const [
        selectedSnap,
        trainingSnap,
        stockSnap,
        kitsSnap
      ] = await Promise.all([
        root.ref(
          'lalaAtendente/administracao/' +
          s.usuarioUID +
          '/rascunhoVitrine'
        ).once('value'),

        root.ref(
          'lalaAtendente/administracao/' +
          s.usuarioUID +
          '/publicado'
        ).once('value'),

        root.ref('estoque').once('value'),
        root.ref('kits').once('value')
      ]);

      const ids = new Set(
        selectedSnap.val()?.ids || []
      );

      const training = trainingSnap.val() || {};
      const stock = stockSnap.val() || {};
      const kits = kitsSnap.val() || {};

      const itens = {};
      let omitted = 0;

      for (const [id, p] of Object.entries(stock)) {
        if (!ids.has(id) || !p || !text(p.nome, 130)) {
          continue;
        }

        const pPrice = price(p.preco);

        const entry = {
          nome: text(p.nome, 130),
          categoria: text(p.categoria, 60) ||
            'Temas e peças'
        };

        if (pPrice !== null) {
          entry.preco = pPrice;
        }

        const img = imageSafe(p.imagem);

        if (img) {
          entry.imagem = img;
        }

        itens[id] = entry;
      }

      const publishedKits = {};

      const allowed = new Set(
        training.kitsLiberados || []
      );

      for (const [id, k] of Object.entries(kits)) {
        const p = price(
          training.kitsPrecos?.[id]
        );

        if (!allowed.has(id) ||
            p === null ||
            !k ||
            !text(k.nome, 130)) {
          omitted++;
          continue;
        }

        const entry = {
          nome: text(k.nome, 130),
          categoria: 'Kits',
          preco: p
        };

        const img = imageSafe(k.imagem);

        if (img) {
          entry.imagem = img;
        }

        publishedKits[id] = entry;
      }

      if (!Object.keys(itens).length &&
          !Object.keys(publishedKits).length) {
        throw Error(
          'Nenhum item foi selecionado e nenhum kit ' +
          'autorizado tem preço válido.'
        );
      }

      await root.ref('vitrineCatalogo').set({
        itens,
        kits: publishedKits,
        publicadoEm:
          firebase.database.ServerValue.TIMESTAMP
      });

      alert(
        'Catálogo público atualizado!\n' +
        Object.keys(itens).length + ' itens e ' +
        Object.keys(publishedKits).length + ' kits.\n' +
        omitted + ' kits não foram publicados ' +
        '(não autorizados ou sem preço).'
      );

    } catch (e) {
      console.error(e);
      alert('Falha ao publicar: ' + e.message);
    } finally {
      publishing = false;
    }
  }

  function init() {
    const area = document.getElementById(
      'tp-vitrine-conteudo'
    );

    if (!area) return;

    const observer = new MutationObserver(() => {
      if (!area.querySelector('input[type=search]') ||
          document.getElementById(
            'tp-publicar-vitrine-real'
          )) {
        return;
      }

      const b = document.createElement('button');

      b.id = 'tp-publicar-vitrine-real';
      b.type = 'button';
      b.className = 'btn btn-primary';

      b.textContent =
        '🌐 Publicar catálogo na vitrine pública';

      b.addEventListener(
        'click',
        publicarVitrine
      );

      area.append(b);
    });

    observer.observe(area, {
      childList: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init
    );
  } else {
    init();
  }
})();
