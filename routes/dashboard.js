const express = require("express");
const router = express.Router();
const Plan = require("../models/Plan");

function auth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

router.get(["/", "/deck"], auth, async (req, res) => {
  try {
    const planos = await Plan.find().sort({ createdAt: -1 });

    res.render("deck", {
      title: "Dashboard - TigerFy",
      planos,
      active: "deck",
    });
  } catch (err) {
    console.error("Erro dashboard:", err);
    res.status(500).send("Erro ao carregar dashboard.");
  }
});

module.exports = router;
