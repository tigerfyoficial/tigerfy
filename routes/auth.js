// routes/auth.js
const express = require("express");
const router = express.Router();

// GET /login
router.get("/login", (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.render("login", { title: "Login - TigerFy", error: null });
});

// POST /login (temporário, sem DB)
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).render("login", {
      title: "Login - TigerFy",
      error: "Informe email e senha.",
    });
  }
  req.session.user = { email };
  return res.redirect("/dashboard");
});

// GET /logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
