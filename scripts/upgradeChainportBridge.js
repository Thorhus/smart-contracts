const hre = require('hardhat')
const { getSavedContractAddresses, saveContractAddress , getSavedContractProxies, getSavedContractProxyAbis } = require('./utils')

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
    await hre.run('compile')
    const proxyAdmin = getSavedContractProxies()[hre.network.name]['ProxyAdmin']
    const proxyAdminAbi = getSavedContractProxyAbis()['ProxyAdmin']

    const contracts = getSavedContractAddresses()[hre.network.name]
    const mainBridgeContractName = 'ChainportMainBridge'
    const sideBridgeContractName = 'ChainportSideBridge'
    let contractName

    // Detecting which bridge is in use on selected network
    try {
        await hre.ethers.getContractAt(mainBridgeContractName, contracts[mainBridgeContractName])
        contractName = mainBridgeContractName
        console.log('Network is using main bridge.\n')
    } catch (err) {
        try {
            await hre.ethers.getContractAt(sideBridgeContractName, contracts[sideBridgeContractName])
            contractName = sideBridgeContractName
            console.log('Network is using side bridge.\n')
        } catch (err) {
            console.log(err.message)
        }
    }

    const proxyAddress = getSavedContractProxies()[hre.network.name][contractName]
    const oldImplementation = getSavedContractAddresses()[hre.network.name][contractName]

    console.log('Upgrading proxy...')
    const contract = await hre.ethers.getContractFactory(contractName)
    const deployment = await contract.deploy()
    await deployment.deployed()

    let admin = await hre.ethers.getContractAt(proxyAdminAbi, proxyAdmin)
    await admin.upgrade(proxyAddress, deployment.address)
    console.log('Proxy upgraded.\n')

    console.log('Waiting for a new block...')
    let implementation = oldImplementation
    while(implementation === oldImplementation){
        await sleep(5000)
        implementation = await admin.getProxyImplementation(proxyAddress)
        console.log('Still waiting...')
    }
    console.log('Block arrived.\n')

    console.log('Implementation changed successfully.')
    console.log('Bridge proxy -> ', proxyAddress)
    console.log('Old implementation -> ', oldImplementation)
    console.log('New implementation -> ', implementation, '\n')

    saveContractAddress(hre.network.name, contractName, implementation)
    console.log('New implementation address saved successfully.\n')

    console.log('Upgrade complete.')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
