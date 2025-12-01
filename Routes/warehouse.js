const express = require("express");
const router = express.Router();

const { auth, adminCheck } = require("../Middleware/auth");

const {
  // createWarehouse,
  list,
  getOneWarehouse,
  // removeOneWarehouse,
  // updateWarehouse,
} = require("../Controllers/warehouse");

router.get("/warehouse", auth, list);

router.get("/warehouse/:id", getOneWarehouse);

// router.post("/warehouse", auth,createWarehouse);

// router.put("/warehouse/:id", updateWarehouse);

// router.delete("/warehouse/:id", removeOneWarehouse);

module.exports = router;
