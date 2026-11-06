/* =====================================================================
   SORTEBETS · Interface (script.js)
   A tela só mostra o que o motor (js/motor.js) decidiu.
   ===================================================================== */
"use strict";
const M = window.Motor, C = M.CONFIG, META = C.meta;
const $ = (id) => document.getElementById(id);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const reduzMov = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const pct = (x, casas = 0) => (x * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) + "%";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const svgSim = (s) => `<svg viewBox="0 0 100 100" role="img" aria-label="${M.NOMES[s]}"><use href="#s-${s}"/></svg>`;
const sorteioUI = M.criarRNG(); // só para falas e enfeites; nunca decide resultado
const falar = (lista) => (Array.isArray(lista) ? sorteioUI.escolher(lista) : lista);

let st, cadastrado = false;
function novo(tetoMaximo) {
  const rng = M.criarRNG();
  st = { pts: 0, memoria: M.novoEstado(rng, tetoMaximo), fichas: C.fichasIniciais, rodadas: 0, preso: 0, near: 0, gasto: 0,
    hist: [0], log: [], girando: false, rng };
}

/* ---------------------------------------------------------------
   Letreiro "A máquina diz": a voz da máquina, sem personagem
   (Manual de Marca: o dado é estático, sem rosto e sem animação)
   --------------------------------------------------------------- */
// Tom do letreiro conforme o giro: ponto, quase, derrota, fim
function reagir(tom) { const l = document.querySelector(".letreiro"); if (l) l.dataset.tom = tom || ""; }
function balao(txt) {
  const b = $("balao"); b.textContent = txt;
  b.classList.remove("pop"); b.offsetWidth; b.classList.add("pop");
}
const FALAS = {
  pontoIsca: ["Isso! Você leva jeito!", "Tá vendo? É fácil!", "Olha você subindo!", "Mais um! A máquina tá generosa!"],
  chegou4: "Falta UM! Não vai parar agora, né?",
  quaseTrava: ["Passou raspando! O próximo vem!", "Foi por um fio! Tá esquentando!", "Quase! Ela tá quase pagando!", "Ahh! Mais um giro e sai!"],
  quaseIsca: ["Uh, quase!", "Por pouco!"],
  derrotaTrava: ["Calma, a sorte vira.", "Só mais um giro.", "Já já sai, confia!", "Você já investiu tanto... continua!"],
  derrotaIsca: ["Gira de novo!", "Faz parte!", "Próximo!"],
  suspense: "Vai... vai... VAI!",
  fim: "Acabou? Num site de verdade, agora aparecia o botão de depósito.",
};

/* ---------------------------------------------------------------
   Som: música e efeitos ficam em js/som.js
   --------------------------------------------------------------- */
const S = window.Som;
const podeTocarMusica = () => cadastrado && st.fichas >= C.custo && document.body.dataset.aba === "jogar" && !document.hidden;
function musicaConformeTela() { if (podeTocarMusica()) S.tocarMusica(); else S.pararMusica(); }

/* ---------------------------------------------------------------
   Rolos: cada rolo mostra 3 posições reais da fita (acima, linha, abaixo)
   --------------------------------------------------------------- */
const pos = [0, 1, 2].map((r) => sorteioUI.inteiro(M.N));
const itens = (r, ini, qtd) => Array.from({ length: qtd }, (_, i) => `<div>${svgSim(M.simbolo(r, ini + i))}</div>`).join("");
const altCel = () => $("r0").parentElement.clientHeight / 3;
function mostrarParado(r) {
  const s = $("r" + r);
  s.style.transition = "none"; s.style.transform = "translateY(0)";
  s.innerHTML = itens(r, pos[r] - 1, 3);
}
// Gira "para baixo" e para exatamente na parada escolhida pelo motor
function girarRolo(r, alvo, voltas, ms) {
  const s = $("r" + r), h = altCel();
  const m = voltas * M.N + ((((pos[r] - alvo) % M.N) + M.N) % M.N);
  s.style.transition = "none";
  s.innerHTML = itens(r, alvo - 1, m + 3);
  s.style.transform = `translateY(${-m * h}px)`;
  s.offsetHeight;
  s.style.transition = `transform ${ms}ms cubic-bezier(.18,.82,.3,1.04)`;
  s.style.transform = "translateY(0)";
  return esperar(ms).then(() => { pos[r] = alvo; mostrarParado(r); S.parada(r); });
}

