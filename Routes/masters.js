const express = require("express");
const router = express.Router();
const { auth, adminCheck } = require("../Middleware/auth");

const {
  createmasters,
  getOnemasters,
  list,
} = require("../Controllers/masters");

router.get("/masters", auth, list);

router.get("/masters/:id", getOnemasters);

router.post("/create-masters", createmasters);

module.exports = router;
