const express = require("express");
const router = express.Router();
const { auth, adminCheck } = require("../Middleware/auth");
const { checkPermission } = require("../Middleware/checkPermission");

const {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} = require("../Controllers/customer");

router.get(
  "/all-customer",
  auth,
  checkPermission("Customer", "view"),
  listCustomers,
);

router.get(
  "/one-customer/:id",
  auth,
  checkPermission("Customer", "view"),
  getCustomer,
);

router.post(
  "/create-customer",
  auth,
  checkPermission("Customer", "add"),
  createCustomer,
);

router.put(
  "/update-customer/:id",
  auth,
  checkPermission("Customer", "update"),
  updateCustomer,
);

router.delete(
  "/delete-customer/:id",
  auth,
  checkPermission("Customer", "delete"),
  deleteCustomer,
);

module.exports = router;