function setMsg(t, c) { $("msg").textContent = t; $("msg").className = "msg " + (c || ""); }

/* ---------------------------------------------------------------
   Giro
   --------------------------------------------------------------- */
async function girar() {
  if (!cadastrado || st.girando) return;
  if (st.fichas < C.custo) { if ($("fim").hidden) fimDeJogo(); return; } // não repete o "uá uá" a cada Espaço
  st.girando = true;
  st.fichas -= C.custo; st.gasto += C.custo; st.rodadas++;
  if (st.pts >= st.memoria.teto) st.preso++;
  atualizar();

  // 1) O motor decide TUDO aqui, antes da animação.
  const d = M.decidir(st.rng, st.memoria);
  const travado = d.fase === "TRAVA";

  // 2) Espetáculo.
  S.iniciar(); S.tocarMusica(); S.moeda();
  setMsg("Girando...");
  $("reels").classList.remove("trio"); $("maquina").classList.remove("ganhou");
  const l = M.linha(d.paradas);
  const doisIguais = l[0] !== M.VAZIO && l[0] === l[1];
  const rapido = reduzMov();
  const ms = rapido ? [150, 150, 150] : [1050, 1450, doisIguais ? 3300 : 1850];
  const promessas = d.paradas.map((p, r) => girarRolo(r, p, 2 + r, ms[r]));
  S.giro(doisIguais ? ms[1] : ms[2]);
  if (doisIguais && !rapido) {
    promessas[1].then(() => { $("r2").parentElement.classList.add("suspense"); balao(FALAS.suspense); S.suspense(ms[2] - ms[1]); });
  }
  await Promise.all(promessas);
  $("r2").parentElement.classList.remove("suspense");

  // 3) Aplicar o que já estava decidido.
  st.memoria = M.aplicar(st.memoria, d);
  st.pts = st.memoria.pontos;
  if (d.tipo === "ponto") {
    $("reels").classList.add("trio"); $("maquina").classList.add("ganhou");
    S.abaixar(2200); S.ponto(st.pts === META - 1); S.intensidade(st.pts === META - 1);
    setMsg(st.pts === META - 1 ? "+1 ponto! FALTA SÓ 1 PRA VENCER!" : `+1 ponto! Faltam ${META - st.pts}.`, "win");
    balao(st.pts === META - 1 ? FALAS.chegou4 : falar(FALAS.pontoIsca));
    reagir("ponto");
  } else if (d.tipo === "quase") {
    st.near++; S.quase(travado);
    setMsg(!travado ? "Quase! Faltou um símbolo." : st.pts === META - 1 ? "NÃÃÃO! Passou raspando! Falta só 1!" : "NÃÃÃO! Passou raspando!", "near");
    balao(falar(travado ? FALAS.quaseTrava : FALAS.quaseIsca)); reagir("quase");
  } else {
    S.derrota(); setMsg("Não foi dessa vez.", "lose"); balao(falar(travado ? FALAS.derrotaTrava : FALAS.derrotaIsca));
    reagir("derrota");
  }
  st.hist.push(st.pts);
  st.log.push({ n: st.rodadas, fase: d.fase, tipo: d.tipo, regra: d.regra, chance: d.chanceUsada, linha: l, pts: st.pts });
  st.girando = false;
  atualizar(); registrar();
  if (st.fichas < C.custo) fimDeJogo();
}

function fimDeJogo() {
  setMsg("Acabaram suas fichas. Fim de jogo.", "bad");
  balao(FALAS.fim); reagir("fim");
  S.intensidade(false); S.pararMusica(); S.fim();
  const ptsTxt = st.pts === 1 ? "1 ponto" : `${st.pts} pontos`;
  const t = st.memoria.teto, tetoTxt = t === 1 ? "1 ponto" : `${t} pontos`;
  $("fimTxt").textContent = `Você girou ${st.rodadas} vezes, chegou a ${ptsTxt}, passou ${st.preso} rodadas na trava e viu ${st.near} vezes o "faltou só um". A máquina tinha decidido no seu cadastro que você pararia em ${tetoTxt}.`;
  $("quem").textContent = `Resultados de ${st.nome}. Sem você saber, a máquina sorteou no cadastro o seu teto: ${tetoTxt}.`;
  $("fim").hidden = false;
  atualizar();
}

