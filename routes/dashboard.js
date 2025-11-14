const express = require("express");
const router = express.Router();

router.get("/dashboard", (req, res) => {
  // Sem DB por enquanto: manda dados dummy
  res.render("dashboard", {
    title: "Dashboard - TigerFy",
    stats: { vendasHoje: 0, vendasMes: 0 },
  });
});

module.exports = router;
