import dotenv from 'dotenv';
import fs from 'fs';
import type { ClientCredentialTokenConfig, AccessToken, ModuleOptions } from 'simple-oauth2';
import { ClientCredentials } from 'simple-oauth2';

dotenv.config();

const apiBaseUrl: string = "https://ext-api.vasttrafik.se";
const apiPrefix: string = "/pr/v4";
const clientId: string = process.env.CLIENT_ID as string;
const clientSecret: string = process.env.CLIENT_SECRET as string;
const TOKEN_FILE: string = './accessToken.json';

const config: ModuleOptions = {
  client: {
    id: clientId,
    secret: clientSecret
  },
  auth: {
    tokenHost: apiBaseUrl,
    tokenPath: '/token'
  }
};

const tokenConfig: ClientCredentialTokenConfig = {
  scope: ""
};

// TODO: Implement proper type for parsed data
type TokenData = any;

function loadTokenFromFile(): AccessToken | null {
  try {
    const data: string = fs.readFileSync(TOKEN_FILE, 'utf8');
    const parsedData: TokenData = JSON.parse(data);
    if (parsedData && parsedData.access_token) {
      return client.createToken(parsedData);
    }
    return null;
  } catch (error) {
    console.error("Error loading token from file: ", error);
    return null;
  }
}

function saveTokenToFile(token: AccessToken): void {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(token));
    console.log("Token saved to file");
  } catch (error) {
    console.error("Error saving token to file: ", error);
  }
}

async function validateToken(loadedToken: AccessToken | null): Promise<AccessToken> {
  // If no saved Token generate new
  if (!loadedToken) {
    return generateToken();
  }

  // If loaded token is expired generate new
  if (loadedToken.expired()) {
    return generateToken();
  }

  return loadedToken;
}

async function generateToken(): Promise<AccessToken> {
  const accessToken: AccessToken = await client.getToken(tokenConfig);
  saveTokenToFile(accessToken);
  return accessToken;
}

// TODO: Implement proper type for response data
type ResponseBody = any

async function makeRequest(endpoint: string, token: string): Promise<ResponseBody> {
  try {
    const response: Response = await fetch(apiBaseUrl + apiPrefix + endpoint, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Request error! Status: ${response.status}`);
    }

    const data: ResponseBody = await response.json();
    return data;
  } catch (error) {
    console.error("Error making reuqest: ", error);
  }
}

async function getStopArea(stopArea: string, token: string): Promise<ResponseBody> {
  const endpoint: string = `/locations/by-text?q=${stopArea}&limit=1&offset=0&types=stoparea`;
  const data: ResponseBody = await makeRequest(endpoint, token);
  return data;
}

const client: ClientCredentials = new ClientCredentials(config);
const loadedToken: AccessToken | null = loadTokenFromFile();
const accessToken: AccessToken = await validateToken(loadedToken);
if (accessToken && accessToken.token && accessToken.token.access_token) {
  const token: string = accessToken.token.access_token as string;
  const stopArea: string = "friskväderstorget";
  const data: ResponseBody = await getStopArea(stopArea, token);
  console.log(data);
}
