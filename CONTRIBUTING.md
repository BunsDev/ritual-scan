# Contributing to Ritual Scan

## Quick Start

1. Fork & Clone
   ```bash
   git clone https://github.com/your-username/ritual-scan.git
   cd ritual-scan
   ```

2. Install Dependencies
   ```bash
   npm install
   ```

3. Set Up Environment
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your RPC endpoints
   ```

4. Start Development
   ```bash
   npm run dev
   ```

## Development Guidelines

### Code Style

- TypeScript: Use strict typing, avoid `any` when possible
- React Hooks: Follow the hooks rules - all hooks at the top level of components
- Naming: Use descriptive names, prefer `camelCase` for variables/functions
- Comments: Document complex logic and blockchain-specific concepts

### Component Structure

```tsx
function MyComponent() {
  // 1. All useState hooks
  const [state1, setState1] = useState<string>('')
  const [state2, setState2] = useState<number>(0)
  
  // 2. All useEffect hooks  
  useEffect(() => {}, [])
  useEffect(() => {}, [state1])
  
  // 3. Custom hooks
  const customData = useCustomHook()
  
  // 4. Helper functions
  const handleClick = useCallback(() => {}, [])
  
  // 5. Render logic
  return <div>...</div>
}
```

### Commit Convention

We use conventional commits:

```
type(scope): description

feat(ui): add real-time validator statistics
fix(websocket): resolve connection timeout issues  
docs(readme): update installation instructions
refactor(cache): improve smart caching performance
test(blocks): add unit tests for block parsing
```

Types:
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test additions/modifications
- `chore`: Maintenance tasks

## Testing

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# UI mode
npm run test:ui

# Type checking
npm run type-check
```

### Writing Tests

- Unit Tests: For utilities and pure functions
- Component Tests: For React components with user interactions
- E2E Tests: For critical user flows (Playwright)

Example:
```typescript
test('should parse transaction hash correctly', async ({ page }) => {
  await page.goto('/tx/0x123...')
  await expect(page.locator('[data-testid="tx-hash"]')).toContainText('0x123')
})
```

## Project Structure

```
src/
├── app/                 # Next.js app router pages
├── components/          # Reusable UI components
├── hooks/              # Custom React hooks  
├── lib/                # Utilities and services
├── styles/             # Global styles
└── types/              # TypeScript type definitions
```

## Key Concepts

- Smart Caching: WebSocket data cached for instant navigation
- Real-time Updates: Live blockchain data via WebSocket connections
- Ritual Chain: Support for async transactions and scheduled jobs

## Contributing Areas

### High Impact
- Performance: Optimize caching and real-time updates
- UX: Improve mobile responsiveness and accessibility
- Documentation: API docs, tutorials, examples

### Medium Impact  
- Features: New transaction types, analytics dashboards
- Testing: Increase test coverage, add integration tests
- DevEx: Better error handling, development tools

### Beginner Friendly
- UI Polish: Visual improvements, loading states
- Documentation: Fix typos, add examples
- Bug Fixes: Minor issues and edge cases

## Reporting Issues

When reporting bugs, please include:

1. Description: Clear description of the issue
2. Steps: How to reproduce the problem
3. Expected: What should happen
4. Actual: What actually happens
5. Environment: Browser, OS, Node.js version
6. Screenshots: If applicable

## Code Review Process

1. Self Review: Test your changes thoroughly
2. PR Description: Explain what, why, and how
3. Tests: Include relevant tests
4. Documentation: Update docs if needed
5. Review: Address feedback promptly

### PR Template

```markdown
## Summary
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Documentation update
- [ ] Refactoring

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Screenshots
(if applicable)
```

## Getting Help

- GitHub Issues: Bug reports and feature requests
- GitHub Discussions: Questions and general discussion

## Resources

- [Next.js Docs](https://nextjs.org/docs) - Framework documentation
- [Ritual Chain Docs](https://ritual.net/docs) - Blockchain protocol docs
- [TypeScript Handbook](https://typescriptlang.org/docs) - Language reference
