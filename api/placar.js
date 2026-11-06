/* =====================================================================
   SORTEBETS · Placar online da turma (função da Vercel: /api/placar)

   Banco: Postgres no Neon (criado pela Vercel, plano gratuito).
   Tabela "placar": uma linha por jogador, com a chave (turma, id).
   Cada jogador grava só a própria linha (upsert), então várias pessoas
   podem jogar ao mesmo tempo sem uma apagar o placar da outra.

   GET    /api/placar?turma=3a            lista os jogadores da turma
   POST   /api/placar?turma=3a            grava/atualiza um jogador
   DELETE /api/placar?turma=3a            limpa a turma (pede a senha),
                                           ou só um jogador, se o corpo tiver "id"

   Variáveis de ambiente na Vercel:
     DATABASE_URL   criada sozinha ao conectar o banco Neon ao projeto
     PLACAR_SENHA   senha do professor para limpar o placar
   ===================================================================== */
"use strict";
const { neon } = require("@neondatabase/serverless");

const META = 5;
const MAX_JOGADORES = 300;   // por turma, para ninguém lotar o banco
const DIAS = 14;             // jogadores somem 14 dias depois do último giro

const URL_DB = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sql = URL_DB ? neon(URL_DB) : null;

// Cria a tabela na primeira chamada (uma vez por instância da função)
let pronto = null;
function prepararBanco() {
  if (!pronto) pronto = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS placar (
      turma      text        NOT NULL,
      id         text        NOT NULL,
      nome       text        NOT NULL,
      max        smallint    NOT NULL DEFAULT 0,
      rodadas    integer     NOT NULL DEFAULT 0,
      preso      integer     NOT NULL DEFAULT 0,
      near       integer     NOT NULL DEFAULT 0,
      gasto      integer     NOT NULL DEFAULT 0,
      atualizado timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (turma, id))`;
  })().catch((e) => { pronto = null; throw e; });
  return pronto;
}

const turmaDe = (q) => String(q || "geral").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20) || "geral";
const inteiro = (v, max) => Math.min(max, Math.max(0, Math.floor(Number(v)) || 0));
// Nome: texto simples, sem caracteres de controle, até 40 letras (o site escapa o HTML ao mostrar)
const limparNome = (s) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);

function jogadorValido(b) {
  const id = String(b.id || "");
  if (!/^[a-z0-9-]{6,40}$/i.test(id)) return null;
  const nome = limparNome(b.nome);
  if (!nome) return null;
  return {
    id, nome,
    max: inteiro(b.max, META - 1),   // o jogo nunca passa de 4: ninguém forja um "venceu"
    rodadas: inteiro(b.rodadas, 1000),
    preso: inteiro(b.preso, 1000),
    near: inteiro(b.near, 1000),
    gasto: inteiro(b.gasto, 100000),
  };
}

async function corpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!sql) return res.status(503).json({ erro: "Banco de dados não configurado na Vercel." });
  const turma = turmaDe(req.query && req.query.turma);
  try {
    await prepararBanco();

    if (req.method === "GET") {
      const jogadores = await sql`SELECT id, nome, max, rodadas, preso, near, gasto FROM placar
        WHERE turma = ${turma} AND atualizado > now() - make_interval(days => ${DIAS})`;
      return res.status(200).json({ turma, jogadores });
    }

    if (req.method === "POST") {
      const j = jogadorValido(await corpo(req));
      if (!j) return res.status(400).json({ erro: "Jogador inválido." });
      // De vez em quando, apaga quem não joga há mais de 14 dias
      if (Math.random() < 0.05) await sql`DELETE FROM placar WHERE atualizado < now() - make_interval(days => ${DIAS})`;
      const [{ total, existe }] = await sql`SELECT count(*)::int AS total, bool_or(id = ${j.id}) AS existe
        FROM placar WHERE turma = ${turma}`;
      if (!existe && total >= MAX_JOGADORES) return res.status(409).json({ erro: "Placar da turma cheio. Peça ao professor para limpar." });
      await sql`INSERT INTO placar (turma, id, nome, max, rodadas, preso, near, gasto, atualizado)
        VALUES (${turma}, ${j.id}, ${j.nome}, ${j.max}, ${j.rodadas}, ${j.preso}, ${j.near}, ${j.gasto}, now())
        ON CONFLICT (turma, id) DO UPDATE SET nome = EXCLUDED.nome, max = EXCLUDED.max, rodadas = EXCLUDED.rodadas,
          preso = EXCLUDED.preso, near = EXCLUDED.near, gasto = EXCLUDED.gasto, atualizado = now()`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const senha = process.env.PLACAR_SENHA;
      const { senha: enviada, id } = await corpo(req);
      if (!senha) return res.status(403).json({ erro: "Limpeza desativada: falta a variável PLACAR_SENHA na Vercel." });
      if (String(enviada || "") !== senha) return res.status(403).json({ erro: "Senha errada." });
      if (id) await sql`DELETE FROM placar WHERE turma = ${turma} AND id = ${String(id)}`;
      else await sql`DELETE FROM placar WHERE turma = ${turma}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ erro: "Método não permitido." });
  } catch (e) {
    console.error("placar:", e.message);
    return res.status(502).json({ erro: "Falha ao falar com o banco de dados." });
  }
};
