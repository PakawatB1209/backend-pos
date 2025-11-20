const express = require("express");
const router = express.Router();

const { login, userForgotPassword } = require("../Controllers/auth");

const { auth } = require("../Middleware/auth");

router.post("/login", login);

router.post("/forgotPassword", userForgotPassword);

module.exports = router;
