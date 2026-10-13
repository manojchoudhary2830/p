# 🚀 Deployment Guide: NextGen PG Booking

This repository is pre-configured for a zero-cost production deployment stack:
- **Database:** MongoDB Atlas (Free M0 Shared Cluster)
- **Backend API:** Render (Free Web Service)
- **Frontend SPA:** Vercel or Netlify (Free Static Hosting)

---

## 1. MongoDB Atlas Setup (Database)

1. **Sign Up / Log In**: Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. **Create a Free Cluster**:
   - Click **Create Deployment**.
   - Choose **M0 (Free)** tier.
   - Select your preferred cloud provider and closest region (e.g., AWS / Mumbai or Singapore).
   - Click **Create**.
3. **Database User Security**:
   - Go to **Security > Database Access**.
   - Click **Add New Database User**.
   - Choose **Password** authentication.
   - Enter a username (e.g. `pgbooking_admin`) and secure password.
   - Role: **Read and write to any database**.
4. **Network Access**:
   - Go to **Security > Network Access**.
   - Click **Add IP Address**.
   - Select **Allow Access from Anywhere** (`0.0.0.0/0`) so that Render can connect.
   - Click **Confirm**.
5. **Copy Connection String**:
   - On the Cluster Overview, click **Connect > Drivers**.
   - Copy the SRV URI:
     ```
     mongodb+srv://<username>:<password>@<cluster-subdomain>.mongodb.net/pgbooking?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your database user credentials.

---

## 2. Render Setup (Backend API)

1. **Sign Up / Log In**: Go to [Render](https://render.com).
2. **Create New Web Service**:
   - Click **New + > Web Service**.
   - Connect your GitHub repository: `manojchoudhary2830/p`.
   - Settings:
     - **Name:** `pgbooking-api`
     - **Root Directory:** `backend`
     - **Environment:** `Python 3`
     - **Build Command:** `pip install -r requirements.txt`
     - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
     - **Instance Type:** `Free`
3. **Environment Variables**:
   In the Render dashboard under **Environment**, add the following:

   | Key | Value | Description |
   |---|---|---|
   | `MONGO_URL` | `mongodb+srv://<user>:<pwd>@cluster.../pgbooking?retryWrites=true&w=majority` | Your Atlas connection string |
   | `DB_NAME` | `pgbooking` | MongoDB database name |
   | `ENVIRONMENT` | `production` | Production mode |
   | `JWT_SECRET` | *(click Generate or enter a 32+ char random string)* | JWT signing secret |
   | `FRONTEND_URL` | `https://your-app.vercel.app` *(or Netlify URL)* | Allowed frontend origin for CORS |
   | `STORAGE_URL` | `/uploads` | Local upload route path |
   | `STRIPE_API_KEY` | *(optional)* `sk_test_...` | Stripe secret key |
   | `STRIPE_WEBHOOK_SECRET` | *(optional)* `whsec_...` | Stripe webhook secret |
   | `SENDGRID_API_KEY` | *(optional)* `SG....` | SendGrid API key |
   | `SENDER_EMAIL` | `manoj.portfolio.website@gmail.com` | Verified SendGrid sender |

4. **Deploy**:
   - Click **Deploy Web Service**.
   - Once deployment completes, note your backend URL (e.g. `https://pgbooking-api.onrender.com`).
   - Test by visiting `https://pgbooking-api.onrender.com/api/health` — it should return `"status": "PASS"`.

---

## 3. Frontend Deployment (Option A: Vercel - Recommended)

1. **Sign Up / Log In**: Go to [Vercel](https://vercel.com).
2. **Import Git Repository**:
   - Click **Add New > Project**.
   - Select your GitHub repository: `manojchoudhary2830/p`.
3. **Project Settings**:
   - **Root Directory:** Edit and select `frontend`.
   - **Framework Preset:** `Vite` (auto-detected).
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Environment Variables**:
   - Add:
     - `VITE_BACKEND_URL`: `https://pgbooking-api.onrender.com` (your Render backend URL)
5. **Deploy**:
   - Click **Deploy**.
   - Vercel will build the frontend and serve it with client-side SPA routing (`vercel.json`).

---

## 4. Frontend Deployment (Option B: Netlify)

1. **Sign Up / Log In**: Go to [Netlify](https://netlify.com).
2. **Add New Site**:
   - Click **Add new site > Import an existing project**.
   - Connect to GitHub and select `manojchoudhary2830/p`.
3. **Build Settings**:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. **Environment Variables**:
   - In Site configuration > Environment variables, add:
     - `VITE_BACKEND_URL`: `https://pgbooking-api.onrender.com`
5. **Deploy**:
   - Click **Deploy site**.
   - Routing rewrites are handled by `netlify.toml` and `public/_redirects`.

---

## 5. Post-Deployment Verification

1. **Health Check**:
   - Open `https://<your-backend>.onrender.com/api/health`
   - Check that `database.connected` is `true` and `status` is `PASS`.
2. **Frontend Connectivity**:
   - Open your deployed frontend URL.
   - Verify properties list (Jaipur, Neemrana, Behror, Kotputli) loads from MongoDB Atlas.
   - Test login / registration using demo accounts or new signup.
3. **Update Render CORS**:
   - Ensure Render's `FRONTEND_URL` environment variable matches your final live frontend URL.
