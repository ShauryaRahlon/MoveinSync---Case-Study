import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    // The CLI needs a direct connection to run migrations, so we can use DIRECT_URL
    url: env('DATABASE_URL'),
  },
});