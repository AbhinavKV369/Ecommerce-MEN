const express = require("express");
const authorizedUser = require("../middleware/userAuth");
const {
  handleGetCheckout,
  handleCreateCODOrder,
  handleGetMyOrders,
  handleCancelOrder,
  latestOrder,
  createPaypalOrder,
  capturePaypalOrder,
} = require("../controllers/order");

const router = express.Router();


router.post("/order-summary", authorizedUser, handleCreateCODOrder);

router.post("/paypal/create", authorizedUser, createPaypalOrder);
router.post("/paypal/capture", authorizedUser, capturePaypalOrder);

router.post("/cancel-order/:id", authorizedUser, handleCancelOrder);

router.get("/checkout", authorizedUser, handleGetCheckout);
router.get("/my-orders", authorizedUser, handleGetMyOrders);

module.exports = router;
