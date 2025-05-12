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

/**
 * Ensures a URL has either http:// or https:// protocol
 * @param url The URL to validate and potentially modify
 * @returns A URL with proper protocol
 */
export const ensureUrlProtocol = (url: string): string => {
  if (!url) return url;

  // If URL already has a protocol, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Default to https:// if no protocol is specified
  return `https://${url.replace(/^\/+/, '')}`;
};

