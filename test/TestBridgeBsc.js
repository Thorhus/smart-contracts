const { expect } = require("chai");

describe("Bridge Binance Side", function () {

    let maintainersRegistry, maintainersRegistryInstance;
    let bridgeBsc, bridgeBscInstance;
    let validator, validatorInstance;
    let chainportCongress;
    let maintainer, maintainers;
    let user1, user2;
    let token;

    beforeEach(async function() {
        maintainersRegistry = await ethers.getContractFactory("MaintainersRegistry");
        [chainportCongress, user1, user2, token, maintainer, ...maintainers] = await ethers.getSigners();

        token = token.address;

        maintainersRegistryInstance = await maintainersRegistry.deploy();
        for(let i = 0; i < maintainers.length; i++) {
            maintainers[i] = maintainers[i].address;
        }

        maintainers[maintainers.length] = maintainer.address;

        await maintainersRegistryInstance.initialize(maintainers, chainportCongress.address);

        validator = await ethers.getContractFactory("Validator");
        validatorInstance = await validator.deploy();

        bridgeBsc = await ethers.getContractFactory("ChainportBridgeBsc");
        bridgeBscInstance = await bridgeBsc.deploy();
    });

    it("Initialization", async function () {
        await bridgeBscInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);
    });

    describe("Protection, locking, freezing etc.", function () {

        beforeEach(async function () {
            await bridgeBscInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);
        });

        describe("Bridge Freezing Operations", function () {

            it("Should freeze the bridge (by maintainer)", async function () {
                await bridgeBscInstance.connect(maintainer).freezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(true);
            });

            it("Should unfreeze the bridge (by congress)", async function () {
                await bridgeBscInstance.connect(maintainer).freezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(true);
                await bridgeBscInstance.connect(chainportCongress).unfreezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(false);
            });

            it("Should not let freeze the bridge (by user)", async function () {
                await expect(bridgeBscInstance.connect(user1).freezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not let unfreeze the bridge (by user)", async function () {
                await bridgeBscInstance.connect(maintainer).freezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(true);
                await expect(bridgeBscInstance.connect(user1).unfreezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });
    });
});