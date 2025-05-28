# API Testing Interface

This is a testing interface for the Gideon's Tech Suite API with Vercel authentication.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Set up a Vercel OAuth application:
   - Go to [Vercel Dashboard](https://vercel.com/account/tokens)
   - Create a new OAuth application
   - Set the redirect URI to `http://localhost:3001/test.html`
   - Copy the Client ID and Client Secret to your `.env` file

4. Start the development server:
   ```bash
   node server.js
   ```

5. Open http://localhost:3001/test.html in your browser

## Environment Variables

- `VERCEL_CLIENT_ID`: Your Vercel OAuth Client ID
- `VERCEL_CLIENT_SECRET`: Your Vercel OAuth Client Secret
- `PORT`: Port to run the server on (default: 3001)
- `NODE_ENV`: Environment (development/production)
