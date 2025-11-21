const express = require("express");
const router = express.Router();

const {
  createWarehouse,
  list,
  getOneWarehouse,
  removeOneWarehouse,
  updateWarehouse,
} = require("../Controllers/warehouse");

router.get("/warehouse", list);

router.get("/warehouse/:id", getOneWarehouse);

router.post("/warehouse", createWarehouse);

router.put("/warehouse/:id", updateWarehouse);

router.delete("/warehouse/:id", removeOneWarehouse);

module.exports = router;
