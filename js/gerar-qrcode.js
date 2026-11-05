// Gera o cartaz com QR code (impressão A4 e slide 16:9) direto no navegador.
// O QR code sai de js/qrcode.js (biblioteca qrcode-generator, licença MIT).
const $ = id => document.getElementById(id);
// Cores e fontes do Manual de Marca SorteBets
const COR = {creme:"#F3E8D2", cremeCl:"#FDF8EE", preto:"#171411", vermelho:"#B83832", ocre:"#C69A43", suave:"#5A4F42"};
const DISPLAY = 'italic 700 {s}px "SB Serif", "DejaVu Serif Condensed", Georgia, serif', BODY = '"Lato", Arial, sans-serif', MONO = '"DejaVu Sans Mono", Consolas, monospace';
const fonteTitulo = s => DISPLAY.replace("{s}", s);
// Frase da faixa (do manual), palavra por palavra, com a cor de cada uma
const FRASE = [["Não"],["é"],["só"],["sorte."],["Entenda",COR.ocre],["o",COR.ocre],["algoritmo.",COR.ocre]];
const logo = new Image(); logo.src = window.LOGO_SORTEBETS;

// Posições em pixels de cada formato
const IMPRESSAO = {W:2480, H:3508, borda:70, bordaLw:22, luzes:[150,3358], luzR:14,
  titulo:{x:1240, y:205, h:550},
  qr:{x:420, y:800, s:1640, moldura:28},
  url:{x:1240, y:2565, w:2000, size:56},
  faixa:{x:200, y:2650, w:2080, h:420, r:44, size:190, linhas:2},
  rodape:{x:1240, y:3205, size:52}};
const SLIDE = {W:1920, H:1080, borda:36, bordaLw:12, luzes:[78,1002], luzR:8,
  titulo:{x:1410, y:108, h:270},
  qr:{x:130, y:160, s:760, moldura:16},
  url:{x:1410, y:840, w:820, size:28},
  faixa:{x:1000, y:400, w:820, h:360, r:28, size:118, linhas:3},
  rodape:{x:1410, y:900, size:26}};

function rrect(g,x,y,w,h,r){ g.beginPath(); g.roundRect(x,y,w,h,r); }

// Linha com palavras de cores diferentes, centrada em cx
function linhaColorida(g, palavras, cx, y){
  const esp = g.measureText(" ").width;
  const larg = palavras.reduce((s,[t])=>s+g.measureText(t).width,0) + esp*(palavras.length-1);
  let x = cx - larg/2;
  g.textAlign = "left";
  palavras.forEach(([t,c])=>{ g.fillStyle = c || COR.creme; g.fillText(t,x,y); x += g.measureText(t).width + esp; });
  return larg;
}

// Divide a frase em até n linhas equilibradas e diminui a fonte até caber na faixa
function encaixarFrase(g, f){
  const largura = ps => g.measureText(ps.map(p=>p[0]).join(" ")).width;
  for (let size=f.size; size>20; size-=4){
    g.font = fonteTitulo(size);
    for (let n=1; n<=f.linhas; n++){
      const melhor = particionar(FRASE, n, largura);
      if (melhor.max <= f.w*0.86 && n*size*1.02 <= f.h*0.8) return {size, linhas:melhor.linhas};
    }
  }
  return {size:20, linhas:[FRASE]};
}
function particionar(ps, n, largura){
  if (n===1) return {linhas:[ps], max:largura(ps)};
  let melhor = {max:Infinity};
  for (let i=1; i<ps.length; i++){
    const resto = particionar(ps.slice(i), n-1, largura);
    const max = Math.max(largura(ps.slice(0,i)), resto.max);
    if (max < melhor.max) melhor = {linhas:[ps.slice(0,i), ...resto.linhas], max};
  }
  return melhor;
}

function desenharQR(g, url, q){
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
  const qr = qrcode(0, "Q"); qr.addData(url); qr.make();
  const n = qr.getModuleCount(), cel = Math.floor(q.s/(n+8));   // 4 módulos de margem em cada lado
  const ox = Math.round(q.x + (q.s - n*cel)/2), oy = Math.round(q.y + (q.s - n*cel)/2);
  const m = q.moldura;
  rrect(g, q.x-m+m*.6, q.y-m+m*.6, q.s+2*m, q.s+2*m, m*2.2); g.fillStyle = COR.preto; g.fill();   // sombra chapada
  rrect(g, q.x-m, q.y-m, q.s+2*m, q.s+2*m, m*2.2); g.fillStyle = COR.preto; g.fill();
  rrect(g, q.x, q.y, q.s, q.s, m*1.4); g.fillStyle = "#fff"; g.fill();
  g.fillStyle = COR.preto;
  for (let r=0; r<n; r++) for (let c=0; c<n; c++) if (qr.isDark(r,c)) g.fillRect(ox+c*cel, oy+r*cel, cel, cel);
}

