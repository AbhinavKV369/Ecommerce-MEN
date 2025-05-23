const express = require("express");
const router = express.Router();

const { upload } = require("../services/cloudinaryMulter");
const {
  createDefaultAdmin,
  handleGetAdminLogin,
  handlePostAdminLogin,

  handleGetAdminPanel,

  handleGetUsers,
  handleGetUserProfile,
  handleUpdateUserProfile,
  handleUserStatus,
  handleGetSearchUsers,

  handleGetProducts,
  handleGetAddProducts,
  handlePostAddProducts,
  handleEditProduct,
  handleUpdateProduct,
  handleDeleteProducts,

  handleGetManageOrders,
  handleViewUserOrderDetails,
  handleOrderStatus,
  handleDeleteOrder,

  handleGetAddBanner,
  handlePostAddBanner,

  
  handleGetMessages,
  handleDeleteMessages,
  handleGetSearchMessages,
  handleGetAllCoupons,
  handleCreateCoupon,
  handleToggleCouponStatus,
  handleDeleteCoupon,
  handleSearchCoupons,
} = require("../controllers/admin");

createDefaultAdmin();

router.get("/login", handleGetAdminLogin);
router.post("/login", handlePostAdminLogin);


router.get("/", handleGetAdminPanel);

router.get("/manage-users", handleGetUsers);
router.get("/edit-user/:id", handleGetUserProfile);
router.post("/update-profile/:id", handleUpdateUserProfile);
router.post("/toggle-user-status/:id", handleUserStatus);
router.post("/search-users", handleGetSearchUsers);

router.get("/manage-products", handleGetProducts);
router.get("/add-products", handleGetAddProducts);
router.post("/add-product", upload.array("productImage[]", 5), handlePostAddProducts);
router.get("/edit-product/:id", handleEditProduct);
router.post("/edit-product/:id", upload.array("productImage[]", 5), handleUpdateProduct);
router.post("/delete-product/:id", handleDeleteProducts);

router.get("/manage-orders", handleGetManageOrders);
router.get("/view-user-order/:id", handleViewUserOrderDetails);
router.post("/update-order-status/:id", handleOrderStatus);
router.post("/delete-order/:id", handleDeleteOrder);

router.get("/manage-coupons", handleGetAllCoupons);
router.post("/manage-coupons",handleCreateCoupon);

router.post("/coupons/toggle/:id",handleToggleCouponStatus);
router.get("/coupons/delete/:id",handleDeleteCoupon);
router.post("/coupons/search", handleSearchCoupons);
router.get("/add-banner", handleGetAddBanner);
router.post("/add-banner", upload.single("bannerImage"), handlePostAddBanner);

router.get("/user-messages", handleGetMessages);
router.post("/delete-message/:id", handleDeleteMessages);
router.post("/search-messages", handleGetSearchMessages);

const pages = [{ route: "/server-error", view: "server-error" }];

pages.forEach((page) => {
  router.get(page.route, async (req, res) => {
    try {
      res.render(`admin/${page.view}`);
    } catch (error) {
      res.status(500).render("client/server-error");
    }
  });
});

module.exports = router;