/* ---------------------------------------------------------------
   Atualizar tela
   --------------------------------------------------------------- */
function atualizar() {
  $("fichas").textContent = st.fichas; $("saldo").textContent = st.fichas; $("rodadas").textContent = st.rodadas;
  $("ptsTxt").textContent = `${st.pts} / ${META} pontos`;
  $("pips").innerHTML = Array.from({ length: META }, (_, i) => {
    const c = i < st.pts ? "on" : i === META - 1 ? "last" + (st.pts === META - 1 ? " pulse" : "") : "";
    return `<div class="pip ${c}">${i + 1}</div>`;
  }).join("");
  const semFichas = st.fichas < C.custo;
  $("girar").disabled = st.girando || semFichas;
  $("girar").textContent = semFichas && !st.girando ? "SEM FICHAS" : "GIRAR";
  $("sRod").textContent = st.rodadas; $("sPreso").textContent = st.preso; $("sNear").textContent = st.near;
  $("sGasto").textContent = st.gasto;
  if (!$("p-algo").hidden) { desenhar(); mostrarLog(); }
}

/* ---------------------------------------------------------------
   Aba Algoritmo
   --------------------------------------------------------------- */
const COR = { preto: "#171411", vermelho: "#B83832", creme: "#F3E8D2", cremeCl: "#FDF8EE", ocre: "#C69A43", suave: "#5A4F42", linha: "#17141126" };
const FONTE = '12px "DejaVu Sans Mono", Consolas, monospace';
function prepararCanvas(c) {
  const dpr = devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
  c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
  return [g, w, h];
}
function desenhar() {
  const [g, w, h] = prepararCanvas($("grafico"));
  const L = 30, R = 14, T = 16, B = 24, H = st.hist, n = Math.max(H.length - 1, 1);
  const x = (i) => L + ((w - L - R) * i) / n, y = (v) => h - B - ((h - T - B) * v) / META;
  // faixa da trava (do teto do jogador até a meta)
  // O teto só aparece quando o jogador já está nele ou o jogo acabou (antes disso, seria spoiler)
  const revelado = cadastrado && (st.pts >= st.memoria.teto || st.fichas < C.custo);
  const teto = revelado ? st.memoria.teto : META - 1;
  g.fillStyle = "#B8383214"; g.fillRect(L, y(META), w - L - R, y(teto) - y(META));
  g.font = FONTE; g.lineWidth = 1;
  for (let v = 0; v <= META; v++) {
    g.strokeStyle = COR.linha; g.beginPath(); g.moveTo(L, y(v)); g.lineTo(w - R, y(v)); g.stroke();
    g.fillStyle = COR.suave; g.fillText(v, 10, y(v) + 4);
  }
  g.fillStyle = COR.suave; g.fillText("giros →", w - R - 56, h - 6);
  g.strokeStyle = COR.vermelho; g.setLineDash([7, 5]); g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(L, y(META)); g.lineTo(w - R, y(META)); g.stroke(); g.setLineDash([]);
  g.fillStyle = COR.vermelho; g.font = '900 12px Lato, Arial'; g.fillText("meta", w - R - 36, y(META) - 6);
  g.fillText("zona da trava", L + 6, y(teto) - 6);
  g.beginPath(); H.forEach((v, i) => (i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v))));
  g.strokeStyle = COR.preto; g.lineWidth = 3; g.lineJoin = "round"; g.stroke();
  st.log.forEach((e) => {
    const cx = x(e.n), cy = y(e.pts);
    if (e.tipo === "quase") { g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fillStyle = COR.ocre; g.fill(); g.lineWidth = 2; g.strokeStyle = COR.preto; g.stroke(); }
  });
  g.beginPath(); g.arc(x(H.length - 1), y(H.at(-1)), 5, 0, 7); g.fillStyle = COR.preto; g.fill();
}
function mostrarLog() {
  const vazio = !st.log.length;
  $("logWrap").hidden = vazio; $("logVazio").hidden = !vazio;
  $("semente").textContent = st.rng ? "0x" + st.rng.semente.toString(16).toUpperCase().padStart(8, "0") : "—";
  $("logLista").innerHTML = st.log.slice().reverse().map((e) => `<tr class="${e.tipo}">
    <td>${e.n}</td><td><span class="fase ${e.fase}">${e.fase}</span></td>
    <td><span class="mini">${e.linha.map(svgSim).join("")}</span></td>
    <td>${esc(e.regra)}</td><td>${pct(e.chance)}</td></tr>`).join("");
}
function montarExplicacao() {
  const pa = M.chanceTrioQualquer();
  $("pAcaso").textContent = pct(pa, 2);
  $("pIsca").textContent = pct(C.chanceIsca[0]);
  $("pIscaTxt").textContent = `Cerca de ${Math.round(C.chanceIsca[0] / pa)} vezes o acaso. É a isca.`;
  // Pesos do rolo 3 (rolo virtual)
  const R = M.ROLOS[2], soma = {};
  R.fitas.forEach((s, i) => (soma[s] = (soma[s] || 0) + R.pesos[i]));
  let colado = 0; R.fitas.forEach((s, i) => { if (s === M.VAZIO && (M.simbolo(2, i - 1) === "dado" || M.simbolo(2, i + 1) === "dado")) colado += R.pesos[i]; });
  const linhas = M.SIMBOLOS.map((s) => [svgSim(s), soma[s], M.NOMES[s]]);
  linhas.push([svgSim("vazio"), colado, "Vazios colados no dado"]);
  $("pesos").innerHTML = `<small><b>Rolo 3:</b> casas de cada símbolo, em 64</small>` + linhas.map(([ic, p, nome]) =>
    `<div class="peso" title="${nome}">${ic}<span class="barra"><i style="width:${(p / 13) * 100}%"></i></span><b>${p}/64</b></div>`).join("");
  const tetos = [4, 3, 2, 1];
  $("cfg").innerHTML = [
    [`Teto sorteado no cadastro: ${tetos.join(", ")} pontos`, tetos.map((t) => C.pesosTeto[t] + "%").join(" · ")],
    ["Chance de ponto com 0, 1, 2 e 3 pontos", C.chanceIsca.map((x) => pct(x)).join(" · ")],
    [`Ponto garantido depois de ${C.secaMaxima} giros sem ponto (abaixo do teto)`, "100%"],
    ["Chance de passar do teto", pct(C.chanceTrava)],
    ['"Faltou só um" no teto (do que sobra)', pct(C.chanceQuaseTravado)],
    ['"Quase" abaixo do teto (do que sobra)', pct(C.chanceQuaseIsca)],
    ["Fichas iniciais / custo do giro", `${C.fichasIniciais} / ${C.custo}`],
  ].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("");
}