function cartaz(canvas, url, L){
  const {W,H} = L; canvas.width = W; canvas.height = H;
  const g = canvas.getContext("2d");
  g.textBaseline = "alphabetic";

  // Fundo creme e moldura dupla art déco (sem brilhos)
  g.fillStyle = COR.creme; g.fillRect(0,0,W,H);
  const b = L.borda;
  rrect(g, b, b, W-2*b, H-2*b, b*.9); g.lineWidth = L.bordaLw; g.strokeStyle = COR.preto; g.stroke();
  const b2 = b + L.bordaLw*1.6;
  rrect(g, b2, b2, W-2*b2, H-2*b2, b*.6); g.lineWidth = Math.max(2, L.bordaLw/4); g.strokeStyle = COR.vermelho; g.stroke();
  const qtd = Math.round(W/(L.luzR*11));
  L.luzes.forEach(y=>{ for (let i=0;i<qtd;i++){
    const x = b*2.6 + (W-b*5.2)*i/(qtd-1);
    const r = L.luzR*1.1; // losangos dourados
    g.beginPath(); g.moveTo(x,y-r); g.lineTo(x+r,y); g.lineTo(x,y+r); g.lineTo(x-r,y); g.closePath();
    g.fillStyle = i%2 ? COR.ocre : COR.vermelho; g.fill();
  }});

  // Assinatura da marca: o emblema (o lettering não é redigitado com fonte)
  const t = L.titulo, lw = t.h * logo.naturalWidth / logo.naturalHeight;
  g.drawImage(logo, t.x - lw/2, t.y, lw, t.h);

  desenharQR(g, url, L.qr);

  // Link por extenso, para quem não conseguir ler o QR code
  const u = L.url; let us = u.size, txt = url.replace(/^https?:\/\//,"").replace(/\/$/,"");
  g.font = `500 ${us}px ${MONO}`;
  while (g.measureText(txt).width > u.w && us > u.size*.6){ us -= 2; g.font = `500 ${us}px ${MONO}`; }
  while (g.measureText(txt).width > u.w) txt = txt.slice(0,-2) + "…";
  g.textAlign = "center"; g.fillStyle = COR.suave; g.fillText(txt, u.x, u.y);

  // Faixa vermelha chapada com a frase
  const f = L.faixa, sombra = f.h*.04;
  rrect(g, f.x+sombra, f.y+sombra, f.w, f.h, f.r); g.fillStyle = COR.preto; g.fill();
  rrect(g, f.x, f.y, f.w, f.h, f.r); g.fillStyle = COR.vermelho; g.fill();
  g.lineWidth = sombra*.6; g.strokeStyle = COR.preto; g.stroke();
  const {size:fs, linhas} = encaixarFrase(g, f);
  g.font = fonteTitulo(fs);
  const alt = fs*1.1, topo = f.y + f.h/2 - alt*linhas.length/2 + fs*.82;
  linhas.forEach((ps,i)=>linhaColorida(g, ps, f.x+f.w/2, topo + i*alt));

  const r = L.rodape;
  let rs = r.size; g.font = `700 ${rs}px ${BODY}`;
  while (g.measureText("SIMULAÇÃO EDUCATIVA · fichas fictícias, nenhum dinheiro real").width > L.url.w && rs > 12){ rs--; g.font = `700 ${rs}px ${BODY}`; }
  g.textAlign = "center"; g.fillStyle = COR.preto;
  g.fillText("SIMULAÇÃO EDUCATIVA · fichas fictícias, nenhum dinheiro real", r.x, r.y);
}

function link(a, canvas){
  canvas.toBlob(blob=>{ if (a.href.startsWith("blob:")) URL.revokeObjectURL(a.href); a.href = URL.createObjectURL(blob); }, "image/png");
}

async function fontes(){
  // Espera o logo e as fontes do manual (embutidas em /fonts) carregarem
  if (!logo.complete) await new Promise(r=>{ logo.onload = logo.onerror = r; });
  await Promise.all([document.fonts.load('italic 700 40px "SB Serif"'), document.fonts.load('700 20px "Lato"')]).catch(()=>{});
  await document.fonts.ready;
}

function validar(texto){
  let u; try { u = new URL(texto); } catch { return "Isso não parece um link. Ele deve começar com https://"; }
  if (!/^https?:$/.test(u.protocol)) return "O link deve começar com https:// (um arquivo do computador não abre no celular).";
  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(u.hostname)) return "Esse link só funciona neste computador. Use o link público do jogo.";
  return "";
}

$("form").onsubmit = async e=>{
  e.preventDefault();
  const url = $("url").value.trim(), erro = validar(url);
  $("erro").textContent = erro; $("erro").hidden = !erro;
  if (erro) return;
  try { localStorage.setItem("sortibet-qr-link", url); } catch {}
  await fontes();
  cartaz($("cImp"), url, IMPRESSAO); cartaz($("cSlide"), url, SLIDE);
  link($("dImp"), $("cImp")); link($("dSlide"), $("cSlide"));
  $("saidas").hidden = false; $("dica").hidden = false;
};

try { $("url").value = localStorage.getItem("sortibet-qr-link") || ""; } catch {}
