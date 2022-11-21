import fetch from "node-fetch"
import { getSudoswapFloor } from "./sudoswap";

export class ReturnableError extends Error {
    constructor(message:string) {
      super(message);
      this.name = "ReturnableError";
    }
  }

// https://docs.reservoir.tools/reference/geteventscollectionsflooraskv1
// test demo key is 'demo-api-key'
async function reservoirFloor(collection: string, reservoirApiKey: string){
    let continuation;
    const weekAgo = Math.round(Date.now()/1e3 - 7*24*3600);
    let weeklyMinimum, currentFloor = undefined;
    let flashCrashes = 0;
    do{
        // IMPORTANT: collection must be lowercase
        let url = `https://api.reservoir.tools/events/collections/floor-ask/v1?collection=${collection}&startTimestamp=${weekAgo}&sortDirection=desc&limit=1000`
        if(continuation !== undefined){
            url += `&continuation=${continuation}`
        }
        const changes = await fetch(url, {
            headers: {
                'x-api-key': reservoirApiKey 
            }
        }).then(r => r.json());
        const floors = (changes.events as any[]).filter((event, i, list)=>{
            if(i === 0){
                return true
            }
            const next = list[i-1]
            if(
                // update lasted longer than 50s
                (new Date(next.event.createdAt).getTime() - new Date(event.event.createdAt).getTime()) < 50e3 &&
                // it's a flash crash
                event.floorAsk.price < (0.9 * event.event.previousPrice) &&
                event.floorAsk.price < (0.9 * next.floorAsk.price)
            ){
                flashCrashes++;
                return false
            }
            return true
        }).map((event:any)=> event.floorAsk.price)
        if(floors.length < (changes.events.length - 10)){
            throw new Error(`We are dropping too many events on ${collection} data from Reservoir`)
        }
        if(flashCrashes > 10){ // > 500s
            throw new Error("Too many flash crashes")
        }
        if(currentFloor === undefined){
            // First run
            currentFloor = floors[0]
            weeklyMinimum = floors[0]
        }
        const oldestPrice = changes.events[changes.events.length-1].event.previousPrice
        weeklyMinimum = Math.min(weeklyMinimum, ...floors, oldestPrice)
        continuation = changes.continuation;
    } while(continuation !== null)
    if(currentFloor === undefined){
        throw new ReturnableError(`Can't find any historical data for ${collection} on Reservoir`)
    }
    return {
        currentFloor,
        weeklyMinimum
    }
}

const date2utc = (d:Date) => encodeURIComponent(d.toISOString())

// https://docs.nftgo.io/reference/get_floor_price_chart_eth_v1_collection__contract_address__chart_floor_price_get-1
async function nftGoFloor(collection: string) {
    const apiKeys = [
        process.env.NFTGO_API_KEY1!,
        process.env.NFTGO_API_KEY2!,
        process.env.NFTGO_API_KEY3!,
        process.env.NFTGO_API_KEY4!,
        process.env.NFTGO_API_KEY5!
    ];
    let apiInd = 0;
    const now = new Date();
    // separate nftgo api in 2 requests because if you request <4 days you get many more datapoints
    const day3ago = new Date(Number(now) - 3*24*3600e3);
    const weekAgo = new Date(Number(day3ago) - 4*24*3600e3);
    
    let callResults = await nftGoQueries(collection, apiKeys[0], now, day3ago, weekAgo);
    while (callResults === null) {
        apiInd++;
        if (apiInd === apiKeys.length) throw new ReturnableError("Out of API keys");
        callResults = await nftGoQueries(collection, apiKeys[apiInd], now, day3ago, weekAgo);
    }

    const currentFloorApiGo = callResults[0];
    const historicalFloorApiGo4d = callResults[1];
    const historicalFloorApiGo3d = callResults[2];

    if (currentFloorApiGo.floor_price.crypto_unit !== "ETH") {
        throw new ReturnableError(`Floor of ${collection} in NftGo API is not priced in ETH`)
    }
    const currentFloor = currentFloorApiGo.floor_price.value;
    return {
        currentFloor,
        weeklyMinimum: Math.min(...historicalFloorApiGo4d.y, ...historicalFloorApiGo3d.y, currentFloor)
    }
}

async function nftGoQueries(collection: string, nftGoApi: string, now : Date, day3ago: Date, weekAgo: Date) {
    const nftgoReq = (url:string) => fetch(url, {
        headers: {
            'X-API-KEY': nftGoApi
        }
    }).then(r => {
        if(r.status===404){
            throw new ReturnableError("Collection not supported by NFTGo")
        } else {
            return r.json()
        }
    });
    const [currentFloorApiGo, historicalFloorApiGo4d, historicalFloorApiGo3d] = await Promise.all([
        nftgoReq(`https://data-api.nftgo.io/eth/v1/collection/${collection}/metrics`),
        nftgoReq(`https://data-api.nftgo.io/eth/v1/collection/${collection}/chart/floor-price?start_time=${date2utc(day3ago)}&end_time=${date2utc(now)}`),
        nftgoReq(`https://data-api.nftgo.io/eth/v1/collection/${collection}/chart/floor-price?start_time=${date2utc(weekAgo)}&end_time=${date2utc(day3ago)}`),
    ])

    if (
      currentFloorApiGo.msg === "Quota Limit Exceeded" ||
      historicalFloorApiGo4d.msg === "Quota Limit Exceeded" ||
      historicalFloorApiGo3d.msg === "Quota Limit Exceeded"
    ) {
      return null;
    } else {
      return [
        currentFloorApiGo,
        historicalFloorApiGo4d,
        historicalFloorApiGo3d,
      ];
    }
    
}

export async function getCurrentAndHistoricalFloor(collectionRaw: string, reservoirApiKey: string){
    const collection = collectionRaw.toLowerCase()
    const [nftgo, reservoir, sudoswap] = 
        await Promise.all([nftGoFloor(collection), reservoirFloor(collection, reservoirApiKey), getSudoswapFloor(collection)])
    let currentFloor = Math.min(nftgo.currentFloor, reservoir.currentFloor)
    if(sudoswap !== null){
        currentFloor = Math.min(currentFloor, sudoswap)
    }
    console.log("Floor values:", nftgo.weeklyMinimum, reservoir.weeklyMinimum, sudoswap, currentFloor)
    const weeklyMinimum = Math.min(nftgo.weeklyMinimum, reservoir.weeklyMinimum, currentFloor)
    return {
        currentFloor,
        weeklyMinimum
    }
}