const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();
  const hashedPassword = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@wagtw.com' },
    update: {},
    create: {
      email: 'admin@wagtw.com',
      password: hashedPassword,
      name: 'Super Admin',
    },
  });
  console.log('✅ Admin user created successfully');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    // await prisma.$disconnect();
  });
