# Smart Contracts

Implementation of Chainport protocol

[![codecov](https://codecov.io/gh/chainport/smart-contracts/branch/master/graph/badge.svg?token=EDOX8YQHGI)](https://codecov.io/gh/chainport/smart-contracts)

### Developer instructions

#### Instal dependencies
`yarn install`

#### Create .env file and make sure it's having following information:
```
PK=YOUR_PRIVATE_KEY 
USERNAME=2key
```

#### Create deployments folder
`$ mkdir deployments`

#### Compile code
- `npx hardhat clean` (Clears the cache and deletes all artifacts)
- `npx hardhat compile` (Compiles the entire project, building all artifacts)

#### Test code
- `npx hardhat node` (Starts a JSON-RPC server on top of Hardhat Network)
- `npx hardhat test` (Starts the test)

#### Deploy code
- `npx hardhat node` (Starts a JSON-RPC server on top of Hardhat Network)
- `npx hardhat run --network {network} scripts/{desired_deployment_script}`
- `rm -r .openzeppelin`
- `rm -r cache`
- `rm -r artifacts`
- `npx hardhat run --network ropstenStaging scripts/deploy_01.js`
- `npx hardhat run --network ropstenStaging scripts/deploy_02.js`
- `npx hardhat run --network binancetestStaging scripts/deploy_01.js`
- `npx hardhat run --network binancetestStaging scripts/deploy_02_binance.js`
- `npx hardhat run --network ropstenStaging tenderly/tenderly_push.js`
- `npx hardhat run --network binancetestStaging tenderly/tenderly_push.js`

#### Tenderly push
- Generate tenderly access key on the https://dashboard.tenderly.co
- Add access key to .env file as: 
  ```
  ACCESS_KEY=<YOUR_ACCESS_KEY>
  ```
- `npx hardhat run --network {network} tenderly/tenderly_push.js`


#### Flatten contracts
- `npx hardhat flatten` (Flattens and prints contracts and their dependencies)


#### Deployed addresses and bytecodes
All deployed addresses and bytecodes can be found inside `deployments/` folder.

