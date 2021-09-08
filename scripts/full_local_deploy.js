const hre = require('hardhat');
const { saveContractAddress, saveContractProxies } = require('./utils.js');
const { hexify, upgrades } = require('../test/setup');
const network = 'local';
const config = require('../deployments/deploymentConfig.json')[network];
const chains = ['Binance','Polygon'];

async function main() {
    await hre.run('compile');

    const ChainportCongress = await hre.ethers.getContractFactory('ChainportCongress');
    const ChainportCongressMembersRegistry = await hre.ethers.getContractFactory('ChainportCongressMembersRegistry');
    const MaintainersRegistry = await hre.ethers.getContractFactory('MaintainersRegistry');
    const Validator = await hre.ethers.getContractFactory('Validator');
    const ChainportMainBridge = await hre.ethers.getContractFactory('ChainportMainBridge');
    const ChainportSideBridge = await hre.ethers.getContractFactory('ChainportSideBridge');

    // To simplify the things, we will use one congress contract for all networks
    // Deploy congress
    const chainportCongress = await ChainportCongress.deploy();
    await chainportCongress.deployed();
    console.log('ChainportCongress contract deployed to:', chainportCongress.address);
    saveContractAddress(network, 'ChainportCongress', chainportCongress.address);

    // Deploy congress members registry
    const chainportCongressMembersRegistry = await ChainportCongressMembersRegistry.deploy(
        config.initialCongressMembers,
        hexify(config.initialCongressMembersNames),
        chainportCongress.address
    );
    await chainportCongressMembersRegistry.deployed();
    console.log('ChainportCongressMembersRegistry contract deployed to:', chainportCongressMembersRegistry.address);
    saveContractAddress(network, 'ChainportCongressMembersRegistry', chainportCongressMembersRegistry.address);

    // Set congress members registry
    await chainportCongress.setMembersRegistry(chainportCongressMembersRegistry.address);
    console.log('ChainportCongress.setMembersRegistry(',chainportCongressMembersRegistry.address,') set successfully.');

    // Maintainers registry
    const maintainersRegistry = await upgrades.deployProxy(MaintainersRegistry, [config.maintainers, chainportCongress.address]);
    await maintainersRegistry.deployed()
    saveContractProxies(network, 'MaintainersRegistry proxy deployed to:', maintainersRegistry.address);
    console.log('MaintainersRegistry Proxy deployed to:', maintainersRegistry.address);

    const admin = await upgrades.admin.getInstance();

    const maintainersImplementation = await admin.getProxyImplementation(maintainersRegistry.address);
    saveContractAddress(network, 'MaintainersRegistry', maintainersImplementation);
    console.log('MaintainersRegistry implementation deployed to: ', maintainersImplementation);

    // Validator
    const validator = await upgrades.deployProxy(
        Validator, [
            config.signatoryAddress,
            maintainersRegistry.address,
            chainportCongress.address
        ]
    );
    await validator.deployed()
    saveContractProxies(network, 'Validator', validator.address);
    console.log('Validator Proxy deployed to:', validator.address);
    const validatorImplementation = await admin.getProxyImplementation(validator.address)
    console.log('Validator implementation deployed to:', validatorImplementation);
    saveContractAddress(network, 'Validator', validatorImplementation)

    // MainBridge
    const chainportMainBridge = await upgrades.deployProxy(ChainportMainBridge,[
        maintainersRegistry.address,
        chainportCongress.address,
        validator.address
    ]);
    await chainportMainBridge.deployed()
    saveContractProxies(network, 'ChainportMainBridge', chainportMainBridge.address);
    console.log('ChainportMainBridge proxy deployed to:', chainportMainBridge.address);
    const mainBridgeImplementattion = await admin.getProxyImplementation(chainportMainBridge.address);
    console.log('ChainportMainBridge implementation deployed to: ', mainBridgeImplementattion);
    saveContractAddress(network, 'ChainportMainBridge', mainBridgeImplementattion);

    // SideBridge
    for(let i = 0; i < chains.length; i++) {
        const chainportSideBridge = await upgrades.deployProxy(ChainportSideBridge,[
            chainportCongress.address,
            maintainersRegistry.address
        ]);
        await chainportSideBridge.deployed();
        saveContractProxies(network, 'ChainportSideBridge' + chains[i], chainportSideBridge.address);
        console.log('ChainportSideBridge' + chains[i] + 'proxy deployed to:', chainportSideBridge.address);
        let bridgeImplementation = await admin.getProxyImplementation(chainportSideBridge.address);
        console.log('ChainportSideBridge' + chains[i] + 'implementation deployed to: ', bridgeImplementation);
        saveContractAddress(network, 'ChainportSideBridge' + chains[i], bridgeImplementation);
    }

    await admin.transferOwnership(chainportCongress.address);
    console.log('Ownership transferred to congress.');
    console.log('Full local deploy complete.')

}

main()
    .then(() => process.exit(0))
    .catch(error => {
       console.log(error);
       process.exit(1);
    });