/* Simulação de Monte Carlo em partes, para não travar a tela */
let mcDados = null;
async function rodarMC() {
  const n = +$("mcN").value, btn = $("mcRodar"), semente = M.novaSemente();
  btn.disabled = true;
  const res = {};
  for (const modo of ["diretor", "acaso"]) {
    const rng = M.criarRNG(semente), dist = new Array(META + 1).fill(0);
    let venc = 0, chegou4 = 0, preso = 0, soma = 0;
    for (let i = 0; i < n; i++) {
      const p = M.jogarPartida(rng, modo);
      dist[p.max]++; if (p.venceu) venc++; if (p.max >= META - 1) chegou4++; preso += p.preso; soma += p.max;
      if (i % 2000 === 1999) { btn.textContent = `Jogando... ${Math.round(((i + 1) / n) * 50 + (modo === "acaso" ? 50 : 0))}%`; await esperar(0); }
    }
    res[modo] = { dist, venc, chegou4, preso: preso / n, media: soma / n };
  }
  btn.textContent = "Rodar de novo"; btn.disabled = false;
  mcDados = { n, ...res };
  $("mcRes").hidden = false;
  desenharMC();
  const f = (x) => x.toLocaleString("pt-BR"), d = res.diretor, a = res.acaso;
  $("mcNum").innerHTML = `
    <div class="destaque"><small>SorteBets: venceram</small><b>${f(d.venc)} de ${f(n)}</b>Só ${pct(d.chegou4 / n)} chegaram a 4. Em média, ~${d.preso.toFixed(1).replace(".", ",")} giros na trava</div>
    <div><small>Acaso puro: venceram</small><b>${f(a.venc)} de ${f(n)}</b>${pct(a.dist[0] / n)} terminaram com 0 pontos</div>
    <div><small>Pontos médios</small><b>${d.media.toFixed(2).replace(".", ",")} × ${a.media.toFixed(2).replace(".", ",")}</b>A diferença é a isca: pontos que o acaso não daria.</div>`;
}
function desenharMC() {
  if (!mcDados) return;
  const [g, w, h] = prepararCanvas($("mcGraf"));
  const L = 36, R = 10, T = 38, B = 30, n = mcDados.n, grupos = META + 1;
  const gw = (w - L - R) / grupos, bw = Math.min(gw * 0.36, 46);
  const y = (p) => h - B - (h - T - B) * p;
  g.font = FONTE;
  [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
    g.strokeStyle = COR.linha; g.lineWidth = 1; g.beginPath(); g.moveTo(L, y(p)); g.lineTo(w - R, y(p)); g.stroke();
    g.fillStyle = COR.suave; g.fillText(p * 100 + "%", 0, y(p) + 4);
  });
  const hach = document.createElement("canvas"); hach.width = hach.height = 8;
  const hg = hach.getContext("2d"); hg.fillStyle = COR.creme; hg.fillRect(0, 0, 8, 8);
  hg.strokeStyle = COR.preto; hg.lineWidth = 1.5; hg.beginPath(); hg.moveTo(0, 8); hg.lineTo(8, 0); hg.stroke();
  const padrao = g.createPattern(hach, "repeat");
  for (let k = 0; k < grupos; k++) {
    const cx = L + gw * k + gw / 2;
    [["diretor", COR.vermelho, -1], ["acaso", padrao, 1]].forEach(([m, cor, lado]) => {
      const p = mcDados[m].dist[k] / n, bx = cx + (lado < 0 ? -bw - 2 : 2);
      g.fillStyle = cor; g.fillRect(bx, y(p), bw, y(0) - y(p));
      g.strokeStyle = COR.preto; g.lineWidth = 2; g.strokeRect(bx, y(p), bw, y(0) - y(p));
      if (p >= 0.005) { g.fillStyle = COR.preto; g.textAlign = "center"; g.fillText(pct(p), bx + bw / 2, y(p) - 6); g.textAlign = "left"; }
    });
    g.fillStyle = k === META ? COR.vermelho : COR.preto; g.textAlign = "center";
    g.font = '900 13px Lato, Arial';
    g.fillText(k === META ? (gw >= 80 ? "5 (venceu)" : "5 pts") : `${k} pts`, cx, h - 10); /* celular: rótulo curto */ g.textAlign = "left"; g.font = FONTE;
  }
  g.fillStyle = COR.suave; g.fillText("pontos máximos de cada jogador", L, 12);
}

