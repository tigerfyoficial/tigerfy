// routes/aliases.js
const router = require("express").Router();

// antigos → novos (mantém compatibilidade)
router.get("/deck",        (_req, res) => res.redirect(301, "/dashboard"));
router.get("/bots",        (_req, res) => res.redirect(301, "/ofertas"));
router.get("/bots/create", (_req, res) => res.redirect(301, "/ofertas/criar"));
router.get("/bots/manage", (req, res) => {
  const id = req.query.id ? `?id=${encodeURIComponent(req.query.id)}` : "";
  return res.redirect(301, `/ofertas/gerenciar${id}`);
});
router.get("/api_pix",     (_req, res) => res.redirect(301, "/adquirentes"));

// se quiser que "/" caia na dashboard:
router.get("/", (_req, res) => res.redirect(302, "/dashboard"));

module.exports = router;
