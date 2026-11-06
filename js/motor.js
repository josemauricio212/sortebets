/* =====================================================================
   SORTEBETS · MOTOR DA MÁQUINA (motor.js)
   Simulação educativa: fichas fictícias, nenhum dinheiro real.

   Este arquivo é o "cérebro" do caça-níquel, separado da tela.
   Ele funciona em duas camadas, como nas máquinas reais:

   1) ACASO (gerador de números + rolos virtuais)
      - Gerador pseudoaleatório xoshiro128** com semente registrada.
      - Cada rolo tem 22 posições físicas (11 símbolos e 11 vazios).
      - Cada posição tem um PESO (rolo virtual): o dado aparece no
        desenho do rolo, mas quase nunca é sorteado; os vazios
        colados nele têm peso alto. É assim que o "quase" acontece
        mesmo sem trapaça explícita.

   2) DIRETOR (as regras escondidas do SorteBets)
      No cadastro, o diretor sorteia o TETO de pontos do jogador. Antes de
      qualquer animação, ele olha a partida (pontos, teto, giros sem ganhar)
      e decide o resultado. Depois escolhe paradas REAIS nos rolos que
      mostram exatamente esse resultado. A animação só obedece.

   Funciona no navegador (window.Motor) e no Node (require) para testes.
   ===================================================================== */
