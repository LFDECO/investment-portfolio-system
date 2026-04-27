import axios from "axios";
// We need to simulate the backend environment or just call the same functions if we can.
// Since I can't easily import from schemaApi.ts, I'll reproduce the logic or check the API directly if possible.
// Actually, I can just use a script to call Yahoo Finance directly to see what's happening.

async function test() {
    const symbol = "RELIABLE.NS";
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1mo&interval=1d`;
        console.log("Fetching:", url);
        const { data } = await axios.get(url);
        const result = data?.chart?.result?.[0];
        const timestamps = result?.timestamp;
        const quote = result?.indicators?.quote?.[0];

        if (!timestamps || !quote) {
            console.log("No history found for", symbol);
            return;
        }

        const latestClose = quote.close[quote.close.length - 1];
        console.log("Latest close:", latestClose);
    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

test();
