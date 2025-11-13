# CloudFlare Tunnel Setup for Remote Hub Access

This guide explains how to set up CloudFlare Tunnel to enable secure remote access to your Cove Hub.

## Why CloudFlare Tunnel?

- ✅ No port forwarding required
- ✅ No dynamic DNS needed
- ✅ Built-in DDoS protection
- ✅ Free tier available
- ✅ HTTPS automatically configured
- ✅ Works behind NAT/firewalls

## Prerequisites

- CloudFlare account (free)
- Domain name managed by CloudFlare
- Hub running on local network
- `cloudflared` CLI installed

## Installation

### macOS (via Homebrew)

```bash
brew install cloudflare/cloudflare/cloudflared
```

### Linux

```bash
# Download and install
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

### Docker

```bash
docker pull cloudflare/cloudflared:latest
```

## Setup Steps

### 1. Authenticate with CloudFlare

```bash
cloudflared tunnel login
```

This will open a browser window to authorize the connection.

### 2. Create a Tunnel

```bash
cloudflared tunnel create cove-hub
```

This creates a tunnel and saves the credentials to `~/.cloudflared/<TUNNEL_ID>.json`.

**Save the Tunnel ID** - you'll need it later.

### 3. Configure the Tunnel

Create a config file at `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/user/.cloudflared/<TUNNEL_ID>.json

ingress:
  # Route hub API through tunnel
  - hostname: hub.yourdomain.com
    service: http://localhost:3200
  # Catch-all rule (required)
  - service: http_status:404
```

Replace:
- `<TUNNEL_ID>` with your actual tunnel ID
- `hub.yourdomain.com` with your desired subdomain
- `localhost:3200` with your hub's actual address/port

### 4. Create DNS Record

```bash
cloudflared tunnel route dns cove-hub hub.yourdomain.com
```

This creates a CNAME record pointing your subdomain to the tunnel.

### 5. Run the Tunnel

#### Manual Start (for testing)

```bash
cloudflared tunnel run cove-hub
```

#### Install as System Service (recommended)

```bash
# Install service
sudo cloudflared service install

# Start service
sudo systemctl start cloudflared

# Enable on boot
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared
```

### 6. Update Hub Configuration

Set the `cloudUrl` environment variable in your hub:

```bash
export HUB_CLOUD_URL=https://hub.yourdomain.com
```

Or add to your `.env` file:

```
HUB_CLOUD_URL=https://hub.yourdomain.com
```

The hub will register this URL with the cloud so the web app knows where to find it remotely.

## Docker Compose Example

If running hub in Docker:

```yaml
version: '3.8'

services:
  cove-hub:
    image: cove/hub:latest
    environment:
      - HUB_CLOUD_URL=https://hub.yourdomain.com
    ports:
      - "3200:3200"

  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
    depends_on:
      - cove-hub
    restart: unless-stopped
```

Get your `TUNNEL_TOKEN` from the CloudFlare dashboard:
1. Go to Zero Trust > Access > Tunnels
2. Click on your tunnel
3. Click "Configure"
4. Copy the tunnel token

## Security Considerations

### 1. Access Control (Recommended)

Add CloudFlare Access to require authentication:

```yaml
ingress:
  - hostname: hub.yourdomain.com
    service: http://localhost:3200
    originRequest:
      access:
        teamName: yourteam
        audTag: hub-access
```

Then configure Access policies in the CloudFlare dashboard:
1. Zero Trust > Access > Applications
2. Add an application
3. Set authentication rules (email, Google SSO, etc.)

### 2. API Authentication

The hub should validate requests using the cloud user's authentication token. This is already implemented in the cloud sync service.

### 3. Rate Limiting

Configure rate limiting in CloudFlare:
1. Go to Security > WAF
2. Add rate limiting rules
3. Limit requests per IP

## Monitoring

### Check Tunnel Status

```bash
cloudflared tunnel info cove-hub
```

### View Logs

```bash
# System service
sudo journalctl -u cloudflared -f

# Manual run
cloudflared tunnel run cove-hub --loglevel debug
```

### CloudFlare Dashboard

View tunnel metrics in the CloudFlare Zero Trust dashboard:
1. Zero Trust > Access > Tunnels
2. Click on your tunnel
3. View traffic, health, and performance metrics

## Troubleshooting

### Tunnel won't start

1. Check credentials file exists and has correct permissions:
```bash
ls -la ~/.cloudflared/
```

2. Verify tunnel exists:
```bash
cloudflared tunnel list
```

3. Check config syntax:
```bash
cloudflared tunnel validate --config ~/.cloudflared/config.yml
```

### Can't reach hub remotely

1. Verify DNS is configured:
```bash
dig hub.yourdomain.com
```

Should return a CNAME to `<TUNNEL_ID>.cfargotunnel.com`.

2. Test locally first:
```bash
curl http://localhost:3200/health
```

3. Check tunnel logs for errors

### Hub not registering cloud URL

1. Ensure `HUB_CLOUD_URL` environment variable is set
2. Check hub logs for registration errors
3. Verify hub can reach cloud API

## Cost

CloudFlare Tunnel is **FREE** for up to:
- 50 active users
- Unlimited tunnels
- Unlimited bandwidth

Perfect for home automation use cases!

## Alternative: Tailscale

If you prefer a VPN-based approach, see [TAILSCALE.md](./TAILSCALE.md) for setup instructions.

## Next Steps

Once CloudFlare Tunnel is running:

1. Restart your hub to register the cloud URL
2. Open the web app and check the connection status badge
3. Try accessing the hub remotely from outside your network
4. Test device control to ensure everything works

The web app will automatically detect when you're on the local network vs remote and route requests appropriately!


