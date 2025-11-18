const express = require("express");
const router = express.Router();

/* Auth igual às outras rotas */
function auth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

/* GET /conquistas */
router.get("/conquistas", auth, (_req, res) => {
  res.render("conquistas", {
    title: "Conquistas - TigerFy",
    active: "conquistas",
  });
});

module.exports = router;
