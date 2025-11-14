const express = require("express");
const router = express.Router();

router.get("/offers", (req, res) => {
  const ofertas = []; // placeholder
  res.render("offers", { title: "Ofertas - TigerFy", ofertas });
});

module.exports = router;
