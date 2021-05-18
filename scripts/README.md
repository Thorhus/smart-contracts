# Chainport Scripts

Usage of chainport scripts

### Developer Instructions

#### How to use upgradability scripts
1. Rename a new version of contract to contractNameV2 (ex. bridgeEth.sol -> bridgeEthV2.sol)
2. Run upgrade script for specific contract
3. Rename contract back to its original name (ex. bridgeEthV2.sol -> bridgeEth.sol)

#### How to use encodedParams.js
Ex. Token Transfer
- `node encodeParams.js 'address,uint256' '0xf3B39c28bF4c5c13346eEFa8F90e88B78A610381,1500000000000000000000000'`
