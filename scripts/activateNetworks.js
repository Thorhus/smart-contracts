const hre = require("hardhat")
const { getSavedContractProxies } = require("./utils")

async function main () {
    // Script for automated activation of supported networks
    // Number of networks needs to be set properly
    const networks = 2
    const proxies = getSavedContractProxies()[hre.network.name]

    const mainBridgeContractName = "ChainportSideBridge"
    const sideBridgeContractName = "ChainportMainBridge"
    let bridge

    // Checking which bridge is in use
    try {
        bridge = await hre.ethers.getContractAt(mainBridgeContractName, proxies[mainBridgeContractName])
        console.log("Network is using main bridge.")
    } catch (err) {
        try {
            bridge = await hre.ethers.getContractAt(sideBridgeContractName, proxies[sideBridgeContractName])
            console.log("Network is using side bridge.")
        } catch (err) {
            console.log(err.message)
        }
    }

    // Activating networks
    console.log("Activating networks...")
    for(let i = 1; i <= networks; i++){
        await bridge.activateNetwork(i)
        console.log("Network " + i + " activated.")
    }
    console.log("Done!")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
