const fs = require("fs");
const {
  createPoolIndexsQuery,
  createSwapsByPoolQuery,
} = require("../graphQuery");
const { fetchData, batchFetchDataSync } = require("../fetchs");
const BATCH_SIZE = 100;
const ERRORLOG_DIR = `./errorlog.csv`;
const STATE_DIR = "./saveState.json";

async function loadPoolIndex() {
  if (fs.existsSync("./pools.json")) {
    try {
      return JSON.parse(fs.readFileSync("./pools.json", { encoding: "utf-8" }));
    } catch (error) {}
  }

  const reses = await batchFetchDataSync(createPoolIndexsQuery, 1, 10);
  let pools = {};
  for (let i = 0; i < reses.length; i++) {
    reses[i].pools.map((item) => {
      pools[`${item.token0.symbol}-${item.token1.symbol}-${item.feeTier}`] = {
        ...item,
      };
    });
  }
  fs.writeFileSync("pools.json", JSON.stringify(pools));
  return pools;
}

async function loadSwaps(
  token0,
  token1,
  feeTier,
  durationEpoch,
  tamstampBegin,
  tamstampEnd
) {
  // check dir
  if (!fs.existsSync(`./Jsondata/${token0.symbol}-${token1.symbol}-${feeTier}`)) {
    fs.mkdirSync(`./Jsondata/${token0.symbol}-${token1.symbol}-${feeTier}`);
  }

  let promises = [];

  const durationSum = tamstampEnd - tamstampBegin;
  const times = Math.ceil(durationSum / durationEpoch);
  console.log(`durationSum: ${durationSum}\ndurationEpoch: ${durationEpoch}\n`);

  for (let i = 0; i < times; i++) {
    const _begin = tamstampBegin + i * durationEpoch;
    const _end = tamstampBegin + (i + 1) * durationEpoch;

    const _fileName = `./Jsondata/${token0.symbol}-${token1.symbol}-${feeTier}/${_begin}-${_end}.json`;
    if (fs.existsSync(_fileName)) {
      try {
        const _data = JSON.parse(
          fs.readFileSync(_fileName, { encoding: "utf-8" })
        );
        if (_data) {
          promises.push(Promise.resolve(_data));
        }
        break;
      } catch (error) {}
    }
    // we must split the epoch because of the limit of each query is 100.
    const _p = new Promise(async (resolve, reject) => {
      let swaps = [];
      let tmpSwaps = [];
      let skipIndex = 0;
      do {
        tmpSwaps = [];
        const _query = createSwapsByPoolQuery(
          token0.id,
          token1.id,
          feeTier,
          _begin,
          _end,
          skipIndex * BATCH_SIZE,
          BATCH_SIZE
        );
        await fetchData(_query)
          .then((_data) => {
            tmpSwaps = _data && _data.pools[0] && _data.pools[0].swaps;
            const logTxt = `batch epoch ${i}: ${_begin} -- ${_end}, from ${
              skipIndex * BATCH_SIZE
            } to ${(skipIndex + 1) * BATCH_SIZE} , num ${tmpSwaps.length}`;
            if (tmpSwaps && tmpSwaps.length > 0) {
              console.log(logTxt);
              swaps = swaps.concat(tmpSwaps);
            }
          })
          .catch((err) => {
            console.error(err);
            fs.writeFileSync(
              ERRORLOG_DIR,
              `${token0.symbol},${token0.id},${token1.symbol},${token1.id},${feeTier},${_begin},${_end},${i}\n`,
              { flag: "a+" }
            );
            reject(null);
          });
        skipIndex++;
      } while (tmpSwaps && tmpSwaps.length > 0);
      fs.writeFileSync(_fileName, JSON.stringify(swaps));
      resolve(swaps);
    });

    promises.push(_p);
  }
  return Promise.all(promises);
}

async function retryFialdFetch() {
  if (!fs.existsSync(ERRORLOG_DIR)) return;
  try {
    const rows = fs
      .readFileSync(ERRORLOG_DIR, { encoding: "utf-8" })
      .split("\n")
      .concat([]);

    fs.writeFileSync(ERRORLOG_DIR, "");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (!row) return;
      const params = row.split(",");
      let begin, end;
      if (parseInt(params[7]) < 0) {
        begin = parseInt(params[5]);
        end = parseInt(params[6]);
      } else {
        begin = parseInt(params[5]) + parseInt(params[7]) * BATCH_SIZE;
        end = begin + BATCH_SIZE;
      }
      await loadSwaps(
        {
          symbol: params[0],
          id: params[1],
        },
        {
          symbol: params[2],
          id: params[3],
        },
        params[4],
        BATCH_SIZE,
        begin,
        end
      );
    }
  } catch (error) {
    console.error(error);
  }
}

async function main() {
  const now = new Date();
  console.log(now.toString());

  // await retryFialdFetch();
  // return;

  const poolIndexs = await loadPoolIndex();
  let { token0, token1, feeTier, txCount, swaps } = poolIndexs[`USDC-WETH-500`];
  txCount = parseInt(txCount);
  if (!swaps[0] || !swaps[0].timestamp) return;

  const durationEpoch = 1 * 4 * 60 * 60;
  const loopSize = 4;
  // let timestampBegin = parseInt(swaps[0].timestamp);
  let timestampBegin = 1639564124;
  let timestampEnd = timestampBegin + durationEpoch * loopSize;

  while (timestampEnd * 1000 < new Date().getTime()) {
    fs.writeFileSync(
      STATE_DIR,
      JSON.stringify({ timestampBegin, timestampEnd, durationEpoch, loopSize }),
      { flag: "w" }
    );
    await loadSwaps(
      token0,
      token1,
      feeTier,
      durationEpoch,
      timestampBegin,
      timestampEnd
    ).catch((err) => {
      console.error(err);
      console.log(`loadSwaps faild.`);
      console.log(
        `${token0.symbol},${token0.id},${token1.symbol},${token1.id},${feeTier},${timestampBegin},${timestampEnd},-1\n`
      );
    });

    timestampBegin = timestampEnd;
    timestampEnd += durationEpoch * loopSize;
  }

  console.log(`cost time: ${(new Date() - now) / 1000}s`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
