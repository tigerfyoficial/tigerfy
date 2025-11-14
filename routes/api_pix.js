const express = require("express");
const router = express.Router();

router.get("/api_pix", (req, res) => {
  res.render("api_pix", { title: "API PIX - TigerFy" });
});

module.exports = router;
