const express = require("express");
const router = express.Router();
const { auth } = require("../Middleware/auth");
const { createOrder } = require("../Controllers/order");

router.post("/order/create", auth, createOrder);

module.exports = router;
