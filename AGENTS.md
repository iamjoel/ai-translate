# AGENTS
## Code Quality & Architecture
> Applies to all code changes unless explicitly stated.

- Use **English only** in code and documentation.
- Write **self-documenting code**:
  - Clear naming conventions
  - Modular structure
  - Avoid unnecessary comments
- Follow **Clean Architecture principles**:
  - Clear layering
  - Dependencies flow inward
- In backend, log meaningful events and errors.
- Keep each module focused on a **single responsibility**.
- Keep **one component per file**.
- Do not create or grow **god files** (large files mixing UI markup, business logic, and data access)
  - If a file exceeds **more than 300 lines** (excluding types/imports) or has more than **one primary responsibility** → refactor into smaller modules. UI components, hooks, and utility functions are exceptions.
- **TypeScript (strict)**:
  - Avoid `any`
  - Follow ESLint rules (`pnpm lint:fix` preferred)

## Technology Usage by Task
- **es-toolkit** → Utility functions

### Backend / Server
- **LLM interactions** → AI SDK
- **Log** → pino

### Frontend / UI
- **Styling** → Tailwind CSS
- **UI components** → Shadcn UI (`/code/src/components/ui`)
