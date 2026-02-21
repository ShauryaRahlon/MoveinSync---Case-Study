import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the Neon adapter using the pooled connection
const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!
});

// Pass the adapter directly into the Prisma Client constructor
const prisma = new PrismaClient({ adapter });

export default prisma;