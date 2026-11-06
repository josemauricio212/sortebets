const M = require(process.argv[2] || require("path").join(__dirname, "../js/motor.js"));
const assert = require("assert");
let ok = 0; const t = (n, f) => { f(); ok++; console.log("ok -", n); };

t("rolos válidos", () => M.ROLOS.forEach(R => { assert.equal(R.fitas.length, 22); assert.equal(R.total, 64); }));
t("RNG reproduzível", () => { const a = M.criarRNG(42), b = M.criarRNG(42); for (let i=0;i<1000;i++) assert.equal(a.u32(), b.u32()); });
t("RNG uniforme (qui-quadrado, 10 classes)", () => {
  const r = M.criarRNG(7), c = new Array(10).fill(0), n = 200000;
  for (let i=0;i<n;i++) c[r.inteiro(10)]++;
  const chi = c.reduce((s,x)=>s+(x-n/10)**2/(n/10),0); assert(chi < 27.9, "chi="+chi); // p=0.001, 9 gl
});
t("ponderado bate com os pesos", () => {
  const r = M.criarRNG(9), R = M.ROLOS[2], c = new Array(22).fill(0), n = 640000;
  for (let i=0;i<n;i++) c[r.ponderado(R.pesos, R.total)]++;
  c.forEach((x,i)=>assert(Math.abs(x/n - R.pesos[i]/64) < 0.003));
});
t("diretor nunca dá o 5º ponto nem tira ponto (100 mil giros em 4)", () => {
  const r = M.criarRNG(1);
  for (let i=0;i<100000;i++){ const d = M.decidir(r, 4); assert.equal(d.delta, 0); assert(!M.ehTrio(M.linha(d.paradas))); }
});
t("trava em qualquer teto: nenhum trio e nenhum ponto perdido", () => {
  const r = M.criarRNG(2);
  [1,2,3,4].forEach(teto => { for (let i=0;i<20000;i++){
    const d = M.decidir(r, { pontos: teto, seca: 0, teto }); assert.equal(d.fase, "TRAVA"); assert.equal(d.delta, 0); assert(!M.ehTrio(M.linha(d.paradas)));
  }});
});
t("paradas mostram o que o diretor decidiu", () => {
  const r = M.criarRNG(3);
  for (let i=0;i<50000;i++){
    const d = M.decidir(r, i%5), l = M.linha(d.paradas);
    if (d.tipo==="ponto") assert(M.ehTrio(l) && l[0]===d.alvo);
    else assert(!M.ehTrio(l));
    if (d.tipo==="quase"){ assert(l[0]===d.alvo && l[1]===d.alvo && l[2]!==d.alvo);
      const j = M.janela(2, d.paradas[2]); assert(j[0]===d.alvo || j[2]===d.alvo); }
    if (d.tipo==="derrota") assert(!(l[0]!=="vazio" && l[0]===l[1]));
  }
});
t("frequências do diretor batem com a CONFIG", () => {
  const r = M.criarRNG(5), n = 200000, C = M.CONFIG; let quase4=0;
  C.chanceIsca.forEach((p, pts) => {
    let isca = 0; for (let i=0;i<n;i++) if (M.decidir(r, pts).tipo==="ponto") isca++;
    assert(Math.abs(isca/n-p)<0.005, pts+": "+isca/n);
  });
  for (let i=0;i<n;i++) if (M.decidir(r,4).tipo==="quase") quase4++;
  assert(Math.abs(quase4/n-C.chanceQuaseTravado)<0.005);
});
t("teto sorteado bate com a CONFIG e respeita o limite", () => {
  const r = M.criarRNG(6), n = 200000, C = M.CONFIG, c = {1:0,2:0,3:0,4:0};
  for (let i=0;i<n;i++) c[M.novoEstado(r).teto]++;
  [1,2,3,4].forEach(t => assert(Math.abs(c[t]/n - C.pesosTeto[t]/100) < 0.005, t+": "+c[t]/n));
  for (let i=0;i<20000;i++) assert(M.novoEstado(r, 3).teto <= 3);
});
t("seca máxima: ponto garantido depois de 3 giros sem ponto", () => {
  const r = M.criarRNG(8);
  for (let i=0;i<20000;i++){ const d = M.decidir(r, { pontos: i%4, seca: M.CONFIG.secaMaxima, teto: 4 }); assert.equal(d.tipo, "ponto"); }
});
t("memória do diretor (aplicar)", () => {
  let e = M.novoEstado();
  e = M.aplicar(e, { tipo: "derrota", delta: 0 }); assert.equal(e.seca, 1);
  e = M.aplicar(e, { tipo: "ponto", delta: 1 }); assert.equal(e.seca, 0); assert.equal(e.pontos, 1); assert.equal(e.teto, 4);
  e = { pontos: 1, seca: 0, teto: 1 };
  e = M.aplicar(e, { tipo: "quase", delta: 0 }); assert.equal(e.seca, 0); assert.equal(e.pontos, 1);
});
t("acaso empírico ≈ probabilidade exata", () => {
  const r = M.criarRNG(11), n = 400000; let trio=0;
  for (let i=0;i<n;i++) if (M.decidirAcaso(r).tipo==="ponto") trio++;
  const p = M.chanceTrioQualquer(); assert(Math.abs(trio/n - p) < 0.002, trio/n+" vs "+p);
});
const sd = M.simular(5000, "diretor", 123), sa = M.simular(5000, "acaso", 123);
t("ninguém vence com diretor", () => assert.equal(sd.venceram, 0));
t("todo jogador termina exatamente no teto (ninguém com 0, nunca perde ponto)", () => {
  const r = M.criarRNG(13);
  for (let i=0;i<5000;i++){ const e0 = M.novoEstado(r); let e = e0, ant = 0;
    for (let g=0;g<20;g++){ e = M.aplicar(e, M.decidir(r, e)); assert(e.pontos >= ant); ant = e.pontos; }
    assert.equal(e.pontos, e0.teto); }
});
t("turma de 30: 3 ou mais no 4 é raro (menos de 8% das turmas)", () => {
  const r = M.criarRNG(14), turmas = 5000; let muitas = 0;
  for (let i=0;i<turmas;i++){ let no4 = 0; for (let a=0;a<30;a++) if (M.jogarPartida(r).max === 4) no4++; if (no4 >= 3) muitas++; }
  assert(muitas/turmas < 0.08, "turmas com 3+ no 4: "+muitas/turmas);
});
console.log("\nP(trio) acaso =", (M.chanceTrioQualquer()*100).toFixed(2)+"%", " P(dado) =", (M.chanceTrio("dado")*100).toFixed(4)+"%", " P(quase natural) =", (M.chanceQuaseNatural()*100).toFixed(2)+"%");
console.log("diretor:", JSON.stringify(sd)); console.log("acaso:  ", JSON.stringify(sa));
console.log(`\n${ok} testes passaram`);