/* ---------------------------------------------------------------
   Placar da turma
   - No site publicado: placar ONLINE (api/placar.js + banco Redis),
     o mesmo em todos os celulares e computadores da turma.
   - Aberto direto do arquivo, ou sem internet: só neste navegador.
   A turma vem do link: sortibet777.vercel.app/?turma=3a
   --------------------------------------------------------------- */
const CHAVE = "sortibet-placar";
const TURMA = (new URLSearchParams(location.search).get("turma") || "geral").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20) || "geral";
const API = "api/placar?turma=" + encodeURIComponent(TURMA);
const PODE_ONLINE = location.protocol === "https:" || location.protocol === "http:";
let online = false;            // o banco respondeu da última vez?
let placar = carregar();
let placarOnline = [];
function carregar() { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch { return []; } }
function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(placar)); } catch { /* modo privado */ } }
const novoId = () => Date.now().toString(36) + "-" + sorteioUI.u32().toString(36);

// Envio em fila: só o estado mais recente do jogador vai para o banco, em ordem
let aEnviar = null, enviando = false;
async function enviar(j) {
  aEnviar = j;
  if (enviando || !PODE_ONLINE) return;
  enviando = true;
  while (aEnviar) {
    const corpo = JSON.stringify(aEnviar); aEnviar = null;
    try {
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo, keepalive: true }); // termina mesmo se a aba fechar
      online = r.ok;
      // O professor tirou este aluno do placar: para de mandar os giros dele
      if (r.ok && (await r.json()).removido && st.id === JSON.parse(corpo).id) { st.removido = true; aEnviar = null; }
    } catch { online = false; }
  }
  enviando = false;
  buscarPlacar();
}
// Aluno fechou a aba com um resultado ainda na fila: manda assim mesmo
addEventListener("pagehide", () => {
  if (aEnviar && PODE_ONLINE && navigator.sendBeacon) { navigator.sendBeacon(API, JSON.stringify(aEnviar)); aEnviar = null; }
});
async function buscarPlacar() {
  if (!PODE_ONLINE) return mostrarPlacar();
  try {
    const r = await fetch(API, { cache: "no-store" });
    if (!r.ok) throw 0;
    placarOnline = (await r.json()).jogadores || []; online = true;
  } catch { online = false; }
  mostrarPlacar();
}
function registrar() {
  if (!st.id) return;
  placar = carregar();
  const j = { id: st.id, nome: st.nome, max: Math.max(...st.hist), rodadas: st.rodadas, preso: st.preso, near: st.near, gasto: st.gasto };
  const i = placar.findIndex((p) => p.id === st.id);
  if (i < 0) placar.push(j); else placar[i] = j;
  salvar(); if (!st.removido) enviar(j); mostrarPlacar();
}
// Lista exibida: a do banco (com o jogador deste aparelho sempre atualizado) ou a local
function listaAtual() {
  if (!online) return placar;
  const l = placarOnline.filter((p) => !st || p.id !== st.id);
  const eu = st && st.id && !st.removido && placar.find((p) => p.id === st.id);
  return eu ? [...l, eu] : l;
}
function mostrarPlacar() {
  const todos = listaAtual();
  const lista = [...todos].sort((a, b) => b.max - a.max || b.preso - a.preso || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  $("nJog").textContent = todos.length;
  $("nVenc").textContent = todos.filter((p) => p.max >= META).length;
  $("tabela").hidden = !todos.length; $("vazio").hidden = todos.length > 0;
  $("limpar").disabled = !todos.length;
  $("lista").innerHTML = lista.map((p, i) => `<tr class="${st && p.id === st.id ? "atual" : ""}">
    <td>${i + 1}</td><td class="nm">${esc(p.nome)}</td>
    <td><span class="pmax${p.max === META - 1 ? " quase" : ""}">${p.max}</span><small>/${META}</small></td>
    <td>${p.rodadas}</td><td>${p.preso}</td><td>${p.near}</td><td>${p.gasto}</td>
    <td class="rm"><button class="rm-btn" type="button" data-id="${esc(p.id)}" aria-label="Remover ${esc(p.nome)}" title="Remover do placar">✕</button></td></tr>`).join("");
  $("turmaNome").textContent = TURMA === "geral" ? "" : ` · Turma ${TURMA.toUpperCase()}`;
  $("placarStatus").textContent = online
    ? "Placar online: aparece em todos os celulares e computadores que abrirem este link. Atualiza sozinho."
    : PODE_ONLINE ? "Sem conexão com o placar online. Mostrando só os jogos deste aparelho; tentando de novo..."
    : "O placar fica salvo só neste navegador (o jogo foi aberto direto do arquivo).";
}
// O mesmo quadro de confirmação serve para limpar tudo ou remover um jogador (alvo)
let alvo = null;
const SENHA_SESSAO = "sortibet-senha";
function pedirConfirmacao(texto) {
  $("confirmaTxt").textContent = texto;
  $("simLimpar").textContent = alvo ? "Sim, remover" : "Sim, limpar placar";
  $("senhaCampo").hidden = !online;
  try { $("senha").value = sessionStorage.getItem(SENHA_SESSAO) || ""; } catch { $("senha").value = ""; }
  $("senhaErro").hidden = true;
  $("confirma").hidden = false; $("limpar").hidden = true; (online && !$("senha").value ? $("senha") : $("naoLimpar")).focus();
}
function fecharConfirma() { $("confirma").hidden = true; $("limpar").hidden = false; $("senhaErro").hidden = true; alvo = null; }
$("lista").addEventListener("click", (e) => {
  const b = e.target.closest(".rm-btn"); if (!b) return;
  alvo = listaAtual().find((p) => String(p.id) === b.dataset.id); if (!alvo) return;
  pedirConfirmacao(`Remover ${alvo.nome} do placar${online ? " online? Some em todos os aparelhos." : "?"}`);
});
$("limpar").onclick = () => {
  alvo = null;
  const n = listaAtual().length;
  $("confirmaTxt").textContent = online
    ? `Apagar os ${n} jogadores do placar online${TURMA === "geral" ? "" : " da turma " + TURMA.toUpperCase()}? Some em todos os aparelhos.`
    : `Apagar os ${n} jogadores do placar? Isso não pode ser desfeito.`;
  pedirConfirmacao($("confirmaTxt").textContent);
};
$("naoLimpar").onclick = () => { fecharConfirma(); $("limpar").focus(); };
$("simLimpar").onclick = async () => {
  if (online) {
    $("simLimpar").disabled = true;
    try {
      const r = await fetch(API, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senha: $("senha").value, id: alvo ? alvo.id : undefined }) });
      if (!r.ok) { $("senhaErro").textContent = (await r.json().catch(() => ({}))).erro || "Não deu para apagar."; $("senhaErro").hidden = false; return; }
      try { sessionStorage.setItem(SENHA_SESSAO, $("senha").value); } catch { /* modo privado */ } // não pede de novo nesta aba
      placarOnline = alvo ? placarOnline.filter((p) => p.id !== alvo.id) : [];
    } catch { $("senhaErro").textContent = "Sem conexão. Tente de novo."; $("senhaErro").hidden = false; return; }
    finally { $("simLimpar").disabled = false; }
  }
  placar = alvo ? placar.filter((p) => p.id !== alvo.id) : []; salvar(); fecharConfirma(); mostrarPlacar();
};
addEventListener("storage", (e) => { if (e.key === CHAVE || e.key === null) { placar = carregar(); mostrarPlacar(); } });
// Enquanto a aba Placar estiver aberta na tela, busca o placar da turma a cada 4 segundos
setInterval(() => { if (PODE_ONLINE && document.body.dataset.aba === "placar" && !document.hidden) buscarPlacar(); }, 4000);

