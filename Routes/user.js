const express = require("express");
const router = express.Router();
const { auth, adminCheck } = require("../Middleware/auth");

const {
  getOneUser,
  getUserRole,
  list,
  createUser,
  remove,
  updateUserByAdmin,
  updateUserbyuser,
  resetPassUserbyAdmin,
  resetPassUserbyAdmin_send,
  removeAll,
  createUsersendEmail,
  changeStatus,
} = require("../Controllers/user");

router.get("/user", auth, list);

router.get("/user/:id", auth, getOneUser);

router.get("/userR/:id", auth, getUserRole);

router.post("/user", auth, adminCheck, createUser);

router.post("/userU", auth, adminCheck, createUsersendEmail);

router.put("/user/:id", auth, adminCheck, updateUserByAdmin);

router.put("/userU/:id", auth, updateUserbyuser);

router.put("/userR/:id", auth, adminCheck, resetPassUserbyAdmin);

router.put("/userRS/:id", auth, adminCheck, resetPassUserbyAdmin_send);

router.put("/userCS/:id", auth, adminCheck, changeStatus);

router.delete("/user/:id", auth, adminCheck, remove);

router.delete("/user", auth, adminCheck, removeAll);

module.exports = router;
