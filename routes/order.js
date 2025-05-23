const express = require("express");

const authorizedUser = require("../middleware/userAuth");
const { handleGetCheckout, handleCreateOrder, handleGetMyOrders, handleCancelOrder, latestOrder } = require("../controllers/order");

const router = express.Router();

router.post("/order-summary",authorizedUser,handleCreateOrder);
router.post("/cancel-order/:id",authorizedUser,handleCancelOrder);

router.get("/checkout",authorizedUser,handleGetCheckout);
router.get("/my-orders",authorizedUser,handleGetMyOrders);


module.exports = router;