/* ---------------------------------------------------------------
   Abas (Jogar só abre depois do cadastro)
   --------------------------------------------------------------- */
const ABAS = ["cadastro", "jogar", "algo", "placar"];
function abrir(aba) {
  if (aba === "jogar" && !cadastrado) { $("alerta").hidden = false; aba = "cadastro"; $("nome").focus(); }
  ABAS.forEach((a) => { $("t-" + a).setAttribute("aria-selected", a === aba); $("p-" + a).hidden = a !== aba; });
  document.body.dataset.aba = aba;
  scrollTo({ top: 0 });
  if (aba === "jogar" && !st.girando) [0, 1, 2].forEach(mostrarParado); // não interrompe um giro em andamento
  if (aba === "algo") { desenhar(); mostrarLog(); desenharMC(); }
  if (aba === "placar") { fecharConfirma(); mostrarPlacar(); buscarPlacar(); }
  musicaConformeTela();
}
ABAS.forEach((a) => ($("t-" + a).onclick = () => abrir(a)));
// Setas do teclado entre as abas
document.querySelector(".tabs").addEventListener("keydown", (e) => {
  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const vis = ABAS.filter((a) => !$("t-" + a).hidden), i = vis.indexOf(e.target.id.slice(2));
  const prox = vis[(i + (e.key === "ArrowRight" ? 1 : vis.length - 1)) % vis.length];
  $("t-" + prox).focus(); abrir(prox);
});

