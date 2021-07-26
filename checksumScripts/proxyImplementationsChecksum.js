const hre = require("hardhat");
const assert = require('assert');
const { getSavedContractAddresses, getSavedContractProxies, getSavedContractProxyAbis } = require('../scripts/utils')

async function main() {

    await hre.run('compile')

    const contracts = getSavedContractAddresses()[hre.network.name]
    const proxies = getSavedContractProxies()[hre.network.name]
    const abi = getSavedContractProxyAbis()["ProxyAdmin"]
    const admin = await hre.ethers.getContractAt(abi, proxies["ProxyAdmin"])

    const mainBridgeContractName = "ChainportMainBridge"
    const sideBridgeContractName = "ChainportSideBridge"
    let bridgeContractName

    // Detecting which bridge is in use on selected network
    try {
        await hre.ethers.getContractAt(mainBridgeContractName, contracts[mainBridgeContractName])
        bridgeContractName = mainBridgeContractName
        console.log('Network is using main bridge.\n')
    } catch (err) {
        try {
            await hre.ethers.getContractAt(sideBridgeContractName, contracts[sideBridgeContractName])
            bridgeContractName = sideBridgeContractName
            console.log('Network is using side bridge.\n')
        } catch (err) {
            console.log(err.message)
        }
    }

    //console.log(proxyAdminAddress)
    //console.log(proxyAdmin)

    // Get implementations from json
    const bridgeImplementation = contracts[bridgeContractName]
    const validatorImplementation = contracts["Validator"]
    const maintainersRegistryImplementation = contracts["MaintainersRegistry"]

    // Get implementations from proxy admin
    //console.log(getSavedContractProxyAbis()["ProxyAdmin"])
    const adminBridgeImplementation = await admin.getProxyImplementation(proxies[bridgeContractName])
    const adminValidatorImplementation = await admin.getProxyImplementation(proxies["Validator"])
    const adminMaintainersRegistryImplementation = await admin.getProxyImplementation(proxies["MaintainersRegistry"])

    // Compare implementation addresses
    console.log("ProxyAdmin:"," ".repeat(41-"ProxyAdmin:".length),"Config:")
    console.log(bridgeImplementation, adminBridgeImplementation)
    assert.strictEqual(
        bridgeImplementation,
        adminBridgeImplementation,
        "Bridge Not In Sync"
    )
    console.log(validatorImplementation, adminValidatorImplementation)
    assert.strictEqual(
        validatorImplementation,
        adminValidatorImplementation,
        "Validator Not In Sync"
    )
    console.log(maintainersRegistryImplementation, adminMaintainersRegistryImplementation)
    assert.strictEqual(
        maintainersRegistryImplementation,
        adminMaintainersRegistryImplementation,
        "MaintainersRegistry Not In Sync"
    )
    console.log("\nImplementations checksum complete - Implementations are in sync!")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.log(error);
        process.exit(1);
    });
