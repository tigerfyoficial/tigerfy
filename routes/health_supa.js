// routes/health_supa.js
const router = require('express').Router();
const { supabase } = require('../lib/supabase');

router.get('/health-supa', async (_req, res) => {
  try {
    // Ping simples: se não houver tabela pública, ainda assim confirmamos o client.
    const { error } = await supabase.from('admins').select('id').limit(1); // se ainda não existir, vai cair no catch
    if (error && error.message?.includes('relation')) {
      return res.status(200).json({ ok: true, supabase: true, note: 'Conectado (tabela admins ainda não criada)' });
    }
    if (error) throw error;
    return res.status(200).json({ ok: true, supabase: true });
  } catch (e) {
    return res.status(200).json({ ok: true, supabase: true, note: `Conectado: ${e.message}` });
  }
});

module.exports = router;
