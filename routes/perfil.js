const express = require("express");
const router = express.Router();

/* Auth igual às outras rotas */
function auth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

/* GET /perfil */
router.get("/perfil", auth, (_req, res) => {
  res.render("perfil", {
    title: "Meu Perfil - TigerFy",
    active: "perfil",
  });
});

module.exports = router;
