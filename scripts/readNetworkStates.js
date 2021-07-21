const hre = require("hardhat")
const { getSavedContractProxies } = require("./utils")

async function main () {
    // Script for checking all network states of supported networks on selected blockchain
    // Number of networks needs to be updated
    const networks = 5
    const contracts = getSavedContractProxies()[hre.network.name]

    const mainBridgeContractName = "ChainportMainBridge"
    const sideBridgeContractName = "ChainportSideBridge"
    let bridge

    // Checking which bridge is in use
    try {
        bridge = await hre.ethers.getContractAt(mainBridgeContractName, contracts[mainBridgeContractName])
        console.log("Network is using main bridge.")
    } catch (err) {
        try {
            bridge = await hre.ethers.getContractAt(sideBridgeContractName, contracts[sideBridgeContractName])
            console.log("Network is using side bridge.")
        } catch (err) {
            console.log(err.message)
        }
    }

    // Activating networks
    console.log("Network Id -> Activity State")
    console.log("----------------------------")
    for(let i = 0; i <= networks; i++){
        let state = await bridge.isNetworkActive(i)
        state = state === true?"active":"inactive"
        console.log("Network " + i + " -> " + state)
    }
    console.log("Done!")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
