const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = {
  ...require('@prisma/client'),
  prisma,
  default: prisma
};
