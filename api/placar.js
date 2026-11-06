/* =====================================================================
   SORTEBETS · Placar online da turma (função da Vercel: /api/placar)

   Banco: Upstash Redis (criado no painel da Vercel em Storage).
   Cada turma é um "hash" no Redis e cada jogador é um campo dele.
   Como cada jogador grava só o próprio campo, várias pessoas podem
   jogar ao mesmo tempo sem uma apagar o placar da outra.

   GET    /api/placar?turma=3a            lista os jogadores da turma
   POST   /api/placar?turma=3a            grava/atualiza um jogador
   DELETE /api/placar?turma=3a            limpa a turma (pede a senha)

   Variáveis de ambiente (a Vercel cria as duas primeiras sozinha ao
   conectar o banco ao projeto):
     KV_REST_API_URL / KV_REST_API_TOKEN   (ou UPSTASH_REDIS_REST_URL / _TOKEN)
     PLACAR_SENHA                          senha do professor para limpar
   ===================================================================== */
"use strict";

const META = 5;
const MAX_JOGADORES = 300;            // por turma, para ninguém lotar o banco
const DURACAO = 60 * 60 * 24 * 14;   // a turma some sozinha 14 dias depois do último giro

const URL_DB = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Envia comandos ao Redis pela API REST do Upstash (sem instalar pacote)
async function redis(...comandos) {
  const r = await fetch(URL_DB + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(comandos),
  });
  if (!r.ok) throw new Error("Banco respondeu " + r.status);
  const res = await r.json();
  const erro = res.find((x) => x.error);
  if (erro) throw new Error(erro.error);
  return res.map((x) => x.result);
}

const turmaDe = (q) => String(q || "geral").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20) || "geral";
const chave = (turma) => "sortebets:placar:" + turma;
const inteiro = (v, max) => Math.min(max, Math.max(0, Math.floor(Number(v)) || 0));
// Nome: só texto simples, sem caracteres de controle, até 40 letras
const limparNome = (s) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);

function jogadorValido(b) {
  const id = String(b.id || "");
  if (!/^[a-z0-9-]{6,40}$/i.test(id)) return null;
  const nome = limparNome(b.nome);
  if (!nome) return null;
  return {
    id, nome,
    max: inteiro(b.max, META),
    rodadas: inteiro(b.rodadas, 1000),
    preso: inteiro(b.preso, 1000),
    near: inteiro(b.near, 1000),
    gasto: inteiro(b.gasto, 100000),
    t: Date.now(),
  };
}

async function lista(turma) {
  const [plano] = await redis(["HGETALL", chave(turma)]);
  const out = [];
  for (let i = 1; i < (plano || []).length; i += 2) { try { out.push(JSON.parse(plano[i])); } catch { /* ignora lixo */ } }
  return out;
}

async function corpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_DB || !TOKEN) return res.status(503).json({ erro: "Banco de dados não configurado na Vercel." });
  const turma = turmaDe(req.query && req.query.turma);
  try {
    if (req.method === "GET") return res.status(200).json({ turma, jogadores: await lista(turma) });

    if (req.method === "POST") {
      const j = jogadorValido(await corpo(req));
      if (!j) return res.status(400).json({ erro: "Jogador inválido." });
      const [existe, total] = await redis(["HEXISTS", chave(turma), j.id], ["HLEN", chave(turma)]);
      if (!existe && total >= MAX_JOGADORES) return res.status(409).json({ erro: "Placar da turma cheio. Peça ao professor para limpar." });
      await redis(["HSET", chave(turma), j.id, JSON.stringify(j)], ["EXPIRE", chave(turma), DURACAO]);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const senha = process.env.PLACAR_SENHA;
      const { senha: enviada } = await corpo(req);
      if (!senha) return res.status(403).json({ erro: "Limpeza desativada: falta a variável PLACAR_SENHA na Vercel." });
      if (String(enviada || "") !== senha) return res.status(403).json({ erro: "Senha errada." });
      await redis(["DEL", chave(turma)]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ erro: "Método não permitido." });
  } catch (e) {
    return res.status(502).json({ erro: "Falha ao falar com o banco de dados." });
  }
};
