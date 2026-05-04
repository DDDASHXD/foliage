# shadcn/ui monorepo template

This is a Next.js monorepo template with shadcn/ui.

## Running OpenMD

Start a collaborative workspace from the current directory:

```bash
pnpx openmd
```

Open a specific workspace path:

```bash
pnpx openmd --workspace /Users/skov/exam-project
```

The `--password` flag is accepted for future compatibility, but password protection is not implemented yet.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```
