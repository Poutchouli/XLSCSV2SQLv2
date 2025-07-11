# SQL Canvas

A visual SQL environment that allows users to import CSV/Excel files as draggable nodes, preview data, and upload tables to SQLite for querying.

## Features

- **Visual Interface**: Drag and drop CSV/Excel files to create interactive nodes
- **Data Preview**: View schema and first 5 rows of data in each node
- **SQLite Integration**: Upload node data to an in-memory SQLite database
- **Excel Support**: Import multiple sheets from Excel files with customizable options
- **Real-time Feedback**: Toast notifications for user actions
- **Modern UI**: Clean, dark theme with responsive design

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Docker Deployment

See [README-Docker.md](./README-Docker.md) for complete Docker deployment instructions.

**Quick start:**
```bash
# Production deployment
docker-compose up -d --build

# Development with hot reload
docker-compose --profile dev up sql-canvas-dev
```

## Usage

1. **Import Data**: 
   - Drag and drop CSV files onto the canvas
   - For Excel files, select sheets and configure import options
   - Press 'N' to create test tables (or click any area and press N)

2. **Explore Data**:
   - Each node shows table schema and data preview
   - Click the toggle button to switch between schema and data views
   - Row count is displayed at the bottom of each node

3. **Upload to SQLite**:
   - Click the upload button (↑) on any node to add it to SQLite
   - Use "View Tables" (or press T) to see all uploaded tables
   - Export the SQLite database using "Save DB" (or press S)

4. **Keyboard Shortcuts**:
   - `N` - Create test table at current mouse position
   - `S` - Save/export database
   - `T` - View uploaded tables

## Project Structure

```
src/
├── App.tsx           # Main application component
├── Node.tsx          # Draggable data node component
├── Modal.tsx         # Generic modal component
├── XlsOptionsModal.tsx # Excel import options modal
├── db.worker.ts      # SQLite Web Worker
├── main.tsx          # Application entry point
└── *.css            # Component styles

public/
└── sqlite3.wasm     # SQLite WebAssembly binary

Docker/
├── Dockerfile       # Multi-stage production build
├── docker-compose.yml # Container orchestration
├── nginx.conf       # Production web server config
└── .dockerignore    # Docker build exclusions
```

## Technologies

- **Frontend**: SolidJS, TypeScript, Vite
- **Database**: SQLite WASM (in-browser)
- **File Processing**: PapaParse (CSV), SheetJS (Excel)
- **Deployment**: Docker, nginx
- **Styling**: Modern CSS with dark theme

## Development Notes

- SQLite runs entirely in the browser using WebAssembly
- Web Workers handle database operations to prevent UI blocking
- Modern event handling with AbortController for cleanup
- Responsive design with drag-and-drop interactions

## License

MIT License
