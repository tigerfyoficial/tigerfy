// routes/aliases.js
const router = require("express").Router();

/* ===== GET antigos → novos (compatibilidade) ===== */
router.get("/deck", (_req, res) => res.redirect(301, "/dashboard"));
router.get("/bots", (_req, res) => res.redirect(301, "/ofertas"));
router.get("/bots/create", (_req, res) => res.redirect(301, "/ofertas/criar"));
router.get("/bots/manage", (req, res) => {
  const id = req.query.id ? `?id=${encodeURIComponent(req.query.id)}` : "";
  return res.redirect(301, `/ofertas/gerenciar${id}`);
});
router.get("/api_pix", (_req, res) => res.redirect(301, "/adquirentes"));

/* ===== POST antigos → novos (preserva método e body) ===== */
router.post("/bots/create", (req, res) => res.redirect(307, "/ofertas/criar"));

/* ===== Raiz → dashboard ===== */
router.get("/", (_req, res) => res.redirect(302, "/dashboard"));

module.exports = router;