/* ---------------------------------------------------------------
   Cadastro: só o nome, que fica nesta página e no placar local
   --------------------------------------------------------------- */
let cadastrando = false;
$("cadastro").onsubmit = async (e) => {
  e.preventDefault();
  if (cadastrando) return;
  const nome = $("nome").value.trim();
  $("nome").setAttribute("aria-invalid", !nome);
  if (!nome) { $("nome").focus(); return; }
  S.iniciar(); // o navegador só libera o áudio depois de um toque/clique
  const primeiro = nome.split(/\s+/)[0];
  // Quando o placar da turma (online, ou deste navegador se estiver offline) já tem
  // o máximo de jogadores no 4, o teto novo para em 3
  const jaNo4 = listaAtual().filter((p) => p.max >= META - 1).length;
  novo(jaNo4 >= C.maxNo4 ? META - 2 : META - 1); st.id = novoId(); st.nome = nome;
  // Sorteou teto 4? Online, quem decide a vaga é o servidor, de uma vez só para a turma
  // inteira (dois cadastros no mesmo segundo não ganham a mesma vaga)
  if (st.memoria.teto === META - 1 && PODE_ONLINE) {
    cadastrando = true; $("cadastro").querySelector("button").disabled = true;
    try {
      const r = await fetch(API + "&vaga4=1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: st.id, nome }) });
      if (r.ok && !(await r.json()).vaga4) st.memoria = { ...st.memoria, teto: META - 2 };
    } catch { /* sem conexão: vale a regra deste aparelho */ }
    cadastrando = false; $("cadastro").querySelector("button").disabled = false;
  }
  cadastrado = true;
  $("jogador").textContent = primeiro; $("jogador").title = nome; $("conta").hidden = false;
  $("t-jogar").classList.remove("locked");
  $("t-cadastro").hidden = true; $("alerta").hidden = true;
  $("quem").textContent = `Resultados de ${nome}.`; // o teto só é revelado no fim do jogo
  setMsg(`Bem-vindo, ${primeiro}! Junte 5 pontos.`);
  balao(`E aí, ${primeiro}! Cinco pontos e a máquina é sua.`);
  atualizar(); registrar(); abrir("jogar"); $("girar").focus();
};

$("girar").onclick = girar;
$("verAlgo").onclick = () => abrir("algo");
$("mcRodar").onclick = rodarMC;
$("som").onclick = () => {
  S.iniciar(); S.efeitos = !S.efeitos;
  $("som").setAttribute("aria-pressed", S.efeitos);
  $("som").title = S.efeitos ? "Desligar os efeitos" : "Ligar os efeitos";
};
$("musica").onclick = () => {
  S.iniciar(); S.musica = !S.musica;
  $("musica").setAttribute("aria-pressed", S.musica);
  $("musica").title = S.musica ? "Desligar a música" : "Ligar a música";
  musicaConformeTela();
};
document.addEventListener("visibilitychange", musicaConformeTela);
// Próximo jogador no mesmo aparelho: volta ao cadastro, o anterior fica no placar
$("novoJogador").onclick = () => {
  novo(); st.rng = null; cadastrado = false; S.intensidade(false); reagir();
  $("nome").value = ""; $("nome").removeAttribute("aria-invalid");
  $("conta").hidden = true; $("t-cadastro").hidden = false; $("t-jogar").classList.add("locked");
  $("fim").hidden = true; $("reels").classList.remove("trio"); $("maquina").classList.remove("ganhou");
  $("quem").textContent = "Ninguém jogou ainda. Faça o cadastro e jogue para ver seus números aqui.";
  setMsg("Gire e junte 5 pontos!"); balao("Bora! O primeiro giro é o mais gostoso.");
  atualizar(); mostrarPlacar(); abrir("cadastro"); $("nome").focus();
};
addEventListener("keydown", (e) => {
  if (e.code !== "Space" || document.body.dataset.aba !== "jogar") return;
  if (e.target.closest("button,input,select,textarea,summary")) return; // o botão já trata o espaço
  e.preventDefault(); girar();
});
let tRes;
addEventListener("resize", () => {
  clearTimeout(tRes);
  tRes = setTimeout(() => {
    if (!$("p-algo").hidden) { desenhar(); desenharMC(); }
    if (!$("p-jogar").hidden && !st.girando) [0, 1, 2].forEach(mostrarParado);
  }, 120);
});

// Início
novo(); st.rng = null; mostrarPlacar(); buscarPlacar(); montarExplicacao();
[0, 1, 2].forEach(mostrarParado);
atualizar();
