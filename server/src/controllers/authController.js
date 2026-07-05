import asyncHandler from "express-async-handler";
import crypto from "crypto";
import validator from "validator";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { sendVerificationEmail } from "../services/emailService.js";

let googleClient = null;
const getGoogleClient = () => {
  if (!googleClient && process.env.GOOGLE_CLIENT_ID) {
    googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return googleClient;
};

const issueVerificationToken = async (user) => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  user.verificationToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
  await user.save();
  const verifyUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/verify-email/${rawToken}`;
  return sendVerificationEmail(user.email, verifyUrl);
};

// @route POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email and password are all required");
  }
  if (!validator.isEmail(email)) {
    res.status(400);
    throw new Error("Please enter a valid email address");
  }
  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(409);
    throw new Error("An account with this email already exists");
  }

  const user = await User.create({ name, email, password });
  const emailResult = await issueVerificationToken(user);

  res.status(201).json({
    user: user.toSafeObject(),
    token: generateToken(user._id),
    // Only present in dev mode when SMTP isn't configured — lets you verify without real email.
    devVerificationLink: emailResult.devLink,
  });
});

// @route POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email?.toLowerCase() }).select("+password");
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  res.json({
    user: user.toSafeObject(),
    token: generateToken(user._id),
  });
});

// @route GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

// @route GET /api/auth/verify-email/:token
export const verifyEmail = asyncHandler(async (req, res) => {
  const hashed = crypto.createHash("sha256").update(req.params.token).digest("hex");

  const user = await User.findOne({
    verificationToken: hashed,
    verificationTokenExpires: { $gt: Date.now() },
  }).select("+verificationToken +verificationTokenExpires");

  if (!user) {
    res.status(400);
    throw new Error("This verification link is invalid or has expired");
  }

  user.emailVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpires = undefined;
  await user.save();

  res.json({ message: "Email verified successfully" });
});

// @route POST /api/auth/resend-verification  (authenticated)
export const resendVerification = asyncHandler(async (req, res) => {
  if (req.user.emailVerified) {
    return res.json({ message: "Your email is already verified" });
  }
  const emailResult = await issueVerificationToken(req.user);
  res.json({ message: "Verification email sent", devVerificationLink: emailResult.devLink });
});

// @route POST /api/auth/google  { idToken }
// Requires GOOGLE_CLIENT_ID in server/.env — get one from https://console.cloud.google.com/apis/credentials
export const googleAuth = asyncHandler(async (req, res) => {
  const client = getGoogleClient();
  if (!client) {
    res.status(503);
    throw new Error("Google sign-in isn't configured on this server (missing GOOGLE_CLIENT_ID)");
  }

  const { idToken } = req.body;
  if (!idToken) {
    res.status(400);
    throw new Error("Missing idToken");
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    res.status(401);
    throw new Error("Invalid Google token");
  }

  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email: payload.email.toLowerCase() }] });

  if (!user) {
    user = await User.create({
      name: payload.name || payload.email.split("@")[0],
      email: payload.email,
      googleId: payload.sub,
      emailVerified: true, // Google has already verified this address
    });
  } else if (!user.googleId) {
    user.googleId = payload.sub;
    user.emailVerified = true;
    await user.save();
  }

  res.json({ user: user.toSafeObject(), token: generateToken(user._id) });
});
