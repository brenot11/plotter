# Plotter

Cemetery plot management app for Clark County Cemetery District #6.

## Development

```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

## Deploying an Update to GitHub Pages

Every time you want to push an update to the live app:

```bash
# 1. Make sure you're in the plotter folder
cd cemetery-manager

# 2. Build and deploy in one command
npm run deploy
```

That's it. The live URL will update within ~60 seconds.

**First time setup only** (do this once):
```bash
# Initialize git repo
git init
git add .
git commit -m "Initial commit"

# Create a new private repo on github.com called 'plotter', then:
git remote add origin https://github.com/brenot11/plotter.git
git branch -M main
git push -u origin main

# Install dependencies including gh-pages
npm install

# Deploy
npm run deploy
```

The app will be live at: **https://brenot11.github.io/plotter/**

## Default PIN

The app is protected by a PIN screen. Default PIN: **6902**

To change the PIN, open `src/components/PinScreen.jsx` and update the `CORRECT_HASH` value:
- Open browser console on any page
- Type: `btoa('your-new-pin')` and press Enter
- Copy the result and paste it as the new `CORRECT_HASH` value

## Data

All cemetery data is stored in the browser's localStorage on each device.
After deploying an update, use Import/Export → Load JSON Snapshot to restore data on any device.

## Architecture

```
src/
  main.jsx                  # Entry point + PIN auth gate
  App.jsx                   # Root component, all state management
  data/
    cemeteryData.js          # Constants, seed data, localStorage helpers
  utils/
    tckImport.js             # Crypt Keeper backup importer
    csvUtils.js              # CSV export
    changeLog.js             # Change tracking
  components/
    PinScreen.jsx            # PIN authentication screen
    MapCanvas.jsx            # Zoomable/pannable canvas plot grid
    PlotCard.jsx             # Quick-info overlay on plot tap
    DetailScreen.jsx         # Full record view + edit + change tracking
    ChangeLogScreen.jsx      # Pending changes list
    ImportExportScreen.jsx   # TCK import + JSON snapshot sync
    StatusBadge.jsx          # Colored status pill
  styles/
    global.css               # Design system, CSS variables
```


A tablet-friendly cemetery plot management app for use on-site. Built with React + Vite.

## Features

- Visual canvas map of all plots — drag to pan, pinch/scroll to zoom
- Color-coded plot status: Available, Occupied, Reserved, Sold, Unavailable
- Tap any plot for a quick info card, then drill into the full record
- Edit all fields directly in the app
- Search by name or internment number
- CSV export (for Crypt Keeper) and import
- All data stored locally on the device (no internet required on-site)

## Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or newer
- npm (comes with Node)

### Install & Run

```bash
# 1. Unzip the project folder, then open a terminal in it
cd cemetery-manager

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Then open your browser to `http://localhost:5173`

### Build for Deployment (GitHub Pages or any static host)

```bash
npm run build
```

This creates a `dist/` folder you can deploy anywhere. For GitHub Pages:

```bash
# Install gh-pages tool once
npm install --save-dev gh-pages

# Add to package.json scripts:
#   "deploy": "gh-pages -d dist"

npm run build
npm run deploy
```

## Data

On first launch, the app seeds itself with realistic dummy data across all 4 cemeteries so you can explore the interface immediately. Once you're ready to use real data, import a CSV from The Crypt Keeper via the **Import / Export** button.

Real data is saved to the browser's localStorage and persists between sessions.

## Crypt Keeper Integration

Export from TCK → CSV → import into this app. After editing on-site, export from this app → CSV → import back into TCK.

The column mapper recognizes common TCK field name variants. Share a sample TCK export to finalize the exact mapping for your version.

## Project Structure

```
src/
  App.jsx                  # Root component, state management
  data/
    cemeteryData.js        # Constants, seed data generator, localStorage helpers
  utils/
    csvUtils.js            # CSV import/export logic
  components/
    MapCanvas.jsx          # Canvas-based zoomable/pannable plot grid
    PlotCard.jsx           # Quick-info overlay on plot tap
    DetailScreen.jsx       # Full record view + edit mode
    ImportExportScreen.jsx # Import/export UI
    StatusBadge.jsx        # Colored status pill
  styles/
    global.css             # Design system, CSS variables, shared classes
```
