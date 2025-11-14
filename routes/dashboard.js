const express = require("express");
const router = express.Router();
const authGuard = require("../middleware/authGuard");

// se você lista planos, adapte; por enquanto só render do deck
router.get("/dashboard", authGuard, async (_req, res) => {
  try {
    return res.render("deck", {
      title: "Dashboard - TigerFy",
      active: "dashboard",
    });
  } catch (err) {
    console.error("Erro dashboard:", err);
    return res.status(500).send("Erro ao carregar dashboard.");
  }
});

module.exports = router;
