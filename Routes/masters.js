const express = require("express");
const router = express.Router();
const { auth, adminCheck } = require("../Middleware/auth");

const {
  createmasters,
  getOnemasters,
  list,
  getGroupedMasters,
} = require("../Controllers/masters");

router.get("/masters", auth, list);

// for dropdown
router.get("/grouped", auth, getGroupedMasters);

router.get("/masters/:id", getOnemasters);

// router.post("/create-masters", createmasters);
router.post("/create-masters", auth, createmasters);

module.exports = router;
