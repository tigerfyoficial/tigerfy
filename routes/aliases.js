// routes/aliases.js
const router = require("express").Router();

// 👇 apelidos antigos ou variações redirecionando pros canônicos
router.get("/offers", (_req, res) => res.redirect(301, "/bots"));
router.get("/ofertas", (_req, res) => res.redirect(301, "/bots"));
router.get("/adquirentes", (_req, res) => res.redirect(301, "/api_pix"));
router.get("/dashboard", (_req, res) => res.redirect(301, "/deck"));
router.get("/bots/list", (_req, res) => res.redirect(301, "/bots"));
router.get("/manage", (_req, res) => res.redirect(301, "/bots/manage"));

module.exports = router;
