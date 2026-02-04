import { generateSW } from "workbox-build";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

async function generateServiceWorker() {
  try {
    const { count, size, warnings } = await generateSW({
      globDirectory: join(rootDir, ".output/public"),
      globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}"],
      swDest: join(rootDir, ".output/public/sw.js"),
      navigateFallback: null,
      clientsClaim: true,
      skipWaiting: true,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "google-fonts-cache",
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "gstatic-fonts-cache",
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          urlPattern: /\/api\/.*/i,
          handler: "NetworkFirst",
          options: {
            cacheName: "api-cache",
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 5, // 5 minutes
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
      ],
    });

    console.log(`✅ Service Worker generated successfully!`);
    console.log(`📦 Precached ${count} files, totaling ${size} bytes.`);

    if (warnings.length > 0) {
      console.warn("⚠️  Warnings:", warnings);
    }
  } catch (error) {
    console.error("❌ Error generating service worker:", error);
    process.exit(1);
  }
}

generateServiceWorker();
