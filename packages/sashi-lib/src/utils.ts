import crypto from "crypto"
import { Request, Response } from "express"
import { ParamsDictionary } from "express-serve-static-core"
import { ParsedQs } from "qs"

const packaging = require("../package.json")

const version = packaging.version

export const createSashiHtml = (
  baseUrl: string,
  sessionToken?: string
) => /* HTML */ `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Sashi App</title>
    </head>
    <body>
      <div id="root"></div>
      <script>
        window.__INITIAL_STATE__ = {
          apiUrl: "${baseUrl}",
          basename: "${baseUrl}/bot",
          sessionToken: "${sessionToken}"
        };
      </script>

      <link
        rel="stylesheet"
        href="https://unpkg.com/@sashimo/ui@${version}/dist/styles.css"
      />
      <script
        type="module"
        src="https://unpkg.com/@sashimo/client@${version}/dist/main.mjs"
        crossorigin
      ></script>
    </body>
  </html>`


export const isEven = (n: number) => {
  return n % 2 == 0;
};
export const trim_array = (arr: string | any[], max_length = 20) => {
  let new_arr = arr;

  if (arr.length > max_length) {
    let cutoff = Math.ceil(arr.length - max_length);
    cutoff = isEven(cutoff) ? cutoff : cutoff + 1;

    new_arr = arr.slice(cutoff);
  }

  return new_arr;
};

export const createSessionToken = async (
  req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>,
  res: Response<any, Record<string, any>>,
  getSession?: (req: Request, res: Response) => Promise<string>
) => {
  if (getSession) {
    return await getSession(req, res);
  }

  const sessionToken = crypto.randomUUID();
  return sessionToken;
};

// New secure session token utilities
export const createSecureSessionToken = (
  sessionData: Record<string, any>,
  secret: string,
  expiresIn: number = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
): string => {
  const payload = {
    ...sessionData,
    iat: Date.now(),
    exp: Date.now() + expiresIn
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('hex');

  return `${payloadBase64}.${signature}`;
};

export const validateSecureSessionToken = (
  token: string,
  secret: string
): { valid: boolean; payload?: Record<string, any>; error?: string } => {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [payloadBase64, signature] = parts;

    if (!payloadBase64 || !signature) {
      return { valid: false, error: 'Invalid token format' };
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('hex');

    const signatureBuffer = new Uint8Array(Buffer.from(signature, 'hex'));
    const expectedBuffer = new Uint8Array(Buffer.from(expectedSignature, 'hex'));

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Parse payload
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

    // Check expiration
    if (payload.exp && Date.now() > payload.exp) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: 'Token validation failed' };
  }
};

/**
 * Ensures a URL has either http:// or https:// protocol
 * @param url The URL to validate and potentially modify
 * @returns A URL with proper protocol
 */
export const ensureUrlProtocol = (url: string): string => {
  if (!url) return url;

  // Remove any leading/trailing whitespace
  url = url.trim();

  // Check for malformed double protocols first
  const hasDoubleProtocol = url.match(/^https?:\/\/https?:\/\//);

  if (hasDoubleProtocol) {
    // Remove all protocol prefixes and start fresh
    url = url.replace(/^(https?:\/\/)+/g, '');
  } else if (url.startsWith('http://') || url.startsWith('https://')) {
    // Single valid protocol, return as is
    return url;
  }

  // Remove leading slashes
  url = url.replace(/^\/+/, '');

  // If the cleaned URL is empty after removing protocols, return empty
  if (!url) return '';

  // Default to https:// if no protocol is specified
  return `https://${url}`;
};

