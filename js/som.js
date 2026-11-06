/* =====================================================================
   SORTEBETS · Sons (som.js)
   Tudo sintetizado na hora com Web Audio: nenhum arquivo de áudio.
   Estilo: big band / ragtime dos anos 1930, com chiado de disco antigo.

   Os sons também fazem parte do truque:
   - a máquina faz FESTA no ponto e até no "quase";
   - fica quase em SILÊNCIO quando você perde;
   - a música ACELERA quando você chega no 4.
   ===================================================================== */
(function (raiz) {
  "use strict";

  let ctx = null, mestre, busEfeitos, busMusica, chiado = null;
  let efeitosLigados = true, musicaLigada = true, tocandoMusica = false;
  const VOL_MUSICA = 0.5;
  let intensidade = 0; // 0 normal · 1 preso no 4 (mais rápido e mais cheio)

  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const agora = () => ctx.currentTime;

  // ---------- Cadeia de saída: "rádio antigo" (graves e agudos cortados)
  function iniciar() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    const AC = raiz.AudioContext || raiz.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const passaAlta = ctx.createBiquadFilter(); passaAlta.type = "highpass"; passaAlta.frequency.value = 85;
    const passaBaixa = ctx.createBiquadFilter(); passaBaixa.type = "lowpass"; passaBaixa.frequency.value = 5200;
    const presenca = ctx.createBiquadFilter(); presenca.type = "peaking"; presenca.frequency.value = 1600; presenca.gain.value = 4;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    mestre = ctx.createGain(); mestre.gain.value = 0.9;
    busEfeitos = ctx.createGain(); busEfeitos.gain.value = 1;
    busMusica = ctx.createGain(); busMusica.gain.value = VOL_MUSICA;
    busEfeitos.connect(mestre); busMusica.connect(mestre);
    mestre.connect(passaAlta).connect(passaBaixa).connect(presenca).connect(comp).connect(ctx.destination);
    return true;
  }

  // ---------- Peças básicas
  function env(g, t, ataque, pico, dur, fim = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + ataque);
    g.gain.exponentialRampToValueAtTime(fim, t + dur);
  }
  function osc(tipo, f, t, dur, destino, detune = 0) {
    const o = ctx.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    o.connect(destino); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  let ruidoBuf = null;
  function ruido() {
    if (!ruidoBuf) {
      ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = ruidoBuf; s.loop = true; return s;
  }

  // ---------- Instrumentos
  // Piano de cabaré: duas cordas levemente desafinadas (honky-tonk)
  function piano(midi, t, dur = 0.35, vol = 0.12, bus = busEfeitos) {
    const g = ctx.createGain(); env(g, t, 0.005, vol, dur); g.connect(bus);
    const f = hz(midi);
    osc("triangle", f, t, dur, g, -7); osc("triangle", f, t, dur, g, +7);
    const g2 = ctx.createGain(); env(g2, t, 0.003, vol * 0.35, dur * 0.5); g2.connect(bus);
    osc("square", f * 2, t, dur * 0.5, g2);
  }
  // Metais (trompete / trombone): serrote com filtro que abre ("uá") e vibrato
  function metal(midi, t, dur = 0.3, vol = 0.1, { bus = busEfeitos, desliza = 0, vibrato = 0 } = {}) {
    const f = hz(midi);
    const filtro = ctx.createBiquadFilter(); filtro.type = "lowpass"; filtro.Q.value = 4;
    filtro.frequency.setValueAtTime(f * 1.2, t);
    filtro.frequency.exponentialRampToValueAtTime(f * 6, t + 0.05);
    filtro.frequency.exponentialRampToValueAtTime(f * 2.2, t + dur);
    const g = ctx.createGain(); env(g, t, 0.025, vol, dur); filtro.connect(g).connect(bus);
    [-6, 6].forEach((d) => {
      const o = osc("sawtooth", f, t, dur, filtro, d);
      if (desliza) o.frequency.exponentialRampToValueAtTime(f * Math.pow(2, desliza / 12), t + dur);
      if (vibrato) {
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = vibrato;
        lfo.connect(lg).connect(o.detune); lfo.start(t + dur * 0.3); lfo.stop(t + dur + 0.05);
      }
    });
  }
  // Tuba: grave curto e redondo
  function tuba(midi, t, dur = 0.22, vol = 0.16, bus = busMusica) {
    const g = ctx.createGain(); env(g, t, 0.02, vol, dur); g.connect(bus);
    osc("triangle", hz(midi), t, dur, g);
    const g2 = ctx.createGain(); env(g2, t, 0.01, vol * 0.3, dur * 0.6); g2.connect(bus); osc("sawtooth", hz(midi) * 2, t, dur * 0.6, g2);
  }
  function caixa(t, vol = 0.08, dur = 0.12, bus = busEfeitos) {
    const n = ruido(), f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = 0.8;
    const g = ctx.createGain(); env(g, t, 0.002, vol, dur); n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + dur + 0.02);
  }
  function chimbal(t, vol = 0.03, bus = busMusica) {
    const n = ruido(), f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000;
    const g = ctx.createGain(); env(g, t, 0.001, vol, 0.05); n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + 0.08);
  }
  function prato(t, vol = 0.07) {
    const n = ruido(), f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 5000;
    const g = ctx.createGain(); env(g, t, 0.002, vol, 1.2); n.connect(f).connect(g).connect(busEfeitos); n.start(t); n.stop(t + 1.3);
  }
  function bloco(t, f = 1100, vol = 0.09, bus = busEfeitos) { // bloco de madeira: o "tique" dos rolos
    const g = ctx.createGain(); env(g, t, 0.001, vol, 0.045); g.connect(bus);
    osc("sine", f, t, 0.05, g); osc("square", f * 2.6, t, 0.02, g);
  }
  function bumbo(t, vol = 0.18, bus = busMusica) {
    const g = ctx.createGain(); env(g, t, 0.002, vol, 0.18); g.connect(bus);
    const o = osc("sine", 120, t, 0.2, g); o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
  }
  function plim(t, f, vol = 0.06) { // moedinha
    const g = ctx.createGain(); env(g, t, 0.002, vol, 0.4); g.connect(busEfeitos);
    osc("sine", f, t, 0.4, g); osc("sine", f * 2.76, t, 0.15, g);
  }
  function apito(t, de, ate, dur, vol = 0.07) { // apito de êmbolo (slide whistle)
    const g = ctx.createGain(); env(g, t, 0.03, vol, dur); g.connect(busEfeitos);
    const o = osc("sine", de, t, dur, g); o.frequency.exponentialRampToValueAtTime(ate, t + dur);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 7; lg.gain.value = 18;
    lfo.connect(lg).connect(o.detune); lfo.start(t); lfo.stop(t + dur);
  }

  // ---------- Efeitos do jogo
  const pronto = () => ctx && efeitosLigados;
  const E = {
    moeda() { // ficha entrando + alavanca
      if (!pronto()) return; const t = agora();
      plim(t, hz(91)); plim(t + 0.07, hz(96), 0.05);
      caixa(t + 0.16, 0.05, 0.06); bloco(t + 0.2, 300, 0.08);
    },
    giro(ms) { // tique-taque dos rolos, desacelerando até parar
      if (!pronto()) return; const t0 = agora(), fim = t0 + ms / 1000;
      let t = t0 + 0.12, i = 0;
      while (t < fim - 0.05) {
        const p = (t - t0) / (fim - t0);
        bloco(t, i % 2 ? 1250 : 1050, 0.045 * (1 - p * 0.6));
        t += 0.055 + p * p * 0.16; i++;
      }
    },
    parada(r) { // cada rolo que para sobe uma nota: dó, mi, sol
      if (!pronto()) return; const t = agora();
      bloco(t, 420, 0.1); piano([72, 76, 79][r], t, 0.25, 0.09);
    },
    suspense(ms) { // rufar de tambor crescendo + apito subindo
      if (!pronto()) return; const t0 = agora(), d = ms / 1000;
      for (let t = 0; t < d - 0.05; t += 0.045) caixa(t0 + t, 0.015 + 0.06 * (t / d), 0.05);
      apito(t0, 380, 1300, d * 0.95, 0.035);
    },
    ponto(chegou4) { // fanfarra de ragtime + chuva de moedas
      if (!pronto()) return; const t = agora() + 0.02, s = 0.09;
      const lick = chegou4 ? [67, 72, 76, 79, 76, 79, 84] : [67, 72, 76, 79];
      lick.forEach((m, i) => metal(m, t + i * s, s * 0.9, 0.08));
      const tf = t + lick.length * s;
      [72, 76, 79, 84].forEach((m) => metal(m, tf, chegou4 ? 1.1 : 0.7, 0.05, { vibrato: 12 }));
      piano(60, tf, 0.6, 0.12); piano(48, tf, 0.6, 0.12);
      prato(tf, chegou4 ? 0.09 : 0.06);
      const n = chegou4 ? 22 : 12;
      for (let i = 0; i < n; i++) plim(tf + 0.05 + i * 0.045 + Math.random() * 0.03, hz(88 + Math.floor(Math.random() * 10)), 0.035);
    },
    quase(travado) { // "ôôôh!": apito caindo e metais escorregando
      if (!pronto()) return; const t = agora();
      apito(t, 1300, 420, 0.6, 0.06);
      metal(travado ? 70 : 67, t + 0.05, 0.55, 0.07, { desliza: -5 });
      if (travado) { caixa(t + 0.62, 0.06, 0.08); prato(t + 0.62, 0.04); }
    },
    derrota() { // quase nada: perder não pode chamar atenção
      if (!pronto()) return; const t = agora();
      bloco(t, 600, 0.025); bloco(t + 0.09, 500, 0.02);
    },
    fim() { // "uá uá uá uááá" + a música para
      if (!pronto()) return; const t = agora() + 0.1;
      [58, 57, 56].forEach((m, i) => metal(m - 12, t + i * 0.42, 0.38, 0.1));
      metal(55 - 12, t + 1.26, 1.4, 0.1, { vibrato: 30, desliza: -1 });
    },
  };

  // ---------- Música de fundo: ragtime original em dó (8 compassos)
  // Acordes: C C A7 A7 D7 G7 C G7 · baixo "um-pá" (tuba no 1 e 3, piano no 2 e 4)
  const ACORDES = [
    { b: 48, q: 55, c: [60, 64, 67] }, { b: 48, q: 43, c: [60, 64, 67] },
    { b: 45, q: 52, c: [61, 64, 67] }, { b: 45, q: 40, c: [61, 64, 67] },
    { b: 50, q: 45, c: [60, 62, 66] }, { b: 43, q: 50, c: [59, 62, 65] },
    { b: 48, q: 43, c: [60, 64, 67] }, { b: 43, q: 50, c: [59, 62, 65] },
  ];
  const _ = null;
  const MELODIA = [
    76, _, 79, 76, 72, _, 74, 76,   79, _, _, 77, 76, 74, 72, _,
    73, 76, _, 73, 76, 79, _, 76,   81, _, 79, _, 76, _, 73, _,
    74, _, 78, 81, _, 78, 74, _,    79, 77, 74, 71, 74, _, 77, _,
    76, 72, 79, 76, 84, _, 79, _,   77, _, 74, _, 71, 74, 77, 79,
  ];
  let passo = 0, proximo = 0, relogio = null;
  function tocarPasso(i, t, colcheia) {
    const comp = ACORDES[Math.floor(i / 8) % 8], k = i % 8;
    if (k === 0) { tuba(comp.b, t, 0.24, 0.2); bumbo(t, 0.12); }
    if (k === 4) { tuba(comp.q, t, 0.24, 0.18); bumbo(t, 0.1); }
    if (k === 2 || k === 6) { comp.c.forEach((m) => piano(m, t, 0.16, 0.05, busMusica)); caixa(t, 0.03, 0.07, busMusica); }
    if (intensidade && k % 2 === 1) chimbal(t, 0.04);
    const m = MELODIA[i % 64];
    if (m) {
      // piano no normal; trompete quando preso no 4
      if (intensidade) metal(m, t, colcheia * 0.85, 0.085, { bus: busMusica });
      else piano(m, t, colcheia * 1.4, 0.085, busMusica);
    }
  }
  function agendar() {
    const bpm = intensidade ? 168 : 138, colcheia = 60 / bpm / 2;
    while (proximo < agora() + 0.15) {
      // swing: colcheias "dançadas" (longa-curta)
      const t = proximo + (passo % 2 ? colcheia * 0.18 : 0);
      tocarPasso(passo, t, colcheia);
      proximo += colcheia; passo = (passo + 1) % 64;
    }
  }
  function ligarChiado() {
    if (chiado) return;
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.015 + (Math.random() < 0.0005 ? (Math.random() * 2 - 1) * 0.7 : 0);
    chiado = ctx.createBufferSource(); chiado.buffer = buf; chiado.loop = true;
    const g = ctx.createGain(); g.gain.value = 0.05; chiado.connect(g).connect(busMusica); chiado.start();
  }
  function desligarChiado() { if (chiado) { chiado.stop(); chiado = null; } }

  const api = {
    iniciar,
    ...E,
    get efeitos() { return efeitosLigados; },
    set efeitos(v) { efeitosLigados = !!v; },
    get musica() { return musicaLigada; },
    set musica(v) { musicaLigada = !!v; if (!v) api.pararMusica(); },
    tocarMusica() {
      if (!musicaLigada || tocandoMusica || !iniciar()) return;
      tocandoMusica = true; proximo = agora() + 0.1;
      busMusica.gain.cancelScheduledValues(agora()); busMusica.gain.setValueAtTime(VOL_MUSICA, agora());
      ligarChiado(); relogio = setInterval(agendar, 25);
    },
    pararMusica() {
      if (!tocandoMusica) return;
      tocandoMusica = false; clearInterval(relogio); desligarChiado();
    },
    intensidade(n) { intensidade = n ? 1 : 0; },
    // abaixa a música enquanto a fanfarra toca
    abaixar(ms = 1400) {
      if (!ctx || !tocandoMusica) return; const t = agora(), g = busMusica.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0.15, t + 0.05); g.linearRampToValueAtTime(VOL_MUSICA, t + ms / 1000);
    },
  };
  raiz.Som = api;
})(globalThis);
