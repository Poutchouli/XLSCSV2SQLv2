# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2025-07-11

### Enhanced
- Added keyboard shortcuts for improved user experience:
  - Press `N` to create test table
  - Press `S` to save database
  - Press `T` to view tables
- Added tooltips to control buttons showing keyboard shortcuts
- Optimized Node component performance with memoized calculations
- Fixed import path in Node component for correct module resolution
- Added shortcut indicator in control panel

## [1.0.0] - 2025-07-11

### Added
- Visual SQL environment with draggable CSV/Excel import nodes
- Real-time data preview with schema display (first 5 rows)
- SQLite WASM integration for in-browser database operations
- Excel file support with multi-sheet import options
- Upload functionality to transfer node data to SQLite
- Toast notification system for user feedback
- Table management with view and delete capabilities
- Docker support for easy deployment
- Modern UI with dark theme and responsive design
- Web Worker implementation for non-blocking database operations

### Technical Features
- SolidJS framework with TypeScript
- SQLite WASM for client-side database
- PapaParse for CSV processing
- SheetJS for Excel file handling
- Vite build system with hot reload
- Docker multi-stage builds with nginx
- Modern event handling with AbortController
- Organized project structure with components and workers

### Project Structure
- Cleaned up and organized codebase
- Separated components into `/src/components/`
- Moved workers to `/src/workers/`
- Added comprehensive documentation
- Implemented proper Docker deployment setup
- Enhanced package.json with useful scripts

### Documentation
- Complete README.md with usage instructions
- Docker deployment guide (README-Docker.md)
- Project structure documentation
- Development and deployment instructions
