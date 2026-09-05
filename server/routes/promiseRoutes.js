
const express = require("express");

const {
  receivePromise,
  fulfillPromise,
  breakPromise,
} = require("../controllers/promiseController");

const router = express.Router();

// Customer promise
router.post("/receive", receivePromise);

// Promise successfully fulfilled
router.post("/fulfill", fulfillPromise);

// Promise broken
router.post("/broken", breakPromise);

module.exports = router;