import dotenv from 'dotenv';
import fs from 'fs';
import type { ClientCredentialTokenConfig, AccessToken, ModuleOptions, Token } from 'simple-oauth2';
import { ClientCredentials } from 'simple-oauth2';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { Args } from './types.ts';

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

function loadTokenFromFile(): AccessToken | null {
  try {
    const data: string = fs.readFileSync(TOKEN_FILE, 'utf8');
    const parsedData: Token = JSON.parse(data);
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

    const data: ResponseBody = await response.json();
    return data;
  } catch (error) {
    console.error("Error making reuqest: ", error);
  }
}

async function getGid(stopArea: string, token: string): Promise<string> {
  const endpoint: string = `/locations/by-text?q=${stopArea}&limit=1&offset=0&types=stoparea`;
  const data: ResponseBody = await makeRequest(endpoint, token);
  const gid: string = data.results[0].gid;
  return gid;
}


async function getJourneys(originName: string, destinationName: string, token: string): Promise<ResponseBody> {
  const endpoint: string = `/journeys?originGid=${encodeURIComponent(originName)}&destinationGid=${encodeURIComponent(destinationName)}&limit=3`;
  const data: ResponseBody = await makeRequest(endpoint, token);
  return data;
}

async function getDepartures(gid: string, token: string, platforms?: string): Promise<ResponseBody> {
  let endpoint: string = `/stop-areas/${gid}/departures?&limit=5`;
  if (platforms) {
    endpoint += `&platforms=${platforms}`;
  }
  const data: ResponseBody = await makeRequest(endpoint, token);
  return data;
}

function extractTime(timeString: string): string {
  const time: string = timeString.split("T")[1].split(".")[0];
  return time;
}

function calculateTimeInSec(time: string): number {
  const timestamps: string[] = time.split(":");
  const hours: number = parseInt(timestamps[0]) * 60 * 60;
  const minutes: number = parseInt(timestamps[1]) * 60;
  const seconds: number = parseInt(timestamps[2]);
  return hours + minutes + seconds;
}

function formatTime(time: number): string {
  const hours: number = Math.floor(time / (60 * 60));
  const minutes: number = Math.floor(time % (60 * 60) / 60);
  const seconds: number = Math.floor(time % 60 % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getTimeDifference(estimatedTime: string): string {
  const currentTime: string = new Date().toLocaleTimeString("en-GB")
  const arrivalTime: string = extractTime(estimatedTime);
  const timeDifference: number = calculateTimeInSec(arrivalTime) - calculateTimeInSec(currentTime);
  if (timeDifference > 0) {
    return formatTime(timeDifference);
  }
  return "NOW";
}

async function getTramArrivals(stopArea: string, token: string, platform?: string): Promise<void> {
  const gid: string = await getGid(stopArea, token);
  const departures: ResponseBody = await getDepartures(gid, token, platform)
  for (let i: number = 0; i < departures.results.length; i++) {
    const estimatedTime: string = departures.results[i].estimatedOtherwisePlannedTime;
    const line: string = departures.results[i].serviceJourney.line.shortName;
    const direction: string = departures.results[i].serviceJourney.direction;
    const timeBeforeArrival: string = getTimeDifference(estimatedTime);
    console.log("Tram:", line + " " + direction);
    console.log("Arrives in:", timeBeforeArrival + "\n");
  }
}




const argv: Args = yargs(hideBin(process.argv))
  .option("stop", {
    alias: 's',
    type: 'string',
    demandOption: true,
  })
  .option("platform", {
    alias: 'p',
    type: 'string',
  })
  .parseSync();

const client: ClientCredentials = new ClientCredentials(config);
const loadedToken: AccessToken | null = loadTokenFromFile();
const accessToken: AccessToken = await validateToken(loadedToken);
if (accessToken && accessToken.token && accessToken.token.access_token) {
  const token: string = accessToken.token.access_token as string;
  getTramArrivals(argv.stop, token, argv.platform);
}
