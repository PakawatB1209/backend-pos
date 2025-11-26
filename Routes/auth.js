const express = require("express");
const router = express.Router();

const { userForgotPassword, login } = require("../Controllers/auth");

router.post("/login", login);

router.post("/forgotPassword", userForgotPassword);

module.exports = router;
