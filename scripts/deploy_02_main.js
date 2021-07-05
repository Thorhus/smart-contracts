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


    const ChainportMainBridge = await ethers.getContractFactory('ChainportMainBridge')
    const chainportMainBridge = await upgrades.deployProxy(ChainportMainBridge,[
        maintainersRegistry.address,
        contracts.ChainportCongress,
        validator.address,
        config.timeLockLength, // 3600 secs timelock
        config.safetyThreshold // safety threshold 20%
    ]);
    await chainportMainBridge.deployed()
    saveContractProxies(hre.network.name, "ChainportMainBridge", chainportMainBridge.address);
    console.log("ChainportMainBridge proxy deployed to:", chainportMainBridge.address);

    let admin = await upgrades.admin.getInstance();

    let maintainersImplementation = await admin.getProxyImplementation(maintainersRegistry.address);
    console.log('Maintainers Implementation: ', maintainersImplementation);
    saveContractAddress(hre.network.name, 'MaintainersRegistry', maintainersImplementation);

    let validatorImplementation = await admin.getProxyImplementation(validator.address)
    console.log('Validator Implementation: ', validatorImplementation);
    saveContractAddress(hre.network.name, 'Validator', validatorImplementation)

    let bridgeImplementation = await admin.getProxyImplementation(chainportMainBridge.address);
    console.log('Bridge Implementation: ', bridgeImplementation);
    saveContractAddress(hre.network.name, 'ChainportMainBridge', bridgeImplementation);

    saveContractProxies(hre.network.name, 'ProxyAdmin', admin.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
