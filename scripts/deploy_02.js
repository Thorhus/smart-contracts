const hre = require("hardhat");
const { hexify, toChainportDenomination } = require('../test/setup');
const { getSavedContractAddresses, saveContractAddress, saveContractProxies, getSavedContractProxies} = require('./utils')
let c = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');
    const config = c[hre.network.name];
    const contracts = getSavedContractAddresses()[hre.network.name];

    const MaintainersRegistry = await ethers.getContractFactory('MaintainersRegistry')
    const maintainersRegistry = await upgrades.deployProxy(MaintainersRegistry, [config.maintainers, contracts.ChainportCongress]);
    await maintainersRegistry.deployed()
    saveContractProxies(hre.network.name, "MaintainersRegistry", maintainersRegistry.address);
    console.log('MaintainersRegistry Proxy deployed to:', maintainersRegistry.address);


    const Validator = await ethers.getContractFactory('Validator');
    const validator = await upgrades.deployProxy(
        Validator, [
            config.signatoryAddress,
            maintainersRegistry.address,
            contracts.ChainportCongress
        ]
    );
    await validator.deployed()
    saveContractProxies(hre.network.name, "Validator", validator.address);
    console.log('Validator Proxy deployed to:', validator.address);


    const ChainportBridgeEth = await ethers.getContractFactory('ChainportBridgeEth')
    const chainportBridgeEth = await upgrades.deployProxy(ChainportBridgeEth,[
        maintainersRegistry.address,
        contracts.ChainportCongress,
        validator.address,
        config.timeLockLength, // 3600 secs timelock
        config.safetyThreshold // safety threshold 20%
    ]);
    await chainportBridgeEth.deployed()
    saveContractProxies(hre.network.name, "ChainportBridgeEth", chainportBridgeEth.address);
    console.log("ChainportBridgeEth contract deployed to:", chainportBridgeEth.address);

    let admin = await upgrades.admin.getInstance();

    let maintainersImplementation = await admin.getProxyImplementation(maintainersRegistry.address);
    console.log('Maintainers Implementation: ', maintainersImplementation);
    saveContractAddress(hre.network.name, 'MaintainersRegistry', maintainersImplementation);

    let validatorImplementation = await admin.getProxyImplementation(validator.address)
    console.log('Validator Implementation: ', validatorImplementation);
    saveContractAddress(hre.network.name, 'Validator', validatorImplementation)

    let bridgeImplementation = await admin.getProxyImplementation(chainportBridgeEth.address);
    console.log('Bridge Implementation: ', bridgeImplementation);
    saveContractAddress(hre.network.name, 'ChainportBridgeEth', bridgeImplementation);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
