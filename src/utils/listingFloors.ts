import fetch from "node-fetch"
import { getSudoswapFloor } from "./sudoswap";
import { gql, request } from "graphql-request"

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

const definedRequest = gql`
query getWeeklyFloor($collection: String!){
	getDetailedNftStats(
		collectionAddress: $collection,
		networkId: 1
	){
		stats_week1{
			start
			end
			statsNetworkBaseToken{
				listingFloor{
					currentValue
				}
			}
		}
	}
}
`

async function definedFloor(collection: string) {
    const floor = await request("https://api.defined.fi/", definedRequest, {
        collection
    }, {
        "x-api-key": process.env.DEFINED_API_KEY!
    })
    return {
        weeklyMinimum: Number(floor.getDetailedNftStats.stats_week1.statsNetworkBaseToken.listingFloor.currentValue),
    }
}

async function nftbankFloor(collection: string) {
  const now = Math.round(Date.now() / 1e3);
  const weekAgo = now - 604800;
  const weekFloors: number[] = await fetch(
    `https://api.nftbank.run/v1/collection/${collection}/floor/history?networkId=ethereum&interval=daily&window=7d&from=${weekAgo}&to=${now}`,
    {
      headers: {
        "X-API-KEY": process.env.NFTBANK_KEY!,
      },
    }
  ).then(async (r) => {
    return (await r.json()).data.data.map((item: any) =>
      Number(item.floor.eth)
    );
  });
  const currentFloor: number = await fetch(
    `https://api.nftbank.run/v1/collection/${collection}/floor?networkId=ethereum`,
    {
      headers: {
        "X-API-KEY": process.env.NFTBANK_KEY!,
      },
    }
  ).then(async (r) => {
    return Number((await r.json()).data.floor.eth);
  });
  const weeklyMinimum = Math.min(...weekFloors, currentFloor);
  return {
    currentFloor,
    weeklyMinimum,
  };
}

export async function getCurrentAndHistoricalFloor(collectionRaw: string, reservoirApiKey: string){
    const collection = collectionRaw.toLowerCase()
    const [defined, reservoir, sudoswap, nftbank] = 
        await Promise.all([definedFloor(collection), reservoirFloor(collection, reservoirApiKey), getSudoswapFloor(collection), nftbankFloor(collection)])
    let currentFloor = reservoir.currentFloor
    if(sudoswap !== null){
        currentFloor = Math.min(currentFloor, sudoswap)
    }
    console.log("Floor values:", defined.weeklyMinimum, reservoir.weeklyMinimum, sudoswap, currentFloor, nftbank.weeklyMinimum);
    const weeklyMinimum = Math.min(defined.weeklyMinimum, reservoir.weeklyMinimum, currentFloor, nftbank.weeklyMinimum)
    return {
        currentFloor,
        weeklyMinimum
    }
}