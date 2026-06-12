import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());

// Simulador de Base de Datos para Refresh Tokens (en memoria)
// En producción, usar Cloud SQL, Firestore, etc.
const tokenDatabase = new Map<string, string>();

app.post('/api/auth/token', (req, res) => {
    // Aquí recibimos el token de acceso o refresh token desde el cliente
    // y lo vinculamos con el "usuario" (simulado usando un token fijo o el req.headers)
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { accessToken } = req.body;
    if (token && accessToken) {
        // Usamos el token enviado en la cabecera como llave temporal (simulando Auth guard)
        tokenDatabase.set(token, accessToken);
        res.json({ ok: true, message: 'Token guardado de forma segura en servidor' });
    } else {
        res.status(400).json({ error: 'Missing token' });
    }
});

app.get('/api/auth/token', (req, res) => {
    // Recuperar token seguro desde la DB
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token && tokenDatabase.has(token)) {
        res.json({ ok: true, accessToken: tokenDatabase.get(token) });
    } else {
        res.status(404).json({ error: 'Token not found or expired' });
    }
});

app.post('/api/log', (req, res) => {
    console.error("CLIENT-SIDE LOG:", req.body);
    import('fs').then(fs => {
        fs.appendFileSync('client-error.log', JSON.stringify(req.body) + '\n');
    });
    res.json({ok: true});
});


/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
