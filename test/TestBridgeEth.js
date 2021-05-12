const { expect } = require("chai");

describe("Bridge Ethereum Side", function () {

    let maintainersRegistry, maintainersRegistryInstance;
    let bridgeEth, bridgeEthInstance;
    let validator, validatorInstance;
    let chainportCongress;
    let maintainer, maintainers;
    let user1, user2;
    let token;

    beforeEach(async function() {
        maintainersRegistry = await ethers.getContractFactory("MaintainersRegistry");
        [chainportCongress, user1, user2, maintainer, ...maintainers] = await ethers.getSigners();

        maintainersRegistryInstance = await maintainersRegistry.deploy();
        for(let i = 0; i < maintainers.length; i++) {
            maintainers[i] = maintainers[i].address;
        }

        maintainers[maintainers.length] = maintainer.address;

        await maintainersRegistryInstance.initialize(maintainers, chainportCongress.address);

        token = await ethers.getContractFactory("BridgeMintableToken");
        token = await token.deploy("","",5);

        validator = await ethers.getContractFactory("Validator");
        validatorInstance = await validator.deploy();

        bridgeEth = await ethers.getContractFactory("ChainportBridgeEth");
        bridgeEthInstance = await bridgeEth.deploy();
    });

    describe("Initialization", function () {
        it("Should not initialize when safetyThreshold is 0", async function () {
            await expect(bridgeEthInstance.initialize(
                maintainersRegistryInstance.address,
                chainportCongress.address,
                validatorInstance.address,
                0,
                0
            )).to.be.revertedWith("Error: % is not valid.");
        });

        it("Should initialize", async function () {
            await bridgeEthInstance.initialize(
                maintainersRegistryInstance.address,
                chainportCongress.address,
                validatorInstance.address,
                0,
                30
            )
        });
    });

    describe("Main Functions", function () {

        beforeEach(async function () {
            await bridgeEthInstance.initialize(
                maintainersRegistryInstance.address,
                chainportCongress.address,
                validatorInstance.address,
                0,
                30
            );
        });

        describe("Asset protection", function () {
            it("Should protect the asset (by congress)", async function () {
                await bridgeEthInstance.connect(chainportCongress).setAssetProtection(token.address, true);
                expect(await bridgeEthInstance.isAssetProtected(token.address)).to.equal(true);
            });

            it("Should remove protection on the asset (by congress)", async function () {
                await bridgeEthInstance.connect(chainportCongress).setAssetProtection(token.address, true);
                expect(await bridgeEthInstance.isAssetProtected(token.address)).to.equal(true);
                await bridgeEthInstance.connect(chainportCongress).setAssetProtection(token.address, false);
                expect(await bridgeEthInstance.isAssetProtected(token.address)).to.equal(false);
            });

            it("Should not protect the asset (by user)", async function () {
                await expect(bridgeEthInstance.connect(user1).setAssetProtection(token.address, true))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not remove protection on the asset (by user)", async function () {
                await bridgeEthInstance.connect(chainportCongress).setAssetProtection(token.address, true);
                expect(await bridgeEthInstance.isAssetProtected(token.address)).to.equal(true);
                await expect(bridgeEthInstance.connect(user1).setAssetProtection(token.address, false))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Bridge Freezing Operations", function () {

            it("Should freeze the bridge (by maintainer)", async function () {
                await bridgeEthInstance.connect(maintainer).freezeBridge();
                expect(await bridgeEthInstance.isFrozen()).to.equal(true);
            });

            it("Should unfreeze the bridge (by congress)", async function () {
                await bridgeEthInstance.connect(maintainer).freezeBridge();
                expect(await bridgeEthInstance.isFrozen()).to.equal(true);
                await bridgeEthInstance.connect(chainportCongress).unfreezeBridge();
                expect(await bridgeEthInstance.isFrozen()).to.equal(false);
            });

            it("Should not let freeze the bridge (by user)", async function () {
                await expect(bridgeEthInstance.connect(user1).freezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not let unfreeze the bridge (by user)", async function () {
                await bridgeEthInstance.connect(maintainer).freezeBridge();
                expect(await bridgeEthInstance.isFrozen()).to.equal(true);
                await expect(bridgeEthInstance.connect(user1).unfreezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Time Lock Setting", function () {
            it("Should set time lock (by congress)", async function () {
                await expect(bridgeEthInstance.connect(chainportCongress).setTimeLockLength(5))
                    .to.emit(bridgeEthInstance, 'TimeLockLengthChanged')
                    .withArgs(5);
                expect(await bridgeEthInstance.timeLockLength()).to.equal(5);
            });

            it("Should not set time lock (by user)", async function () {
               await expect(bridgeEthInstance.connect(user1).setTimeLockLength(5))
                   .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not set time lock (by maintainer)", async function () {
                await expect(bridgeEthInstance.connect(maintainer).setTimeLockLength(5))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Safety Threshold Setting", function () {
            it("Should set safety threshold (by congress)", async function () {
                await expect(bridgeEthInstance.connect(chainportCongress).setThreshold(7))
                    .to.emit(bridgeEthInstance, 'SafetyThresholdChanged')
                    .withArgs(7);
                expect(await bridgeEthInstance.safetyThreshold()).to.equal(7);
            });

            it("Should not set safety threshold (by user)", async function () {
                await expect(bridgeEthInstance.connect(user1).setThreshold(5))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not set safety threshold (by maintainer)", async function () {
                await expect(bridgeEthInstance.connect(maintainer).setThreshold(5))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Token Freezing", function () {
            xit("Should freeze the token", async function () {
                let bridgeBscInstance = await ethers.getContractFactory("ChainportBridgeBsc");
                bridgeBscInstance = await bridgeBscInstance.deploy();

                //await bridgeBscInstance.connect(maintainer).mintNewToken("");

                await expect(bridgeEthInstance.connect(user1).freezeToken(token.address, 1))
                    .to.emit(bridgeEthInstance, 'TokensFreezed')
                    .withArgs(token.address, user1, 1);
            });
        });

        describe("Token Releasing (Withdrawal)", function () {
            xit("Should withdraw tokens using signature", async function () {

            });
        });

    });
});