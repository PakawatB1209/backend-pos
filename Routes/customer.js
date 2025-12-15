const express = require("express");
const router = express.Router();
const { auth, adminCheck } = require("../Middleware/auth");

const {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} = require("../Controllers/customer");

router.get("/all-customer", auth, listCustomers);

router.get("/one-customer/:id", auth, getCustomer);

router.post("/create-customer", auth, createCustomer);

router.put("/update-customer/:id", auth, updateCustomer);

router.delete("/remove-customer/:id", auth, deleteCustomer);

module.exports = router;
