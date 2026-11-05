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
t("diretor nunca dá o 5º ponto (100 mil giros em 4)", () => {
  const r = M.criarRNG(1);
  for (let i=0;i<100000;i++){ const d = M.decidir(r, 4); assert(d.delta <= 0); assert(!M.ehTrio(M.linha(d.paradas))); }
});
t("paradas mostram o que o diretor decidiu", () => {
  const r = M.criarRNG(3);
  for (let i=0;i<50000;i++){
    const d = M.decidir(r, i%5), l = M.linha(d.paradas);
    if (d.tipo==="ponto") assert(M.ehTrio(l) && l[0]===d.alvo);
    else assert(!M.ehTrio(l));
    if (d.tipo==="quase"){ assert(l[0]===d.alvo && l[1]===d.alvo && l[2]!==d.alvo);
      const j = M.janela(2, d.paradas[2]); assert(j[0]===d.alvo || j[2]===d.alvo); }
    if (d.tipo==="derrota" || d.tipo==="recuo") assert(!(l[0]!=="vazio" && l[0]===l[1]));
  }
});
t("frequências do diretor batem com a CONFIG", () => {
  const r = M.criarRNG(5), n = 200000, C = M.CONFIG; let quase4=0, recuo=0;
  C.chanceIsca.forEach((p, pts) => {
    let isca = 0; for (let i=0;i<n;i++) if (M.decidir(r, pts).tipo==="ponto") isca++;
    assert(Math.abs(isca/n-p)<0.005, pts+": "+isca/n);
  });
  for (let i=0;i<n;i++){ const d=M.decidir(r,4); if(d.tipo==="quase")quase4++; if(d.tipo==="recuo")recuo++; }
  assert(Math.abs(recuo/n-C.chanceRecuo)<0.005); assert(Math.abs(quase4/n-(1-C.chanceRecuo)*C.chanceQuaseTravado)<0.005);
});
t("seca máxima: ponto garantido depois de 3 giros sem ponto", () => {
  const r = M.criarRNG(8);
  for (let i=0;i<20000;i++){ const d = M.decidir(r, { pontos: i%4, seca: M.CONFIG.secaMaxima, noTrava: 0, recuou: false }); assert.equal(d.tipo, "ponto"); }
});
t("carência: sem recuo nos primeiros giros no 4", () => {
  const r = M.criarRNG(12);
  for (let k=0;k<M.CONFIG.carenciaTrava;k++)
    for (let i=0;i<20000;i++) assert.notEqual(M.decidir(r, { pontos: 4, seca: 0, noTrava: k, recuou: false }).tipo, "recuo");
});
t("memória do diretor (aplicar)", () => {
  let e = M.novoEstado();
  e = M.aplicar(e, { tipo: "derrota", delta: 0 }); assert.equal(e.seca, 1);
  e = M.aplicar(e, { tipo: "ponto", delta: 1 }); assert.equal(e.seca, 0); assert.equal(e.pontos, 1);
  e = { pontos: 3, seca: 0, noTrava: 0, recuou: false };
  e = M.aplicar(e, { tipo: "ponto", delta: 1 }); assert.equal(e.noTrava, 0);
  e = M.aplicar(e, { tipo: "quase", delta: 0 }); assert.equal(e.noTrava, 1);
  e = M.aplicar(e, { tipo: "recuo", delta: -1 }); assert(e.recuou); assert.equal(e.pontos, 3);
  e = M.aplicar(e, { tipo: "ponto", delta: 1 }); assert(!e.recuou); assert.equal(e.noTrava, 0);
});
t("acaso empírico ≈ probabilidade exata", () => {
  const r = M.criarRNG(11), n = 400000; let trio=0;
  for (let i=0;i<n;i++) if (M.decidirAcaso(r).tipo==="ponto") trio++;
  const p = M.chanceTrioQualquer(); assert(Math.abs(trio/n - p) < 0.002, trio/n+" vs "+p);
});
const sd = M.simular(5000, "diretor", 123), sa = M.simular(5000, "acaso", 123);
t("ninguém vence com diretor", () => assert.equal(sd.venceram, 0));
t("com diretor, todos chegam a 4 (a isca nunca falha)", () => assert.equal(sd.chegaram4, sd.n));
console.log("\nP(trio) acaso =", (M.chanceTrioQualquer()*100).toFixed(2)+"%", " P(dado) =", (M.chanceTrio("dado")*100).toFixed(4)+"%", " P(quase natural) =", (M.chanceQuaseNatural()*100).toFixed(2)+"%");
console.log("diretor:", JSON.stringify(sd)); console.log("acaso:  ", JSON.stringify(sa));
console.log(`\n${ok} testes passaram`);
