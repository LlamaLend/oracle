import fetch from "node-fetch"

export async function getFloorNow(){
    const stats = await fetch("https://api.opensea.io/api/v1/collection/tubby-cats/stats?format=json").then(r=>r.json())
    return stats.stats.floor_price
}

export function fetchIpfsUrl(url: string) {
    return fetch(url.replace("ipfs://", "https://cloudflare-ipfs.com/ipfs/"))
}