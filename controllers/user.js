const User = require("../models/user");
const Message = require("../models/message");
const Coupon = require("../models/coupon")
const jwt = require("jsonwebtoken");
const { hashTheValue, compareTheValue } = require("../services/hashing");
const { generateOTP, sendOTP } = require("../services/nodeMailer");
const secret = process.env.JWT_SECRET;

async function handlePostRegister(req, res) {
  const { name, phone, email, password } = req.body;

  if (!name || !phone || !email || !password) {
    return res.status(400).render("client/register", {
      message: "All fields are required",
      formData: req.body,
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).render("client/register", {
        message: "User already exists",
        formData: req.body,
      });
    }

    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).render("client/register", {
        message:
          "Password must be at least 8 characters long, contain one letter, one number, and one special character.",
        formData: req.body,
      });
    }

    const hashedPassword = await hashTheValue(password, 12);
    const otpCode = generateOTP(6);
    const newUser = new User({
      name,
      phone,
      email,
      password: hashedPassword,
      otp: otpCode,
      otpExpires: Date.now() + 5 * 60 * 1000,
    });

    await newUser.save();
    await sendOTP(email, otpCode);

    const payload = { user: { id: newUser.id } };
    const token = jwt.sign(payload, secret);
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).render("client/verify-otp", {
      formData: req.body,
      email,
      message: "OTP sent to your email",
    });
  } catch (error) {
    res.status(400).render("client/server-error", {
      message: error.message,
    });
  }
}

async function handlePostOtp(req, res) {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).render("client/verify-otp", {
        message: "User not found",
        email,
        formData: req.body,
      });
    }

    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).render("client/verify-otp", {
        email,
        message: "Invalid OTP or OTP expired",
        formData: req.body,
      });
    }

    user.isVerified = true;
    user.userStatus = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.redirect("/")
  } catch (error) {
    return res.render("client/server-error", {
      message: error.message,
    });
  }
}

async function handlePostLogin(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).render("client/login", {
      message: "All fields are required",
      formData: req.body,
    });
  }
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).render("client/login", {
        message: "User not found",
      });
    }

    const isPasswordMatch = await compareTheValue(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).render("client/login", {
        message: "Incorrect Password",
        formBody: req.body,
      });
    }

    const payload = {
      user: {
        id: user.id,
      },
    };

    const token = jwt.sign(payload, secret, { expiresIn: "7d" });
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).redirect("/");
  } catch (error) {
    res.status(400).render("client/server-error", {
      message: error.message,
    });
  } 
}

async function handlePostForgotPassword(req,res) {
  const { email } = req.body
  try{
    const resetOtp = generateOTP() ;

    const user = await User.findOne({email});

    user.resetOtp = resetOtp;
    user. resetOtpExpires =  Date.now() + 5 * 60 * 1000 ;
    await user.save()

    await sendOTP(email,resetOtp);

    res.status(200).render("client/reset-otp",{
      email,
      message: "OTP send to email,please verify"
    })

  }catch(error){
    res.render("client/server-error", {
      message: error.message,
    });
  }
}

async function handlePostResetOtp(req, res) {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user || user.resetOtp !== otp || user.resetOtpExpires < Date.now()) {
      return res.status(400).render("client/reset-otp", {
        message: "Invalid or expired OTP",
        email,
      });
    }

    res.status(200).render("client/reset-password", {
      email,
      message: "OTP verified, now reset your password",
    });
  } catch (error) {
    res.render("client/server-error", {
      message: error.message,
    });
  }
}

async function handlePostResetPassword(req, res) {
  const { email, newPassword, confirmPassword } = req.body;

  if (!newPassword || !confirmPassword) {
    return res.status(400).render("client/reset-password", {
      message: "All fields are required",
      email,
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).render("client/reset-password", {
      message: "Passwords do not match",
      email,
    });
  }

  const passwordRegex =
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).render("client/reset-password", {
      message:
        "Password must be at least 8 characters long, contain one letter, one number, and one special character.",
      email,
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).render("client/reset-password", {
        message: "User not found",
        email,
      });
    }

    const hashedPassword = await hashTheValue(newPassword, 12);
    user.password = hashedPassword;

    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;

    await user.save();

    res.status(200).render("client/login",{
      message: "Password changed successfully"
    });
  } catch (error) {
    res.status(500).render("client/server-error", {
      message: error.message,
    });
  }
}

async function handlePostEditProfile(req, res) {
  try {
    const { name, phone, email } = req.body;

    const updatedFields = { name, phone, email };
    const user = await User.findByIdAndUpdate(req.user.id, updatedFields, {
      new: true,
    });

    res.render("client/edit-profile", {
      user,
      message: "Profile updated successfully",
    });

  } catch (error) {
    console.error("Edit profile error:", error);
    res.render("client/edit-profile", {
      user: req.body,
      message: error.message || "Something went wrong",
      addresses: req.body.addresses || [],
    });
  }
}