(function (raiz) {
  "use strict";

  // ---------- Parâmetros do diretor (é aqui que a "casa" ajusta a máquina)
  const CONFIG = Object.freeze({
    meta: 5,                 // pontos para "vencer a máquina"
    fichasIniciais: 200,     // bônus de cadastro
    custo: 10,               // fichas por giro
    // Teto de pontos sorteado no cadastro, em % dos jogadores. Numa turma de
    // 30, dá 0, 1 ou 2 alunos no 4 em 94% das vezes; o resto fica com 3, 2 ou 1.
    pesosTeto: Object.freeze({ 4: 3, 3: 27, 2: 40, 1: 30 }),
    maxNo4: 2,               // no mesmo navegador: depois de 2 no placar com 4, ninguém mais recebe teto 4
    // Isca que vai "esfriando": com 0, 1, 2 e 3 pontos. Fácil no começo,
    // um pouco mais difícil depois, para parecer que depende de você.
    chanceIsca: Object.freeze([0.5, 0.4, 0.3, 0.25]),
    secaMaxima: 3,           // abaixo do teto: depois de 3 giros sem ponto, o próximo é garantido
    chanceTrava: 0,          // no teto: chance de passar dele
    chanceQuaseTravado: 0.75,// no teto: "faltou só um" fabricado
    chanceQuaseIsca: 0.35,   // abaixo do teto: "quase" para animar
  });

  // ---------- Símbolos
  const SIMBOLOS = ["dado", "sete", "ficha", "sino", "cereja", "copas"];
  const VAZIO = "vazio";
  const NOMES = { dado: "Dado", sete: "Sete", ficha: "Ficha", sino: "Sino", cereja: "Cereja", copas: "Copas", vazio: "Vazio" };

  // ---------- Rolos físicos (22 posições, símbolo e vazio alternados)
  // Pesos = rolo virtual. Soma dos pesos de cada rolo = 64 "posições virtuais".
  // O vazio logo ACIMA e ABAIXO do dado tem peso alto: é o ímã do quase.
  function rolo(ordem, pesosSimb, pesosVazio) {
    const fitas = [], pesos = [];
    ordem.forEach((s, i) => {
      fitas.push(s); pesos.push(pesosSimb[i]);
      fitas.push(VAZIO); pesos.push(pesosVazio[i]);
    });
    return { fitas, pesos, total: pesos.reduce((a, b) => a + b, 0) };
  }
  const ROLOS = [
    rolo(["dado","cereja","sino","ficha","copas","sete","cereja","sino","copas","ficha","cereja"],
         [1,3,3,2,3,2,3,3,3,2,3], [5,3,3,3,3,3,3,3,3,3,4]),
    rolo(["sete","sino","cereja","dado","copas","ficha","sino","cereja","copas","sete","ficha"],
         [2,3,3,1,3,2,3,3,3,2,2], [3,3,6,6,3,3,3,3,3,2,2]),
    rolo(["cereja","ficha","sino","copas","sete","dado","cereja","sino","ficha","copas","cereja"],
         [3,2,3,3,2,1,3,3,2,3,3], [3,3,3,3,6,7,3,2,2,2,2]),
  ];
  const N = ROLOS[0].fitas.length; // 22

  // ---------- Gerador pseudoaleatório: xoshiro128** (Blackman & Vigna)
  // Semente de 128 bits. A mesma semente reproduz exatamente a mesma partida.
  function splitmix32(a) {
    return function () {
      a |= 0; a = (a + 0x9e3779b9) | 0;
      let t = a ^ (a >>> 16); t = Math.imul(t, 0x21f0aaad);
      t ^= t >>> 15; t = Math.imul(t, 0x735a2d97);
      return (t ^ (t >>> 15)) >>> 0;
    };
  }
  function novaSemente() {
    const c = raiz.crypto || (typeof require === "function" ? require("crypto").webcrypto : null);
    if (c && c.getRandomValues) { const u = new Uint32Array(1); c.getRandomValues(u); return u[0]; }
    return (Math.random() * 2 ** 32) >>> 0;
  }
  function criarRNG(semente) {
    if (semente === undefined) semente = novaSemente();
    semente = semente >>> 0;
    const sm = splitmix32(semente);
    let a = sm(), b = sm(), c = sm(), d = sm();
    const rotl = (x, k) => (x << k) | (x >>> (32 - k));
    function u32() {
      const r = Math.imul(rotl(Math.imul(b, 5), 7), 9);
      const t = b << 9;
      c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = rotl(d, 11);
      return r >>> 0;
    }
    return {
      semente,
      u32,
      real: () => u32() / 4294967296,                  // [0, 1)
      inteiro(n) {                                     // [0, n) sem viés (rejeição)
        const lim = 4294967296 - (4294967296 % n);
        let x; do { x = u32(); } while (x >= lim);
        return x % n;
      },
      escolher(lista) { return lista[this.inteiro(lista.length)]; },
      ponderado(pesos, total) {
        let r = this.inteiro(total);
        for (let i = 0; i < pesos.length; i++) { if (r < pesos[i]) return i; r -= pesos[i]; }
        return pesos.length - 1;
      },
    };
  }

  // ---------- Leitura dos rolos
  const mod = (i) => ((i % N) + N) % N;
  const simbolo = (r, pos) => ROLOS[r].fitas[mod(pos)];
  // Janela visível: [acima, linha, abaixo]
  const janela = (r, pos) => [simbolo(r, pos - 1), simbolo(r, pos), simbolo(r, pos + 1)];
  const linha = (paradas) => paradas.map((p, r) => simbolo(r, p));
  const ehTrio = (l) => l[0] !== VAZIO && l[0] === l[1] && l[1] === l[2];
  const posicoesDe = (r, s) => ROLOS[r].fitas.map((x, i) => (x === s ? i : -1)).filter((i) => i >= 0);

  // ---------- Probabilidades exatas do ACASO (sem diretor)
  function chanceSimbolo(r, s) {
    const R = ROLOS[r]; let p = 0;
    R.fitas.forEach((x, i) => { if (x === s) p += R.pesos[i]; });
    return p / R.total;
  }
  function chanceTrio(s) { return [0, 1, 2].reduce((acc, r) => acc * chanceSimbolo(r, s), 1); }
  function chanceTrioQualquer() { return SIMBOLOS.reduce((a, s) => a + chanceTrio(s), 0); }
  // Chance de os dois primeiros rolos alinharem e o 3º parar colado no mesmo símbolo
  function chanceQuaseNatural() {
    let p = 0;
    SIMBOLOS.forEach((s) => {
      let viz = 0; const R = ROLOS[2];
      R.fitas.forEach((x, i) => { if (x !== s && (simbolo(2, i - 1) === s || simbolo(2, i + 1) === s)) viz += R.pesos[i]; });
      p += chanceSimbolo(0, s) * chanceSimbolo(1, s) * (viz / R.total);
    });
    return p;
  }

  // ---------- Sorteios
  function sortearAcaso(rng) { return ROLOS.map((R) => rng.ponderado(R.pesos, R.total)); }
  function paradaCom(rng, r, s) { return rng.escolher(posicoesDe(r, s)); }
  // Parada do 3º rolo em que o símbolo-alvo fica logo ACIMA ou ABAIXO da linha
  function paradaRaspando(rng, s) {
    const ops = [];
    for (let i = 0; i < N; i++) if (simbolo(2, i) !== s && (simbolo(2, i - 1) === s || simbolo(2, i + 1) === s)) ops.push(i);
    return rng.escolher(ops);
  }
  // Derrota "limpa": sem trio e sem os dois primeiros iguais
  function sortearDerrota(rng) {
    let p, l;
    do { p = sortearAcaso(rng); l = linha(p); }
    while (ehTrio(l) || (l[0] !== VAZIO && l[0] === l[1]));
    return p;
  }

  const PREMIO_ISCA = { cereja: 3, sino: 3, copas: 2, ficha: 2, sete: 1, dado: 1 };
  const ALVO_QUASE = { dado: 3, sete: 2, ficha: 1 };
  function escolherPeso(rng, mapa) {
    const k = Object.keys(mapa), w = k.map((x) => mapa[x]);
    return k[rng.ponderado(w, w.reduce((a, b) => a + b, 0))];
  }

  // ---------- Memória do diretor: o que ele sabe da sua partida
  //   pontos · pontos atuais (nunca diminuem)
  //   teto   · até onde o diretor deixa este jogador chegar
  //   seca   · giros seguidos sem ponto (abaixo do teto)
  function sortearTeto(rng, tetoMaximo, cfg = CONFIG) {
    const teto = Number(escolherPeso(rng, cfg.pesosTeto));
    return Math.min(teto, tetoMaximo);
  }
  // Sem rng, não há sorteio: o teto fica em 4 (usado pelo acaso puro e nos testes).
  function novoEstado(rng, tetoMaximo = CONFIG.meta - 1, cfg = CONFIG) {
    return { pontos: 0, seca: 0, teto: rng ? sortearTeto(rng, tetoMaximo, cfg) : tetoMaximo };
  }
  function aplicar(e, d) {
    const pontos = e.pontos + d.delta;
    return { pontos, teto: e.teto, seca: pontos >= e.teto || d.delta > 0 ? 0 : e.seca + 1 };
  }

  // ---------- DIRETOR: decide o giro ANTES da animação
  // Entrada: memória da partida (ou só os pontos). Saída: resultado e justificativa.
  function decidir(rng, estado, cfg = CONFIG) {
    const e = typeof estado === "number" ? { pontos: estado, seca: 0, teto: cfg.meta - 1 } : estado;
    const pontos = e.pontos;
    const travado = pontos >= e.teto;
    const fase = travado ? "TRAVA" : "ISCA";
    const chanceJusta = chanceTrioQualquer();
    // Chance de ponto neste giro, e por quê
    let chance, motivo;
    if (travado) { chance = cfg.chanceTrava; motivo = "Trava desligada pela casa"; }
    else if (e.seca >= cfg.secaMaxima) { chance = 1; motivo = `Seca máxima: ${e.seca} giros sem ponto, este é garantido para você não desistir`; }
    else { chance = cfg.chanceIsca[Math.min(pontos, cfg.chanceIsca.length - 1)];
      motivo = pontos === cfg.meta - 2 ? "Isca: liberar o 4º ponto e deixar o 5º a um passo" : "Isca: liberar ponto para criar confiança"; }
    const base = { fase, chanceJusta, chanceUsada: chance };
    const sorteio = rng.real();

    // 1. Ponto liberado (só fora da trava, ou se a casa mudar chanceTrava)
    if (sorteio < chance) {
      const s = escolherPeso(rng, PREMIO_ISCA);
      const paradas = [0, 1, 2].map((r) => paradaCom(rng, r, s));
      return { ...base, tipo: "ponto", delta: +1, alvo: s, paradas, regra: motivo };
    }
    // 2. Quase fabricado: dois iguais na linha, o terceiro parado colado
    const corte = chance + (1 - chance) * (travado ? cfg.chanceQuaseTravado : cfg.chanceQuaseIsca);
    if (sorteio < corte) {
      const s = escolherPeso(rng, ALVO_QUASE);
      const paradas = [paradaCom(rng, 0, s), paradaCom(rng, 1, s), paradaRaspando(rng, s)];
      return { ...base, tipo: "quase", delta: 0, alvo: s, paradas,
        regra: travado ? "Faltou só um fabricado (rolo 3 em câmera lenta)" : "Quase para animar" };
    }
    // 3. Derrota comum
    return { ...base, tipo: "derrota", delta: 0, paradas: sortearDerrota(rng),
      regra: travado ? `Trava no ${e.teto}: a casa não libera mais pontos para você` : `Derrota comum (${e.seca + 1}º giro sem ponto)` };
  }

  // ---------- ACASO PURO: como seria sem diretor (mesmos rolos virtuais)
  function decidirAcaso(rng) {
    const paradas = sortearAcaso(rng), l = linha(paradas);
    const trio = ehTrio(l);
    let tipo = trio ? "ponto" : "derrota";
    if (!trio && l[0] !== VAZIO && l[0] === l[1]) {
      const [a, , b] = janela(2, paradas[2]);
      if (a === l[0] || b === l[0]) tipo = "quase";
    }
    return { fase: "ACASO", tipo, delta: trio ? 1 : 0, paradas, chanceJusta: chanceTrioQualquer(),
      chanceUsada: chanceTrioQualquer(), regra: "Sorteio puro nos rolos virtuais" };
  }

  // ---------- Partida completa (usada na simulação em massa e nos testes)
  function jogarPartida(rng, modo = "diretor", cfg = CONFIG) {
    const comDiretor = modo === "diretor";
    let e = comDiretor ? novoEstado(rng, cfg.meta - 1, cfg) : novoEstado(), fichas = cfg.fichasIniciais, rodadas = 0, preso = 0, quase = 0;
    while (fichas >= cfg.custo && e.pontos < cfg.meta) {
      fichas -= cfg.custo; rodadas++;
      if (e.pontos >= e.teto) preso++;
      const d = comDiretor ? decidir(rng, e, cfg) : decidirAcaso(rng);
      e = aplicar(e, d);
      if (d.tipo === "quase") quase++;
    }
    return { venceu: e.pontos >= cfg.meta, max: e.pontos, rodadas, preso, quase };
  }

  // ---------- Simulação de Monte Carlo: N jogadores
  function simular(n, modo, semente, cfg = CONFIG) {
    const rng = criarRNG(semente);
    const dist = new Array(cfg.meta + 1).fill(0);
    let venc = 0, chegou4 = 0, presoT = 0, quaseT = 0, rodT = 0;
    for (let i = 0; i < n; i++) {
      const p = jogarPartida(rng, modo, cfg);
      dist[Math.min(p.max, cfg.meta)]++;
      if (p.venceu) venc++;
      if (p.max >= cfg.meta - 1) chegou4++;
      presoT += p.preso; quaseT += p.quase; rodT += p.rodadas;
    }
    return { n, modo, semente: rng.semente, dist, venceram: venc, chegaram4: chegou4,
      mediaPreso: presoT / n, mediaQuase: quaseT / n, mediaRodadas: rodT / n };
  }

  const api = { CONFIG, SIMBOLOS, VAZIO, NOMES, ROLOS, N, criarRNG, novaSemente, simbolo, janela, linha, ehTrio,
    chanceSimbolo, chanceTrio, chanceTrioQualquer, chanceQuaseNatural, novoEstado, aplicar, decidir, decidirAcaso, jogarPartida, simular };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Motor = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
