const Wishlist = require("../models/wishlist");

async function handleGetWishlist(req, res) {
    try {
        const wishlist = await Wishlist.findOne({ user: req.user.id }).populate("items.product");
        
        res.status(200).render("client/wishlist", { wishlist });
    } catch (error) {
        res.status(500).render("client/server-error", { message: error.message });
    }
}

async function handleToggleWishlist(req, res) {
    try {
        const productId = req.body.product;
        const userId = req.user.id;
        
        if(!userId){
            res.redirect("/login");
        }

        let wishlist = await Wishlist.findOne({ user: userId });

        if (!wishlist) {
            wishlist = new Wishlist({
                user: userId,
                items: [{ product: productId ,isWishlisted:true}]
            });
        } else {
            const index = wishlist.items.findIndex(item => item.product.toString() === productId);

            if (index > -1) {
                wishlist.items.splice(index, 1);
                wishlist.items.isWishlisted = "undefined"
            } else {

                wishlist.items.push({ product: productId ,isWishlisted:true });
            }
        }

        await wishlist.save();
        res.redirect(req.get("Referrer") || "/");
    } catch (error) {
        res.status(500).render("client/server-error", { message: error.message });
    }
}

module.exports = {
    handleGetWishlist,
    handleToggleWishlist
};
