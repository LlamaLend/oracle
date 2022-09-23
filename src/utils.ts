import fetch from "node-fetch"

export const tubbyAddress = "0xca7ca7bcc765f77339be2d648ba53ce9c8a262bd".toLowerCase()

export async function getFloorNow(){
    const stats = await fetch("https://api.opensea.io/api/v1/collection/tubby-cats/stats?format=json").then(r=>r.json())
    return stats.stats.floor_price
}