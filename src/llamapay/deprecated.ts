import fetch from "node-fetch";
import { findMedian } from "./getPrice";

// only 24h
async function coinpaprika(token:string, start:number, end:number){
    // free plan only allows for 24h of data, we increase start by 100 to make sure we dont end outside of range
    const prices = await fetch(`https://api.coinpaprika.com/v1/coins/${token}/ohlcv/historical?start=${start+100}&end=${end}`).then(r=>r.json())
    return findMedian(prices.map((p:any)=>(p.high+p.low)/2))
}

// endpoint not in free plan
async function cmc(token:string, start:number, end:number){
    const {data} = await fetch(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/historical?id=${token}&time_start=${start}&time_end=${end}`, {
        headers: {
            'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY!,
        }
    }).then(r=>r.json())
    console.log(data[token].quotes)
    return findMedian(data[token].quotes.map((p:any)=>p.quote.USD.price))
}