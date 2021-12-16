function createPoolIndexsQuery(skip, limit) {
  let query = `{
      pools(
        where: {
          token0: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
          token1: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
        }
      ) {
        id
        feeTier
        createdAtTimestamp
        token0 {
          id
          symbol
        }
        token1 {
          id
          symbol
        }
        txCount
        swaps (
          orderBy: $timestamp,
          orderDirection: asc,
          first: 1
        ) {
          id
          timestamp
        }
      }
    }
    `;
  return query;
}

function createSwapsByPoolQuery(token0, token1, feeTier, tamstamp_begin, tamstamp_end, skip, limit) {
  let query = `{
    pools(
      where: {
        token0: "${token0}"
        token1: "${token1}"
        feeTier: "${feeTier}"
      }
    ) {
      id
      feeTier
      createdAtTimestamp
      token0 {
        id
        symbol
      }
      token1 {
        id
        symbol
      }
      txCount
      swaps (
        orderBy: timestamp
        orderDirection: asc
        skip: ${skip}
        first: ${limit}
        where: {
          timestamp_gte: ${tamstamp_begin}
          timestamp_lt: ${tamstamp_end}
        }
      ) {
          # transaction hash + "#" + index in swaps Transaction array
          id
          # pointer to transaction
          transaction {
            # txn hash
            id
            # block txn was included in
            blockNumber
            # timestamp txn was confirmed
            timestamp
            # gas used during txn execution
            gasUsed
            gasPrice
            # derived values
            mints
            burns
            swaps
            flashed
            collects
          }
          # timestamp of transaction
          timestamp
          # sender of the swap
          sender
          # recipient of the swap
          recipient
          # txn origin
          origin # the EOA that initiated the txn
          # delta of token0 swapped
          amount0
          # delta of token1 swapped
          amount1
          # derived info
          amountUSD
          # The sqrt(price) of the pool after the swap, as a Q64.96
          sqrtPriceX96
          # the tick after the swap
          tick
          # index within the txn
          logIndex
      }
    }
  }
  `;
  return query;
}

module.exports = {
  createPoolIndexsQuery,
  createSwapsByPoolQuery,
};