async function handleGetEditProfile(req, res) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.json({ message: "User not found" });
    }

    res.render("client/edit-profile", {
      user,
      message: null,
    });
  } catch (error) {
    res.render("client/edit-profile", {
      message: error.message,
    });
  }
}

async function handleGetAddAddress(req, res) {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).render("client/add-addresses", {
      user,
      addresses: user.addresses, 
    });
  } catch (error) {
    res.render("client/edit-profile", {
      message: error.message,
    });
  }
}

async function handlePostAddAddress(req,res) {

  const {addresses} = req.body;
  try{

    const newAddresses = {...addresses}
    await User.findByIdAndUpdate(
      req.user.id,
      {$push:{addresses:newAddresses}},
      {new:true}
    );

    res.redirect("/edit-profile");
    
  }catch(error){
    res.status(500).render("client/server-error", {
      message: error.message,
    });
  }
}

async function handlePostDeleteAddress(req,res) {
  try{
    const user = req.user.id;
    const address = req.params.id;
   await User.findByIdAndUpdate(
    user,
    {$pull:{ addresses:{ _id: address }}},
    {new:true}
   )
  res.redirect("/edit-profile");
  }catch(error){
    res.render("client/edit-profile", {
      message: error.message,
    });
  }
}

async function handlePostChangePassword(req, res) {
  const { password, newPassword, confirmNewPassword } = req.body;

  try {
    if (newPassword !== confirmNewPassword) {
      return res.status(400).render("client/change-password", {
        message: "New passwords do not match",
        formData: req.body,
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).render("client/change-password", {
        user,
        message: "User not found",
        formData: req.body,
      });
    }

    const isPasswordMatch = await compareTheValue(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).render("client/change-password", {
        user,
        message: "Old password is incorrect",
        formData: req.body,
      });
    }

    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).render("client/change-password", {
        message:
          "New password must be at least 8 characters long, contain one letter, one number, and one special character.",
        formData: req.body,
      });
    }

    const hashedPassword = await hashTheValue(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).render("client/home", {
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).render("client/server-error", {
      message: "An unexpected error occurred: " + error.message,
    });
  }
}

async function handleSubmitMessage(req, res) {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).render("client/contact", {
        message: "All fields are required.",
      });
    }

    const newMessage = new Message({
      name,
      email,
      subject,
      message,
    });

    await newMessage.save();
    res.json({success: true})
  } catch (error) {
    res.status(500).render("client/server-error", {
      message: error.message,
    });
  }
}

async function handleLogout(req, res) {
  try {
    res.clearCookie("token", { httpOnly: true });
    res.redirect("/");
  } catch (error) {
    res.status(500).render("client/server-error", {
      message: error.message,
    });
  }
}

async function handleDeleteAccount(req, res) {
  await User.findByIdAndDelete(req.user.id);

  res.clearCookie("token");

  res.render("client/home", {
    message: "Account deletion successfull",
  });
}

async function handleGetOffers(req, res) {
  try {
      const coupons = await Coupon.find({ isActive: true, expiryDate: { $gte: new Date() } }).sort({ expiryDate: 1 });
      res.render('client/coupons', { coupons });
  } catch (error) {
      console.error(error);
      res.status(500).send('Something went wrong.');
  }
};

async function handleGetHome(req, res) {
  res.render("client/home", {
    message: null,
  });
}

async function handleGetRegister(req, res) {
  res.render("client/register", {
    message: null,
    formData: {},
  });
}

async function handleGetOtp(req, res) {
  res.render("client/verify-otp", {
    message: null,
    formData: {},
  });
}

async function handleGetLogin(req, res) {
  res.render("client/login", {
    message: null,
    formData: {},
  });
}

async function handleGetResetOtp(req, res) {
  res.render("client/reset-otp", {
    message: null,
    formData: {},
  });
}

async function handleGetForgotPassword(req,res){
  res.status(201).render("client/forgot-password",{
    message: null,
    formData: {},
  });
}


async function handleGetUserDashboard(req, res) {
  res.render("client/user-dashboard");
}

async function handleGetChangePassword(req, res) {
  const user = await User.findById({ _id: req.user.id });
  res.render("client/change-password", {
    user,
    message: null,
    formData: {},
  });
}

async function handleGetServerError(req, res) {
  res.status(500).render("client/server-error");
}

module.exports = {
  handlePostRegister,
  handlePostOtp,
  handlePostLogin,
  handlePostForgotPassword,
  handlePostResetOtp,
  handlePostResetPassword,
  handlePostEditProfile,
  handlePostAddAddress,
  handlePostDeleteAddress,
  handleSubmitMessage,
  handlePostChangePassword,

  handleLogout,
  handleDeleteAccount,

  handleGetHome,
  handleGetRegister,
  handleGetOtp,
  handleGetLogin,
  handleGetForgotPassword,
  handleGetResetOtp,
  handleGetUserDashboard,
  handleGetEditProfile,
  handleGetAddAddress,
  handleGetChangePassword,
  handleGetOffers,
  handleGetServerError,
};
