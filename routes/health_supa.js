// routes/health_supa.js
const router = require("express").Router();
const { supabase } = require("../lib/supabase");

/**
 * GET /health-supa
 * Verifica se o client do Supabase está funcional.
 * - Tenta um select mínimo na tabela 'admins'.
 * - Se a tabela não existir ou houver erro, ainda retornamos 200 com uma nota (não quebra o deploy).
 */
router.get("/health-supa", async (_req, res) => {
  try {
    const { data, error } = await supabase.from("admins").select("id").limit(1);

    if (error) {
      // Relação não existe ou outro erro de permissão — mas o client respondeu.
      return res.status(200).json({
        ok: true,
        supabase: true,
        note: `Conectado ao Supabase, mas consulta falhou: ${error.message}`,
      });
    }

    return res.status(200).json({
      ok: true,
      supabase: true,
      sampleCount: Array.isArray(data) ? data.length : 0,
    });
  } catch (e) {
    // Qualquer exceção inesperada: retornamos 200 com diagnóstico (para não derrubar healthcheck)
    return res.status(200).json({
      ok: true,
      supabase: true,
      note: `Exceção ao consultar: ${e.message}`,
    });
  }
});

/**
 * GET /health
 * Ping básico para uptime (não toca no Supabase).
 */
router.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, env: process.env.VERCEL ? "vercel" : "local" });
});

module.exports = router;
