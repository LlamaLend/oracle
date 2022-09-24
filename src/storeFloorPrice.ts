import ddb from './utils/dynamodb'
import { getCurrentAndHistoricalFloor } from './utils/listingFloors';

const collections = [
  [1, "0xCa7cA7BcC765F77339bE2d648BA53ce9c8a262bD"], // tubby cats
] as [number, string][]

const TOTAL_RETRIES = 3;

const handler = async (_event: any) => {
  await Promise.all(collections.map(async ([chainId, collectionRaw]) => {
    const collection = collectionRaw.toLowerCase()
    for (let i = 0; i < TOTAL_RETRIES; i++) {
      try {
        // todo: optimize by only getting current floor
        const { currentFloor } = await getCurrentAndHistoricalFloor(collection, process.env.NFTGO_API_KEY!, process.env.RESERVOIR_API_KEY!)
        const now = Date.now()
        await ddb.put({
          PK: `floor#${chainId}#${collection}`,
          SK: now,
          floor: currentFloor,
        })
        return
      } catch (e) {
        // todo: send alert
        // try again
      }
      // All tries failed, we could be getting attacked, store a 0 to disable oracle
      await ddb.put({
        PK: `floor#${chainId}#${collection}`,
        SK: Date.now(),
        floor: 0,
        error: true,
      })
    }
  }))
};

export default handler;
