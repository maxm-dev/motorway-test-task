import {getExternalPrice} from "./get-external-price";
import {client} from "./init-redis";

const PRICE_CACHE_HASH_NAME = "prices";
const INFLIGHT_REQUESTS_SET_NAME = "inflight-requests";

type Price = number;

async function getFromPriceCache(numberPlate: string): Promise<Price | null> {
  const price = await client.hGet(PRICE_CACHE_HASH_NAME, numberPlate);

  return price != null ? +price : null;
}

async function setPriceCache(numberPlate: string, price: number): Promise<void> {
  await client.hSet(PRICE_CACHE_HASH_NAME, numberPlate, price);
}

async function isRequestInProgress(numberPlate: string): Promise<boolean> {
  return await client.sIsMember(INFLIGHT_REQUESTS_SET_NAME, numberPlate);
}

async function setRequestInProgress(numberPlate: string): Promise<void> {
  await client.sAdd(INFLIGHT_REQUESTS_SET_NAME, numberPlate);
}

async function completeRequest(numberPlate: string): Promise<void> {
  await client.sRem(INFLIGHT_REQUESTS_SET_NAME, numberPlate);
}

async function broadcastPrice(numberPlate: string, price: Price): Promise<void> {
  await client.publish(numberPlate, price.toString());
}

async function waitRequestResult(numberPlate: string): Promise<Price> {
  return new Promise<Price>(async (resolve) => {
    const subscriber = client.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(numberPlate, (message: string) => {
      resolve(+message);
      subscriber.unsubscribe(numberPlate);
    })
  })
}

async function retrievePrice(numberPlate: string): Promise<Price> {
  // Mark request as INFLIGHT so other instances on App know that request to 3rd party API is in progress.
  await setRequestInProgress(numberPlate);

  // Call 3rd party API.
  const price = await getExternalPrice(numberPlate);

  // Remove request from INFLIGHT requests cache.
  await completeRequest(numberPlate);

  // Set result to cache to prevent repeated call to 3rd party API.
  await setPriceCache(numberPlate, price);

  // Notify other instances of App with result from 3rd party API call.
  // It handles cases when App get calls for the same numberPlate simultaneously.
  await broadcastPrice(numberPlate, price);

  return price;
}

export async function getPrice(numberPlate: string, skipCacheForRead: boolean = true): Promise<Price> {
  // If caller wants to skip getting result from cache, then just skip.
  if (skipCacheForRead) {
    return retrievePrice(numberPlate);
  }

  // Check if request was sent by other instances of the App.
  const isInProgress = await isRequestInProgress(numberPlate);
  if (isInProgress) {
    // Subscribe on channel and wait for notification from other instances.
    // THIS IS POTENTIALLY UNSAFE, because other instances could fail for some reason.
    // This potential issue is not handled for simplicity, but in real world it's better to add timeout
    // and fallback to call to 3rd party API (call retrievePrice function)
    return waitRequestResult(numberPlate);
  }

  const cachedPrice = await getFromPriceCache(numberPlate);

  if (cachedPrice === null) {
    return retrievePrice(numberPlate);
  }

  return cachedPrice;
}


async function main() {
  client.on("error", (error) => {
    console.log(error);
  })

  await client.connect();

  // To check it live
  //makeTestRequests();
}

function makeTestRequests() {
  const numberPlate = "test11";
  const skipCache = false;

  const test1Promise = getPrice(numberPlate, skipCache);

  setTimeout(async () => {
    const test2Promise = getPrice(numberPlate, skipCache);

    const test1 = await test1Promise;
    console.log("First call: ", test1);

    const test2 = await test2Promise;
    console.log("Second call: ", test2);
  }, 100);
}

main();