const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const cors = require("cors");
const flash = require('connect-flash');
const session = require("express-session");
require("dotenv").config();

const dbConnect = require("./config/dbConnect");

const userAuth = require("./middleware/userAuth");
const cartCount = require("./middleware/cartCount");
const wishlistCount = require("./middleware/wishlistCount");

const connectFlash = require("./middleware/connect-flash");

const homeRoutes = require("./routes/home");
const userRoutes = require("./routes/user");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/order");
const adminRoutes = require("./routes/admin");
const wishlistRoutes = require("./routes/wishlist");

const app = express();
const PORT = process.env.PORT || 5003;

dbConnect("mongodb://127.0.0.1:27017/truck-haulers");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.resolve("public")));
app.use(cors({ credentials: true, origin: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}))

app.set("view engine", "ejs");
app.set("views", path.resolve("views"));

app.use(flash());
app.use(connectFlash);

app.use(userAuth);
app.use(cartCount);
app.use(wishlistCount);


app.use("/", homeRoutes, userRoutes, cartRoutes, orderRoutes, wishlistRoutes);
app.use("/admin", adminRoutes);

app.listen(PORT, () => {
  console.log("Server connected at port", PORT);
});
