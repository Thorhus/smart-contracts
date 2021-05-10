const { expect } = require("chai");

describe("Bridge Eth Side", function () {

    let maintainersRegistry, maintainersRegistryInstance;
    let bridgeEth, bridgeEthInstance;
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

        bridgeEth = await ethers.getContractFactory("ChainportBridgeEth");
        bridgeEthInstance = await bridgeEth.deploy();

        bridgeBsc = await ethers.getContractFactory("ChainportBridgeBsc");
        bridgeBscInstance = await bridgeBsc.deploy();
    });

    describe("Initialization Ethereum Side", function () {
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
                1
            )
        });
    });

    it("Initialization Binance Side", async function () {
       await bridgeBscInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);
    });

    describe("Protection, locking, freezing etc.", function () {
        beforeEach(async function () {
            // Initialize Ethereum side of the bridge
            await bridgeEthInstance.initialize(
                maintainersRegistryInstance.address,
                chainportCongress.address,
                validatorInstance.address,
                0,
                1
            );

            // Initialize Binance side of the bridge
            await bridgeBscInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);
        });

        describe("Asset protection", function () {
            it("Should protect the asset (by congress)", async function () {
                await bridgeEthInstance.connect(chainportCongress).setAssetProtection(token, true);
                expect(await bridgeEthInstance.isAssetProtected(token)).to.equal(true);
            });

            it("Should remove protection on the asset (by congress)", async function () {
                await bridgeEthInstance.connect(chainportCongress).setAssetProtection(token, true);
                expect(await bridgeEthInstance.isAssetProtected(token)).to.equal(true);
                await bridgeEthInstance.connect(chainportCongress).setAssetProtection(token, false);
                expect(await bridgeEthInstance.isAssetProtected(token)).to.equal(false);
            });

            it("Should not protect the asset (by user)", async function () {
                await expect(bridgeEthInstance.connect(user1).setAssetProtection(token, true))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not remove protection on the asset (by user)", async function () {
                await bridgeEthInstance.connect(chainportCongress).setAssetProtection(token, true);
                expect(await bridgeEthInstance.isAssetProtected(token)).to.equal(true);
                await expect(bridgeEthInstance.connect(user1).setAssetProtection(token, false))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Bridge Freezing Operations", function () {
            describe("Ethereum Side Freeze/Unfreeze", function () {

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

            describe("Binance Side Freeze/Unfreeze", function () {
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
});