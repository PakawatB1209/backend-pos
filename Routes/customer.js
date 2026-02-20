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
  getPosCustomers,
  exportCustomersExcel,
} = require("../Controllers/customer");

router.get(
  "/all-customer",
  auth,
  checkPermission("Customer", "view"),
  listCustomers,
);

// dropdown customer pos
router.get("/POS/all-customer", auth, getPosCustomers);

router.get(
  "/one-customer/:id",
  auth,
  checkPermission("Customer", "view"),
  getCustomer,
);

router.get(
  "/export-customers",
  auth,
  // checkPermission("Customer", "Export"),
  exportCustomersExcel,
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
