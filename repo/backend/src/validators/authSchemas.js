const { z } = require("zod");

const authRegisterBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const authLoginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

module.exports = {
  authRegisterBodySchema,
  authLoginBodySchema,
};
