const express = require("express");
const router = express.Router();

const {
  getOneUser,
  list,
  createUser,
  remove,
  update,
  updateUserbyuser,
  resetPassUserbyAdmin_send,
  removeall,
  createUsersendEmail,
  createAdminsendEmail,
} = require("../Controllers/user");

router.get("/user", list);

router.get("/user/:id", getOneUser);

router.post("/user", createUser);

router.post("/userU", createUsersendEmail);

router.post("/userA", createAdminsendEmail);

router.put("/user/:id", update);

router.put("/userU/:id", updateUserbyuser);

router.put("/userR/:id", resetPassUserbyAdmin_send);

router.delete("/user/:id", remove);

router.delete("/user", removeall);

module.exports = router;
