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
  userRequestResetPassword,
  removeAll,
  createUsersendEmail,
  changeStatus,
  changeFirstPassword,
} = require("../Controllers/user");

router.get("/user", auth, list);

router.get("/getone-user/:id", auth, getOneUser);

router.get("/getrole-user/:id", auth, getUserRole);

router.post("/create-user", auth, adminCheck, createUser);

router.post("/createandsend-user", auth, adminCheck, createUsersendEmail);

router.put("/update-user-byadmin/:id", auth, adminCheck, updateUserByAdmin);

router.put("/update-user-byuser/:id", auth, updateUserbyuser);

router.put(
  "/resetpass-user-byadmin/:id",
  auth,
  adminCheck,
  resetPassUserbyAdmin
);

router.put(
  "/resetpass-user-byadminsend/:id",
  auth,
  adminCheck,
  resetPassUserbyAdmin_send
);

router.post("/request-reset-password", userRequestResetPassword);

router.put("/changefirstpassword-user/:id", auth, changeFirstPassword);

router.put("/changestatus-user/:id", auth, adminCheck, changeStatus);

router.delete("/user/:id", remove); //cancel

router.delete("/user", auth, adminCheck, removeAll); //cancel

module.exports = router;
