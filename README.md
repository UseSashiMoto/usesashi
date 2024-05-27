# Sashi starter

Admin tools for developers

## Features

- Control runtime variables 


### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app
- `sashi-extension`: chrome extension to admin app
- `sashi-react-hooks`: react hooks to embed runtime variables, these can be control via the chrome extension and middleware
- `sashi-server`: server for distrbuting admin control commands and runtime configs


Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).


### Build

To build all apps and packages, run the following command:

```
cd my-turborepo
yarn build
```

### Develop

To develop all apps and packages, run the following command:

```
cd my-turborepo
yarn dev
```

### How to Use This Middleware in an Application

To use this middleware in an application, the consumer would set it up as follows:

```typescript
import express from 'express';
import { PrismaClient } from '@prisma/client';
import createMiddleware from './path/to/middleware';

const prismaClient = new PrismaClient();
const app = express();
const port = 3000;

app.use('/api', createMiddleware({
    prismaClient: prismaClient,
    redisUrl: 'redis://localhost:6379',
    accountIdHeader: 'x-account-id'
}));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
