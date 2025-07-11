# Contributing

Thank you for your interest in contributing to SQL Canvas!

## Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd XLSCSV2SQLv2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── App.tsx              # Main application logic
├── main.tsx             # Application entry point
├── components/          # Reusable UI components
│   ├── Node.tsx         # Draggable data nodes
│   ├── Modal.tsx        # Generic modal component
│   └── XlsOptionsModal.tsx # Excel import options
└── workers/
    └── db.worker.ts     # SQLite database worker

public/
└── sqlite3.wasm        # SQLite WebAssembly binary
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run clean` - Clean build artifacts
- `npm run docker:build` - Build Docker image
- `npm run docker:dev` - Run development Docker environment
- `npm run docker:prod` - Run production Docker environment

## Code Style

- Use TypeScript for type safety
- Follow SolidJS patterns and conventions
- Keep components small and focused
- Use modern JavaScript features (async/await, destructuring, etc.)
- Implement proper error handling

## Testing

Before submitting changes:

1. Ensure the project builds without errors: `npm run build`
2. Test CSV and Excel file imports
3. Verify SQLite upload functionality works
4. Check that Docker builds and runs properly
5. Test responsive design on different screen sizes

## Submitting Changes

1. Create a feature branch from main
2. Make your changes with clear, descriptive commits
3. Update documentation if needed
4. Test your changes thoroughly
5. Submit a pull request with a clear description

## Architecture Notes

- **SQLite WASM**: Runs entirely in the browser using Web Workers
- **File Processing**: CSV handled by PapaParse, Excel by SheetJS
- **State Management**: SolidJS reactive stores for efficient updates
- **Styling**: Modern CSS with dark theme, no external UI library
- **Deployment**: Docker with nginx for production serving
