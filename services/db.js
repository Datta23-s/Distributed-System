// Database Client Singleton
const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prismaClient) {
    global.prismaClient = new PrismaClient({
      log: ['error', 'warn']
    });
  }
  prisma = global.prismaClient;
}

module.exports = prisma;
