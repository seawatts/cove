# Hub Auto-Upgrade System

## Overview

The Cove Hub now includes a built-in auto-upgrade system that allows users to check for and install updates directly from the web UI. The system checks the npm registry for new versions and can upgrade the hub with automatic restart.

## Architecture

### Backend Components

#### 1. System Router (`packages/api/src/hub/router/system.ts`)

New tRPC router with three endpoints:

- **`getCurrentVersion`**: Returns the current hub version from package.json
- **`checkForUpdates`**: Fetches the latest version from npm registry and compares with current version
- **`upgradeHub`**: Executes `bun update @cove/hub` and triggers restart with exit code 42

#### 2. Hub Index (`apps/hub/src/index.ts`)

Enhanced with restart handling:

- Listens for exit code 42 to signal upgrade restart
- Graceful shutdown handler updated to support exit codes
- Compatible with process managers (systemd, PM2, etc.)

#### 3. Deployment Scripts

Created helper scripts for production deployment:

- **`start-hub.sh`**: Bash wrapper that automatically restarts on exit code 42
- **`cove-hub.service`**: Systemd service file with `Restart=always`

### Frontend Components

#### Hub Details Component (`apps/web-app/src/app/(app)/app/hub/_components/hub-details.tsx`)

Enhanced with version management UI:

- Displays current hub version
- "Check for Updates" button with loading state
- "Upgrade to vX.X.X" button (only shown when update available)
- Toast notifications for success/error states
- Automatic status refetch after upgrade

## Usage

### For End Users

1. Navigate to Hub Management page in the web app
2. Click "Check for Updates" to query npm registry
3. If update available, click "Upgrade to vX.X.X"
4. Confirm the upgrade prompt
5. Hub will automatically download, install, and restart

### For Developers

#### Publishing a New Version

1. Update version in `apps/hub/package.json`
2. Commit and push changes
3. Publish to npm: `npm publish` (or your CI/CD pipeline)
4. Users can now see and install the update

#### Running the Hub

**Development:**
```bash
bun run dev
```

**Production with Auto-Restart:**
```bash
# Option 1: Using wrapper script
chmod +x start-hub.sh
./start-hub.sh

# Option 2: Using systemd
sudo cp cove-hub.service /etc/systemd/system/
sudo systemctl enable cove-hub
sudo systemctl start cove-hub

# Option 3: Using bunx (manual restart needed)
bunx @cove/hub start
```

## Technical Details

### Version Comparison

Uses semantic versioning (semver) comparison:
- Splits versions into major.minor.patch
- Compares each segment numerically
- Returns `updateAvailable: true` if npm version is newer

### Upgrade Process

1. User clicks "Upgrade" button
2. Frontend calls `system.upgradeHub` mutation
3. Backend executes: `bun update @cove/hub`
4. If successful, backend exits with code 42
5. Process manager (wrapper script or systemd) detects exit code
6. Hub automatically restarts with new version
7. Frontend refetches status after 5 seconds

### Error Handling

- Network errors checking npm registry
- Failed upgrade command execution
- Version parsing errors
- All errors shown via toast notifications

## Security Considerations

- No authentication required for version check (read-only)
- Upgrade endpoint should be protected in production
- Only downloads from official npm registry
- Uses Bun's subprocess API for safe command execution

## Future Enhancements

- [ ] Changelog display when update available
- [ ] Rollback mechanism for failed upgrades
- [ ] Scheduled automatic updates
- [ ] Update notification system (push/email)
- [ ] Pre-upgrade backup of configuration
- [ ] Beta/stable channel selection
- [ ] Download progress indicator

