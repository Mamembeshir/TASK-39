const { z } = require("zod");
const { MIN_PASSWORD_LENGTH } = require("../validators");

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

const usernameSchema = z
  .string()
  .trim()
  .min(3, "username must be at least 3 characters")
  .max(64, "username must be at most 64 characters")
  .regex(USERNAME_REGEX, "username may contain only letters, numbers, and underscores");

const authRegisterBodySchema = z.object({
  username: usernameSchema,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(256, "password must be at most 256 characters"),
}).strict();

const authLoginBodySchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "password is required").max(256, "password must be at most 256 characters"),
}).strict();

module.exports = {
  authRegisterBodySchema,
  authLoginBodySchema,
};
